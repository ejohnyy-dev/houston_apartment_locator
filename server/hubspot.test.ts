import { describe, expect, it } from "vitest";

describe("HubSpot API Integration", () => {
  it("should validate HubSpot token by making a test API call", async () => {
    const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;

    if (!token) {
      throw new Error("HUBSPOT_PRIVATE_APP_TOKEN is not set");
    }

    // Test with a simple GET request to verify the token is valid
    // This endpoint returns the authenticated app's info
    const response = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        limit: 1,
        after: 0,
      }),
    });

    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data).toHaveProperty("results");
  });
});
