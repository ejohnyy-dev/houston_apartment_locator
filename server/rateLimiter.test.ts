import { describe, it, expect, beforeEach } from "vitest";
import { leadsRateLimiter, leadsIpRateLimiter } from "./_core/rateLimiter";

describe("Rate Limiter", () => {
  beforeEach(() => {
    // Clear rate limiters before each test
    leadsRateLimiter.clear();
    leadsIpRateLimiter.clear();
  });

  describe("Email-based rate limiting (5 per hour)", () => {
    it("should allow first 5 requests from same email", () => {
      const email = "test@example.com";

      for (let i = 0; i < 5; i++) {
        expect(leadsRateLimiter.isAllowed(email)).toBe(true);
      }
    });

    it("should block 6th request from same email", () => {
      const email = "test@example.com";

      // Allow first 5
      for (let i = 0; i < 5; i++) {
        leadsRateLimiter.isAllowed(email);
      }

      // Block 6th
      expect(leadsRateLimiter.isAllowed(email)).toBe(false);
    });

    it("should return correct remaining count", () => {
      const email = "test@example.com";

      expect(leadsRateLimiter.getRemaining(email)).toBe(5);

      leadsRateLimiter.isAllowed(email);
      expect(leadsRateLimiter.getRemaining(email)).toBe(4);

      leadsRateLimiter.isAllowed(email);
      expect(leadsRateLimiter.getRemaining(email)).toBe(3);
    });

    it("should allow different emails independently", () => {
      const email1 = "test1@example.com";
      const email2 = "test2@example.com";

      for (let i = 0; i < 5; i++) {
        leadsRateLimiter.isAllowed(email1);
      }

      // email2 should still have 5 requests available
      expect(leadsRateLimiter.isAllowed(email2)).toBe(true);
      expect(leadsRateLimiter.getRemaining(email2)).toBe(4);
    });

    it("should reset after window expires", () => {
      const email = "test@example.com";

      // Use up all requests
      for (let i = 0; i < 5; i++) {
        leadsRateLimiter.isAllowed(email);
      }

      expect(leadsRateLimiter.isAllowed(email)).toBe(false);

      // Manually reset for testing
      leadsRateLimiter.reset(email);

      // Should be allowed again
      expect(leadsRateLimiter.isAllowed(email)).toBe(true);
      expect(leadsRateLimiter.getRemaining(email)).toBe(4);
    });

    it("should return reset time in seconds", () => {
      const email = "test@example.com";

      // Make a request first to establish the time window
      leadsRateLimiter.isAllowed(email);

      const resetTime = leadsRateLimiter.getResetTime(email);
      expect(resetTime).toBeGreaterThan(0);
      expect(resetTime).toBeLessThanOrEqual(3600); // Should be <= 1 hour in seconds
    });
  });

  describe("IP-based rate limiting (20 per hour)", () => {
    it("should allow first 20 requests from same IP", () => {
      const ip = "192.168.1.1";

      for (let i = 0; i < 20; i++) {
        expect(leadsIpRateLimiter.isAllowed(ip)).toBe(true);
      }
    });

    it("should block 21st request from same IP", () => {
      const ip = "192.168.1.1";

      // Allow first 20
      for (let i = 0; i < 20; i++) {
        leadsIpRateLimiter.isAllowed(ip);
      }

      // Block 21st
      expect(leadsIpRateLimiter.isAllowed(ip)).toBe(false);
    });

    it("should allow different IPs independently", () => {
      const ip1 = "192.168.1.1";
      const ip2 = "192.168.1.2";

      for (let i = 0; i < 20; i++) {
        leadsIpRateLimiter.isAllowed(ip1);
      }

      // ip2 should still have 20 requests available
      expect(leadsIpRateLimiter.isAllowed(ip2)).toBe(true);
      expect(leadsIpRateLimiter.getRemaining(ip2)).toBe(19);
    });
  });

  describe("Rate limiter stats", () => {
    it("should track multiple keys", () => {
      leadsRateLimiter.isAllowed("email1@example.com");
      leadsRateLimiter.isAllowed("email2@example.com");
      leadsRateLimiter.isAllowed("email3@example.com");

      const stats = leadsRateLimiter.getStats();
      expect(stats.totalKeys).toBe(3);
      expect(stats.entries.length).toBe(3);
    });

    it("should provide detailed entry stats", () => {
      const email = "test@example.com";
      leadsRateLimiter.isAllowed(email);
      leadsRateLimiter.isAllowed(email);

      const stats = leadsRateLimiter.getStats();
      const entry = stats.entries[0];

      expect(entry.key).toBe(email);
      expect(entry.count).toBe(2);
      expect(entry.remaining).toBe(3);
      expect(entry.resetIn).toBeGreaterThan(0);
    });
  });
});
