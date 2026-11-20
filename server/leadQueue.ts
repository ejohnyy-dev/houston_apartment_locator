import { createHash, randomUUID } from "crypto";
import fs from "fs";
import path from "path";

/**
 * Durable lead outbox.
 *
 * A lead is written to disk BEFORE the visitor gets a response, then delivered to
 * the CRM by a background worker with capped exponential backoff. A CRM outage,
 * tunnel restart or process crash therefore delays a lead but cannot lose it.
 * Leads the CRM permanently rejects (4xx) move to `dead/` for manual review.
 *
 * Spool dir: LEAD_SPOOL_DIR (default ./data/lead-spool). On Fly this must be on a
 * mounted volume, otherwise it only survives CRM outages, not redeploys.
 */

export interface QueueEntry {
  id: string;
  createdAt: string;
  attempts: number;
  nextAttemptAt: number; // epoch ms
  lastError?: string;
  payload: Record<string, unknown>;
}

export type DeliveryOutcome =
  | { kind: "ok" }
  | { kind: "retry"; error: string }
  | { kind: "dead"; error: string };

export type Deliver = (entry: QueueEntry) => Promise<DeliveryOutcome>;

export const spoolDir = () =>
  process.env.LEAD_SPOOL_DIR || path.resolve(process.cwd(), "data", "lead-spool");

const deadDir = (dir: string) => path.join(dir, "dead");

export function backoffMs(attempts: number): number {
  // 30s, 60s, 2m, 4m, 8m, then capped at 15m – retried indefinitely.
  return Math.min(30_000 * 2 ** Math.max(0, attempts - 1), 15 * 60_000);
}

/** Stable per-person key so CRM replays/duplicates collapse. */
export function idempotencyKey(payload: Record<string, unknown>): string {
  const email = String(payload.email ?? "").toLowerCase();
  const phone = String(payload.phone ?? "").replace(/\D/g, "");
  return createHash("sha256").update(`${email}|${phone}`).digest("hex").slice(0, 32);
}

function writeAtomic(file: string, data: unknown) {
  const tmp = `${file}.tmp`;
  const fd = fs.openSync(tmp, "w");
  try {
    fs.writeSync(fd, JSON.stringify(data));
    fs.fsyncSync(fd); // on disk before we tell the visitor "saved"
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, file);
}

/** Throws if the lead cannot be persisted – callers must surface that as an error. */
export function enqueueLead(
  payload: Record<string, unknown>,
  dir = spoolDir(),
  now = Date.now()
): QueueEntry {
  fs.mkdirSync(dir, { recursive: true });
  const entry: QueueEntry = {
    id: `${now}-${randomUUID()}`,
    createdAt: new Date(now).toISOString(),
    attempts: 0,
    nextAttemptAt: now,
    payload,
  };
  writeAtomic(path.join(dir, `${entry.id}.json`), entry);
  return entry;
}

export function listQueue(dir = spoolDir()): QueueEntry[] {
  if (!fs.existsSync(dir)) return [];
  const out: QueueEntry[] = [];
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith(".json")) continue;
    try {
      out.push(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));
    } catch (e) {
      // Corrupt file: quarantine instead of retrying forever or deleting.
      fs.mkdirSync(deadDir(dir), { recursive: true });
      fs.renameSync(path.join(dir, f), path.join(deadDir(dir), f));
      console.error(`[Lead queue] quarantined unreadable ${f}`);
    }
  }
  return out;
}

export interface ProcessResult {
  delivered: number;
  retrying: number;
  dead: number;
}

export async function processQueue(
  deliver: Deliver,
  dir = spoolDir(),
  now = Date.now()
): Promise<ProcessResult> {
  const result: ProcessResult = { delivered: 0, retrying: 0, dead: 0 };
  for (const entry of listQueue(dir)) {
    if (entry.nextAttemptAt > now) continue;
    const file = path.join(dir, `${entry.id}.json`);
    let outcome: DeliveryOutcome;
    try {
      outcome = await deliver(entry);
    } catch (e) {
      outcome = { kind: "retry", error: e instanceof Error ? e.message : String(e) };
    }
    if (outcome.kind === "ok") {
      fs.unlinkSync(file);
      result.delivered++;
    } else if (outcome.kind === "dead") {
      fs.mkdirSync(deadDir(dir), { recursive: true });
      writeAtomic(path.join(deadDir(dir), `${entry.id}.json`), {
        ...entry,
        attempts: entry.attempts + 1,
        lastError: outcome.error,
      });
      fs.unlinkSync(file);
      console.error(`[Lead queue] ${entry.id} rejected permanently, moved to dead/: ${outcome.error}`);
      result.dead++;
    } else {
      const attempts = entry.attempts + 1;
      writeAtomic(file, {
        ...entry,
        attempts,
        lastError: outcome.error,
        nextAttemptAt: now + backoffMs(attempts),
      });
      result.retrying++;
    }
  }
  return result;
}

/** POSTs one queued lead to the CRM. 4xx (except 408/429) is permanent. */
export function makeCrmDeliver(
  crmUrl: string | undefined,
  opts: { timeoutMs?: number; fetchImpl?: typeof fetch } = {}
): Deliver {
  const doFetch = opts.fetchImpl ?? fetch;
  return async (entry) => {
    if (!crmUrl) return { kind: "retry", error: "CRM_WEBHOOK_URL not configured" };
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 10_000);
    try {
      const res = await doFetch(crmUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey(entry.payload),
        },
        body: JSON.stringify(entry.payload),
        signal: controller.signal,
      });
      if (res.ok) return { kind: "ok" };
      const body = await res.json().catch(() => ({}) as { error?: string });
      const error = `CRM ${res.status}: ${(body as { error?: string }).error ?? "unknown error"}`;
      const permanent = res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429;
      return { kind: permanent ? "dead" : "retry", error };
    } catch (e) {
      return { kind: "retry", error: e instanceof Error ? e.message : String(e) };
    } finally {
      clearTimeout(timer);
    }
  };
}

export function startLeadWorker(deliver: Deliver, intervalMs = 15_000) {
  let running = false;
  const tick = async () => {
    if (running) return; // never overlap runs → no double sends
    running = true;
    try {
      const r = await processQueue(deliver);
      if (r.delivered || r.dead) {
        console.log(`[Lead queue] delivered=${r.delivered} retrying=${r.retrying} dead=${r.dead}`);
      }
    } catch (e) {
      console.error("[Lead queue] worker error:", e);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  void tick(); // replay anything left from a previous run immediately
  return { kick: () => void tick(), stop: () => clearInterval(timer) };
}
