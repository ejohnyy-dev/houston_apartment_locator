// @vitest-environment node
/**
 * Characterization tests for POST /api/leads in server/index.ts.
 *
 * The handler is defined inline inside startServer() (an async function that also
 * calls server.listen()), so it can't be imported and exercised directly without
 * either refactoring production code or starting a real server. Per the sibling
 * houston_apartment_locator_new_new/server/leads.route.test.ts pattern, we mirror
 * the route handler verbatim in a standalone Express app here and drive it over a
 * real HTTP server (Node's native fetch), so the test captures the handler's exact
 * request/response contract before any refactor.
 *
 * These tests were written by reading server/index.ts's current implementation and
 * are meant to pin down existing behavior (validation, budget/bedroom parsing, CRM
 * retry/backoff, and error responses) so a later nesting-flattening refactor can be
 * verified against them.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import express from "express";
import type { AddressInfo } from "net";
import type { Server } from "http";

// Captured before any per-test fetch stubbing so postLead() can still reach the
// in-process test server even while the handler's own `fetch` calls are mocked.
const realFetch = globalThis.fetch;

// ---------------------------------------------------------------------------
// Mirror of the /api/leads handler in server/index.ts (current, pre-refactor).
// ---------------------------------------------------------------------------
function buildTestApp() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  app.post("/api/leads", async (req, res) => {
    const crmUrl = process.env.CRM_WEBHOOK_URL;

    if (!crmUrl) {
      console.error("[Lead intake] CRM_WEBHOOK_URL not configured");
      return res.status(500).json({ error: "CRM not configured" });
    }

    const clean = (value: unknown) =>
      value === null || value === undefined ? "" : String(value).trim();

    const email = clean(req.body.email).toLowerCase();

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const parseBudget = (v: unknown): { min?: number; max?: number } => {
      const s = String(v ?? "");
      const nums = (s.match(/\d[\d,]*/g) ?? [])
        .map((n) => parseInt(n.replace(/,/g, ""), 10))
        .filter((n) => Number.isFinite(n) && n >= 100 && n <= 50000);
      if (nums.length === 0) return {};
      if (nums.length === 1) {
        if (/under|below|less/i.test(s)) return { max: nums[0] };
        if (/\+|over|above|more/i.test(s)) return { min: nums[0] };
        return { max: nums[0] };
      }
      return { min: Math.min(...nums), max: Math.max(...nums) };
    };

    const parseBedrooms = (v: unknown): number | undefined => {
      const s = String(v ?? "");
      if (/studio/i.test(s)) return 0;
      const m = s.match(/\d+/);
      return m ? parseInt(m[0], 10) : undefined;
    };

    const budget = parseBudget(req.body.budget);
    const pets = clean(req.body.pets);
    const notes = clean(req.body.notes);
    const combinedNotes =
      [pets && pets !== "No pets" ? `Pets: ${pets}` : "", notes]
        .filter(Boolean)
        .join(" | ") || undefined;

    const crmPayload = {
      first_name: clean(req.body.first_name || req.body.firstName),
      last_name: clean(req.body.last_name || req.body.lastName),
      email,
      phone: clean(req.body.phone),
      bedrooms: parseBedrooms(req.body.bedrooms),
      budget_min: budget.min,
      budget_max: budget.max,
      move_in_date: clean(req.body.move_in_timeline || req.body.moveIn),
      preferred_area: clean(req.body.preferred_area || req.body.areas),
      notes: combinedNotes,
      sms_consent: req.body.sms_consent ?? req.body.smsConsent ?? false,
      consent_source: "txaptfinder.com contact form",
      source: "txaptfinder",
    };

    const submitToCrm = async (retryCount = 0): Promise<void> => {
      const maxRetries = 3;
      const timeout = 5000;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(crmUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(crmPayload),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (response.ok) {
          const data = await response.json().catch(() => ({}));
          console.log(`[Lead intake] ✓ Success for ${email} (leadId: ${data.leadId})`);
          return;
        } else if (response.status >= 500 && retryCount < maxRetries) {
          console.warn(
            `[Lead intake] Server error (${response.status}) — retrying (attempt ${retryCount + 2}/${maxRetries + 1})`
          );
          await new Promise((r) => setTimeout(r, Math.pow(2, retryCount) * 1000));
          await submitToCrm(retryCount + 1);
        } else {
          const body = await response.json().catch(() => ({}));
          throw new Error(
            `CRM error ${response.status}: ${body.error || "unknown error"}`
          );
        }
      } catch (error) {
        clearTimeout(timer);

        if (retryCount < maxRetries) {
          console.warn(
            `[Lead intake] Network error — retrying (attempt ${retryCount + 2}/${maxRetries + 1}):`,
            error instanceof Error ? error.message : String(error)
          );
          await new Promise((r) => setTimeout(r, Math.pow(2, retryCount) * 1000));
          await submitToCrm(retryCount + 1);
        } else {
          throw new Error(
            `Failed after ${maxRetries} retries: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    };

    try {
      await submitToCrm();
      res.json({ ok: true, message: "Lead saved to CRM" });
    } catch (error) {
      console.error(`[Lead intake] ✗ Failed for ${email}:`, error);
      res.status(503).json({
        error: error instanceof Error ? error.message : "Failed to save lead",
      });
    }
  });

  return app;
}

function startTestServer(): Promise<[Server, string]> {
  return new Promise((resolve) => {
    const server = buildTestApp().listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve([server, `http://127.0.0.1:${port}`]);
    });
  });
}

function stopTestServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    // Forcibly drop any lingering keep-alive sockets (e.g. from a request whose
    // real-timer retry chain hadn't finished writing a response yet) so close()
    // doesn't hang waiting for them to go idle on their own.
    server.closeAllConnections();
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
const CRM_URL = "https://crm.example/hook";

describe("POST /api/leads", () => {
  let server: Server;
  let baseUrl: string;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    delete process.env.CRM_WEBHOOK_URL;
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    [server, baseUrl] = await startTestServer();
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleLogSpy.mockRestore();
    await stopTestServer(server);
  });

  async function postLead(body: Record<string, unknown>) {
    return realFetch(`${baseUrl}/api/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("returns 500 when CRM_WEBHOOK_URL is not configured", async () => {
    const res = await postLead({ email: "a@b.com" });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "CRM not configured" });
  });

  it("returns 400 when email is missing", async () => {
    process.env.CRM_WEBHOOK_URL = CRM_URL;
    const res = await postLead({ first_name: "Jane" });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "Email is required" });
  });

  it("returns 400 when email is blank/whitespace", async () => {
    process.env.CRM_WEBHOOK_URL = CRM_URL;
    const res = await postLead({ email: "   " });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({ error: "Email is required" });
  });

  it("submits to CRM and returns 200 on first-try success, lowercasing email", async () => {
    process.env.CRM_WEBHOOK_URL = CRM_URL;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ leadId: "lead_123" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await postLead({
      email: "Test@Example.com",
      first_name: "Jane",
      last_name: "Doe",
      phone: "555-1234",
      budget: "$1,000 – $1,500",
      bedrooms: "2 Bedrooms",
      move_in_timeline: "ASAP",
      preferred_area: "Midtown",
      pets: "Dog",
      notes: "Has a small dog",
      sms_consent: true,
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, message: "Lead saved to CRM" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [calledUrl, calledOpts] = fetchMock.mock.calls[0];
    expect(calledUrl).toBe(CRM_URL);
    const sentPayload = JSON.parse(calledOpts.body);
    expect(sentPayload).toMatchObject({
      first_name: "Jane",
      last_name: "Doe",
      email: "test@example.com",
      phone: "555-1234",
      bedrooms: 2,
      budget_min: 1000,
      budget_max: 1500,
      move_in_date: "ASAP",
      preferred_area: "Midtown",
      notes: "Pets: Dog | Has a small dog",
      sms_consent: true,
      consent_source: "txaptfinder.com contact form",
      source: "txaptfinder",
    });
  });

  it("accepts camelCase field aliases (firstName/lastName/moveIn/areas/smsConsent)", async () => {
    process.env.CRM_WEBHOOK_URL = CRM_URL;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    await postLead({
      email: "a@b.com",
      firstName: "Alex",
      lastName: "Kim",
      moveIn: "Next month",
      areas: "Downtown",
      smsConsent: true,
    });

    const sentPayload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sentPayload.first_name).toBe("Alex");
    expect(sentPayload.last_name).toBe("Kim");
    expect(sentPayload.move_in_date).toBe("Next month");
    expect(sentPayload.preferred_area).toBe("Downtown");
    expect(sentPayload.sms_consent).toBe(true);
  });

  it("parses 'Studio' bedrooms as 0 and omits 'No pets' from notes", async () => {
    process.env.CRM_WEBHOOK_URL = CRM_URL;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    await postLead({
      email: "a@b.com",
      bedrooms: "Studio",
      pets: "No pets",
      notes: "Quiet building please",
    });

    const sentPayload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sentPayload.bedrooms).toBe(0);
    expect(sentPayload.notes).toBe("Quiet building please");
  });

  it("parses single-sided budget strings ('Under $1,000' -> max, '$3,000+' -> min)", async () => {
    process.env.CRM_WEBHOOK_URL = CRM_URL;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    await postLead({ email: "a@b.com", budget: "Under $1,000" });
    let sentPayload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sentPayload.budget_min).toBeUndefined();
    expect(sentPayload.budget_max).toBe(1000);

    fetchMock.mockClear();
    await postLead({ email: "a@b.com", budget: "$3,000+" });
    sentPayload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sentPayload.budget_min).toBe(3000);
    expect(sentPayload.budget_max).toBeUndefined();
  });

  it("leaves notes undefined when there are no pets and no notes", async () => {
    process.env.CRM_WEBHOOK_URL = CRM_URL;
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    await postLead({ email: "a@b.com" });
    const sentPayload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sentPayload.notes).toBeUndefined();
  });

  it(
    "retries on 5xx then succeeds, returning 200",
    async () => {
      process.env.CRM_WEBHOOK_URL = CRM_URL;

      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce({ ok: false, status: 502, json: async () => ({}) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ leadId: "x" }) });
      vi.stubGlobal("fetch", fetchMock);

      // Real timers: the handler's backoff uses real setTimeout (1s here), and
      // faking timers conflicts with the real Node HTTP server used in this test.
      const res = await postLead({ email: "a@b.com" });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual({ ok: true, message: "Lead saved to CRM" });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    },
    10000
  );

  it(
    // NOTE: despite the name, this pins down EXISTING (buggy) behavior: the synchronous
    // `throw new Error("CRM error ...")` for non-5xx, non-ok responses lands inside the
    // same try block as the fetch call, so it's caught by the generic catch-all retry
    // logic below it -- which doesn't distinguish "deliberate CRM validation error" from
    // "network failure" and retries it anyway (3x with real 1s/2s/4s backoff, ~7s total)
    // before finally surfacing the original CRM error message. A 4xx from the CRM should
    // arguably short-circuit immediately instead of wasting ~7s of latency, but that's a
    // production bug to flag/fix separately, not something to silently correct here.
    "retries on 4xx the same as 5xx (existing bug) and eventually returns 503 with the CRM error message",
    async () => {
      process.env.CRM_WEBHOOK_URL = CRM_URL;
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({ error: "Invalid email domain" }),
      });
      vi.stubGlobal("fetch", fetchMock);

      const res = await postLead({ email: "a@b.com" });
      const body = await res.json();

      expect(res.status).toBe(503);
      expect(body).toEqual({
        error: "Failed after 3 retries: CRM error 422: Invalid email domain",
      });
      // Initial attempt + 3 retries = 4 calls (same as the 5xx-exhaustion case).
      expect(fetchMock).toHaveBeenCalledTimes(4);
    },
    15000
  );

  it(
    // NOTE: pins a serious existing bug, not the intended contract. The recursive
    // `await submitToCrm(retryCount + 1)` retry calls are nested *inside* the same
    // try/catch they're retrying from -- both the 5xx-retry branch (inside the try)
    // and the catch's own retry branch sit inside an enclosing frame that will treat
    // ANY exception bubbling out of the child call (including the child's own
    // already-final "Failed after N retries" giveup) as a fresh retriable failure.
    // That turns one real failure into a retry storm: T(3)=1 call, T(2)=1+2*T(3)=3,
    // T(1)=1+2*T(2)=7, T(0)=1+2*T(1)=15 -- so "3 retries" actually fires 15 real
    // fetches with repeated real 1s/2s/4s backoff at every nesting level, taking
    // ~42s wall-clock instead of the intended ~7s, hammering an already-failing CRM
    // endpoint 15x instead of 4x. Flagged as a bug to fix separately; pinned here as-is.
    "exhausts retries on repeated 5xx and returns 503 (retry-storm bug: 15 calls, not 4)",
    async () => {
      process.env.CRM_WEBHOOK_URL = CRM_URL;

      const fetchMock = vi
        .fn()
        .mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
      vi.stubGlobal("fetch", fetchMock);

      const res = await postLead({ email: "a@b.com" });
      const body = await res.json();

      expect(res.status).toBe(503);
      expect(body).toEqual({
        error: "Failed after 3 retries: CRM error 500: unknown error",
      });
      expect(fetchMock).toHaveBeenCalledTimes(15);
    },
    50000
  );

  it(
    "retries on network error then succeeds",
    async () => {
      process.env.CRM_WEBHOOK_URL = CRM_URL;

      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new TypeError("fetch failed"))
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) });
      vi.stubGlobal("fetch", fetchMock);

      const res = await postLead({ email: "a@b.com" });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body).toEqual({ ok: true, message: "Lead saved to CRM" });
      expect(fetchMock).toHaveBeenCalledTimes(2);
    },
    10000
  );

  it(
    "exhausts retries on repeated network errors and returns 503 with wrapped message",
    async () => {
      process.env.CRM_WEBHOOK_URL = CRM_URL;

      const fetchMock = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
      vi.stubGlobal("fetch", fetchMock);

      const res = await postLead({ email: "a@b.com" });
      const body = await res.json();

      expect(res.status).toBe(503);
      expect(body).toEqual({
        error: "Failed after 3 retries: fetch failed",
      });
      expect(fetchMock).toHaveBeenCalledTimes(4);
    },
    15000
  );
});
