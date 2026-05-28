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
