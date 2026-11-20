import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import {
  backoffMs,
  enqueueLead,
  idempotencyKey,
  listQueue,
  makeCrmDeliver,
  processQueue,
} from "./leadQueue";

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "leadq-"));
});
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

const lead = { email: "a@b.com", phone: "8326037278", first_name: "A" };
const names = (d: string) => fs.readdirSync(d).filter((f) => f.endsWith(".json"));

describe("lead queue", () => {
  it("persists a lead to disk before anything is delivered", () => {
    const e = enqueueLead(lead, dir);
    expect(names(dir)).toEqual([`${e.id}.json`]);
    expect(listQueue(dir)[0].payload.email).toBe("a@b.com");
  });

  it("removes the lead after successful delivery", async () => {
    enqueueLead(lead, dir);
    const r = await processQueue(async () => ({ kind: "ok" }), dir);
    expect(r.delivered).toBe(1);
    expect(names(dir)).toEqual([]);
  });

  it("keeps the lead and backs off when the CRM is down, then delivers on recovery", async () => {
    const t0 = Date.now();
    enqueueLead(lead, dir, t0);
    let r = await processQueue(async () => ({ kind: "retry", error: "ECONNREFUSED" }), dir, t0);
    expect(r.retrying).toBe(1);
    const [e] = listQueue(dir);
    expect(e.attempts).toBe(1);
    expect(e.lastError).toBe("ECONNREFUSED");
    expect(e.nextAttemptAt).toBe(t0 + backoffMs(1));

    // not due yet → untouched
    const spy = vi.fn().mockResolvedValue({ kind: "ok" });
    r = await processQueue(spy, dir, t0 + 1000);
    expect(spy).not.toHaveBeenCalled();

    // CRM back, backoff elapsed → delivered, queue empty
    r = await processQueue(spy, dir, t0 + backoffMs(1) + 1);
    expect(r.delivered).toBe(1);
    expect(names(dir)).toEqual([]);
  });

  it("survives a restart: a fresh process replays what's on disk", async () => {
    enqueueLead(lead, dir);
    const delivered: string[] = [];
    await processQueue(async (en) => (delivered.push(String(en.payload.email)), { kind: "ok" }), dir);
    expect(delivered).toEqual(["a@b.com"]);
  });

  it("moves permanently rejected leads to dead/ instead of dropping or retrying them", async () => {
    enqueueLead(lead, dir);
    const r = await processQueue(async () => ({ kind: "dead", error: "CRM 400: bad email" }), dir);
    expect(r.dead).toBe(1);
    expect(names(dir)).toEqual([]);
    const dead = fs.readdirSync(path.join(dir, "dead"));
    expect(dead).toHaveLength(1);
    expect(JSON.parse(fs.readFileSync(path.join(dir, "dead", dead[0]), "utf8")).lastError).toMatch(/400/);
  });

  it("a thrown delivery error is treated as retry, not loss", async () => {
    enqueueLead(lead, dir);
    await processQueue(async () => { throw new Error("boom"); }, dir);
    expect(listQueue(dir)[0].attempts).toBe(1);
  });

  it("quarantines corrupt spool files", () => {
    fs.writeFileSync(path.join(dir, "bad.json"), "{nope");
    expect(listQueue(dir)).toEqual([]);
    expect(fs.existsSync(path.join(dir, "dead", "bad.json"))).toBe(true);
  });

  it("caps backoff at 15 minutes", () => {
    expect(backoffMs(1)).toBe(30_000);
    expect(backoffMs(50)).toBe(15 * 60_000);
  });
});

describe("makeCrmDeliver", () => {
  const entry = { id: "1", createdAt: "", attempts: 0, nextAttemptAt: 0, payload: lead };
  const res = (status: number, body: unknown = {}) =>
    ({ ok: status < 400, status, json: async () => body }) as Response;

  it("sends an idempotency key and JSON body", async () => {
    const f = vi.fn().mockResolvedValue(res(200));
    expect(await makeCrmDeliver("http://crm", { fetchImpl: f as any })(entry)).toEqual({ kind: "ok" });
    expect(f.mock.calls[0][1].headers["Idempotency-Key"]).toBe(idempotencyKey(lead));
  });

  it("5xx / 429 / network errors retry; other 4xx are permanent (no more retrying a 400)", async () => {
    const run = (r: Response | Error) =>
      makeCrmDeliver("http://crm", {
        fetchImpl: (r instanceof Error ? vi.fn().mockRejectedValue(r) : vi.fn().mockResolvedValue(r)) as any,
      })(entry);
    expect((await run(res(502))).kind).toBe("retry");
    expect((await run(res(429))).kind).toBe("retry");
    expect((await run(new Error("ECONNREFUSED"))).kind).toBe("retry");
    expect((await run(res(400, { error: "email is required" }))).kind).toBe("dead");
  });

  it("keeps leads queued while CRM_WEBHOOK_URL is unset", async () => {
    expect((await makeCrmDeliver(undefined)(entry)).kind).toBe("retry");
  });
});
