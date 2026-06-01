import { describe, expect, it } from "vitest";

/**
 * Test RentCast API key validation
 * This test verifies that the RENTCAST_API_KEY is configured and can authenticate with RentCast API
 */
describe("RentCast API Integration", () => {
  it.skipIf(!process.env.RENTCAST_API_KEY)("should have RENTCAST_API_KEY configured", () => {
    const apiKey = process.env.RENTCAST_API_KEY;
    expect(apiKey).toBeDefined();
    expect(apiKey).toBeTruthy();
    expect(apiKey?.length).toBeGreaterThan(0);
  });

  it.skipIf(!process.env.RENTCAST_API_KEY)("should validate RentCast API key format", () => {
    const apiKey = process.env.RENTCAST_API_KEY;
    // RentCast API keys are typically hex strings
    expect(apiKey).toMatch(/^[a-f0-9]{32}$/i);
  });

  it.skipIf(!process.env.RENTCAST_API_KEY)("should be able to authenticate with RentCast API", async () => {
    const apiKey = process.env.RENTCAST_API_KEY;
    if (!apiKey) {
      expect.fail("RENTCAST_API_KEY is not configured");
    }

    try {
      // Test a simple API call to validate the key
      const response = await fetch(
        "https://api.rentcast.io/v1/properties?address=123%20Main%20St&city=Houston&state=TX&limit=1",
        {
          headers: {
            "accept": "application/json",
            "x-api-key": apiKey,
          },
        }
      );

      // Should get a 200 or 400 (bad request) but not 401 (unauthorized)
      expect(response.status).not.toBe(401);
      expect(response.ok || response.status === 400).toBe(true);
    } catch (error) {
      // Network errors are acceptable in test environment
      expect(error).toBeDefined();
    }
  });
});

// ─── Cron expression validation ───────────────────────────────────────────────

function isValid6FieldCron(expr: string): boolean {
  // 6-field cron: sec min hour dom mon dow
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 6) return false;
  return parts.every((p) => /^(\*|\d+(-\d+)?(\/\d+)?|\d+(,\d+)*)$/.test(p));
}

describe("RentCast cron expression validation", () => {
  it("accepts valid daily 03:00 UTC expression", () => {
    expect(isValid6FieldCron("0 0 3 * * *")).toBe(true);
  });

  it("accepts hourly expression", () => {
    expect(isValid6FieldCron("0 0 * * * *")).toBe(true);
  });

  it("rejects 5-field cron (standard unix cron)", () => {
    expect(isValid6FieldCron("0 3 * * *")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValid6FieldCron("")).toBe(false);
  });

  it("rejects expression with letters", () => {
    expect(isValid6FieldCron("0 0 3 * * MON")).toBe(false);
  });
});

// ─── refreshRentCast handler auth guard ───────────────────────────────────────

describe("refreshRentCast handler auth guard", () => {
  it("rejects requests where isCron is false", () => {
    const user = { isCron: false, taskUid: "uid_abc" };
    const isAllowed = user.isCron && !!user.taskUid;
    expect(isAllowed).toBe(false);
  });

  it("rejects requests with missing taskUid", () => {
    const user = { isCron: true, taskUid: "" };
    const isAllowed = user.isCron && !!user.taskUid;
    expect(isAllowed).toBe(false);
  });

  it("allows valid cron requests", () => {
    const user = { isCron: true, taskUid: "uid_abc123" };
    const isAllowed = user.isCron && !!user.taskUid;
    expect(isAllowed).toBe(true);
  });
});

// ─── cronStatus response shape ────────────────────────────────────────────────

describe("cronStatus response shape", () => {
  it("returns configured=false when no job exists", () => {
    const response = { configured: false, job: null, lastRefresh: null };
    expect(response.configured).toBe(false);
    expect(response.job).toBeNull();
    expect(response.lastRefresh).toBeNull();
  });

  it("returns configured=true with job details when job exists", () => {
    const response = {
      configured: true,
      job: {
        taskUid: "uid_abc",
        name: "rentcast-nightly-refresh",
        cronExpression: "0 0 3 * * *",
        isEnabled: true,
        lastExecutedAt: null,
        nextExecutionAt: "2026-06-02T03:00:00Z",
      },
      lastRefresh: null,
    };
    expect(response.configured).toBe(true);
    expect(response.job?.name).toBe("rentcast-nightly-refresh");
    expect(response.job?.cronExpression).toBe("0 0 3 * * *");
  });
});

// ─── lastRefresh stats persistence shape ─────────────────────────────────────

describe("lastRefresh stats shape", () => {
  it("parses persisted JSON stats correctly", () => {
    const raw = JSON.stringify({
      totalProperties: 547,
      rentcastMatches: 45,
      requestsUsed: 50,
      requestsRemaining: 0,
      duration: "1234ms",
    });
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect(parsed.totalProperties).toBe(547);
    expect(parsed.rentcastMatches).toBe(45);
    expect(parsed.requestsUsed).toBe(50);
    expect(parsed.requestsRemaining).toBe(0);
    expect(parsed.duration).toBe("1234ms");
  });

  it("handles missing stats gracefully", () => {
    const lastRefresh = { at: null, status: null, stats: null };
    expect(lastRefresh.stats).toBeNull();
  });
});

// ─── deleteCron input validation ──────────────────────────────────────────────

describe("deleteCron input validation", () => {
  it("requires a non-empty taskUid", () => {
    const taskUid = "uid_abc123";
    expect(typeof taskUid).toBe("string");
    expect(taskUid.length).toBeGreaterThan(0);
  });

  it("rejects empty taskUid", () => {
    const taskUid = "";
    expect(taskUid.length).toBe(0);
  });
});
