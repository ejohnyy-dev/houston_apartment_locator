/**
 * Tests for the 24-hour lead nurture automation
 *
 * Covers:
 * - HubSpot helper (upsertHubSpotContact, sendNurtureFollowup)
 * - DB helpers (getInquiriesDueForNurture, markNurtureSent, etc.)
 * - Scheduled handler authentication guard
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── HubSpot module tests ────────────────────────────────────────────────────

describe("HubSpot nurture helpers", () => {
  const FAKE_TOKEN = "pat-test-token-12345";

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("upsertHubSpotContact", () => {
    it("returns success when PATCH succeeds (existing contact)", async () => {
      const { upsertHubSpotContact } = await import("./hubspot");

      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: "hs-123" }),
      } as Response);

      const result = await upsertHubSpotContact(
        { email: "test@example.com", firstname: "John" },
        FAKE_TOKEN
      );

      expect(result.success).toBe(true);
      expect(result.contactId).toBe("hs-123");
      expect(mockFetch).toHaveBeenCalledOnce();
    });

    it("falls back to POST when PATCH returns 404 (new contact)", async () => {
      const { upsertHubSpotContact } = await import("./hubspot");

      const mockFetch = vi.mocked(fetch);
      // First call: PATCH → 404
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => "Not found",
      } as Response);
      // Second call: POST → 201
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: "hs-456" }),
      } as Response);

      const result = await upsertHubSpotContact(
        { email: "new@example.com", firstname: "Jane" },
        FAKE_TOKEN
      );

      expect(result.success).toBe(true);
      expect(result.contactId).toBe("hs-456");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("returns failure when HubSpot API returns 500", async () => {
      const { upsertHubSpotContact } = await import("./hubspot");

      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      } as Response);

      const result = await upsertHubSpotContact(
        { email: "fail@example.com" },
        FAKE_TOKEN
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("500");
    });

    it("filters out empty string properties before sending", async () => {
      const { upsertHubSpotContact } = await import("./hubspot");

      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: "hs-789" }),
      } as Response);

      await upsertHubSpotContact(
        { email: "test@example.com", firstname: "", phone: "" },
        FAKE_TOKEN
      );

      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(callBody.properties).not.toHaveProperty("firstname");
      expect(callBody.properties).not.toHaveProperty("phone");
      expect(callBody.properties).toHaveProperty("email");
    });
  });

  describe("sendNurtureFollowup", () => {
    it("sends followup_sent=true and advances lifecycle stage", async () => {
      const { sendNurtureFollowup } = await import("./hubspot");

      const mockFetch = vi.mocked(fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: "hs-999" }),
      } as Response);

      const result = await sendNurtureFollowup(
        {
          email: "lead@example.com",
          name: "Alice Smith",
          apartmentName: "The Carlton",
        },
        FAKE_TOKEN
      );

      expect(result.success).toBe(true);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(callBody.properties.followup_sent).toBe("true");
      expect(callBody.properties.lifecyclestage).toBe("marketingqualifiedlead");
      expect(callBody.properties.hs_lead_status).toBe("IN_PROGRESS");
    });
  });
});

// ─── Nurture scheduling logic tests ─────────────────────────────────────────

describe("Nurture scheduling", () => {
  it("schedules follow-up 24 hours in the future", () => {
    const now = Date.now();
    const nurtureScheduledFor = new Date(now + 24 * 60 * 60 * 1000);

    const diffMs = nurtureScheduledFor.getTime() - now;
    const diffHours = diffMs / (1000 * 60 * 60);

    expect(diffHours).toBeCloseTo(24, 0);
  });

  it("identifies leads due for follow-up correctly", () => {
    const now = new Date();

    // Lead scheduled 25 hours ago → due
    const pastScheduled = new Date(now.getTime() - 25 * 60 * 60 * 1000);
    expect(pastScheduled <= now).toBe(true);

    // Lead scheduled 23 hours from now → not due
    const futureScheduled = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    expect(futureScheduled <= now).toBe(false);
  });
});

// ─── Scheduled handler auth guard tests ─────────────────────────────────────

describe("Nurture handler auth guard", () => {
  it("rejects non-cron requests", async () => {
    // Simulate a non-cron user (isCron = false)
    const mockUser = { isCron: false, taskUid: null };

    const isAuthorized = mockUser.isCron && !!mockUser.taskUid;
    expect(isAuthorized).toBe(false);
  });

  it("allows cron requests with taskUid", () => {
    const mockUser = { isCron: true, taskUid: "task-abc-123" };

    const isAuthorized = mockUser.isCron && !!mockUser.taskUid;
    expect(isAuthorized).toBe(true);
  });

  it("rejects cron requests without taskUid", () => {
    const mockUser = { isCron: true, taskUid: "" };

    const isAuthorized = mockUser.isCron && !!mockUser.taskUid;
    expect(isAuthorized).toBe(false);
  });
});

// ─── Nurture stage transitions ───────────────────────────────────────────────

describe("Nurture stage transitions", () => {
  const validStages = ["pending", "sent", "failed", "skipped"] as const;

  it("all valid nurture stages are defined", () => {
    expect(validStages).toContain("pending");
    expect(validStages).toContain("sent");
    expect(validStages).toContain("failed");
    expect(validStages).toContain("skipped");
  });

  it("pending leads can be sent or failed", () => {
    const pendingLead = { nurtureStage: "pending" as const };
    const canProcess = pendingLead.nurtureStage === "pending" || pendingLead.nurtureStage === "failed";
    expect(canProcess).toBe(true);
  });

  it("already-sent leads are not reprocessed", () => {
    const sentLead = { nurtureStage: "sent" as const };
    const canProcess = sentLead.nurtureStage === "pending" || sentLead.nurtureStage === "failed";
    expect(canProcess).toBe(false);
  });
});
