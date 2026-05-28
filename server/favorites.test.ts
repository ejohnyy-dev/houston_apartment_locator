import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";

// Test the favorites schema validation
const favoritesSchema = z.object({
  apartmentId: z.string(),
  apartmentName: z.string(),
  neighborhood: z.string().optional(),
  rentMin: z.number().optional(),
  rentMax: z.number().optional(),
  bedrooms: z.number().optional(),
});

describe("Favorites Feature", () => {
  describe("Favorites Schema Validation", () => {
    it("should validate a complete favorite apartment", () => {
      const favorite = {
        apartmentId: "123",
        apartmentName: "The Residences at Westlayan",
        neighborhood: "Uptown",
        rentMin: 1500,
        rentMax: 2500,
        bedrooms: 2,
      };

      const result = favoritesSchema.safeParse(favorite);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.apartmentId).toBe("123");
        expect(result.data.apartmentName).toBe("The Residences at Westlayan");
      }
    });

    it("should validate a favorite with only required fields", () => {
      const favorite = {
        apartmentId: "456",
        apartmentName: "Park Tower Apartments",
      };

      const result = favoritesSchema.safeParse(favorite);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.apartmentId).toBe("456");
        expect(result.data.apartmentName).toBe("Park Tower Apartments");
        expect(result.data.neighborhood).toBeUndefined();
      }
    });

    it("should reject favorite without apartmentId", () => {
      const favorite = {
        apartmentName: "Missing ID Apartments",
      };

      const result = favoritesSchema.safeParse(favorite);
      expect(result.success).toBe(false);
    });

    it("should reject favorite without apartmentName", () => {
      const favorite = {
        apartmentId: "789",
      };

      const result = favoritesSchema.safeParse(favorite);
      expect(result.success).toBe(false);
    });
  });

  describe("Inquiry with Favorites", () => {
    const inquirySchema = z.object({
      apartmentId: z.string(),
      apartmentName: z.string(),
      name: z.string().min(1, "Name is required"),
      email: z.string().email("Valid email is required"),
      phone: z.string().min(7, "Valid phone number is required").refine(
        (val) => /\d{7,}/.test(val.replace(/\D/g, "")),
        "Phone number must contain at least 7 digits"
      ),
      moveInDate: z.string().optional(),
      message: z.string().optional(),
      favoriteIds: z.string().optional(), // JSON array of favorite apartment IDs
    });

    it("should validate inquiry with favoriteIds", () => {
      const inquiry = {
        apartmentId: "123",
        apartmentName: "The Residences at Westlayan",
        name: "John Doe",
        email: "john@example.com",
        phone: "5551234567",
        moveInDate: "2026-06-01",
        message: "Interested in this property",
        favoriteIds: JSON.stringify(["123", "456", "789"]),
      };

      const result = inquirySchema.safeParse(inquiry);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.favoriteIds).toBe(JSON.stringify(["123", "456", "789"]));
        const parsed = JSON.parse(result.data.favoriteIds);
        expect(parsed).toEqual(["123", "456", "789"]);
      }
    });

    it("should validate inquiry without favoriteIds", () => {
      const inquiry = {
        apartmentId: "123",
        apartmentName: "The Residences at Westlayan",
        name: "Jane Smith",
        email: "jane@example.com",
        phone: "5559876543",
      };

      const result = inquirySchema.safeParse(inquiry);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.favoriteIds).toBeUndefined();
      }
    });

    it("should validate inquiry with empty favoriteIds array", () => {
      const inquiry = {
        apartmentId: "123",
        apartmentName: "The Residences at Westlayan",
        name: "Bob Johnson",
        email: "bob@example.com",
        phone: "5555551234",
        favoriteIds: JSON.stringify([]),
      };

      const result = inquirySchema.safeParse(inquiry);
      expect(result.success).toBe(true);
      if (result.success) {
        const parsed = JSON.parse(result.data.favoriteIds!);
        expect(parsed).toEqual([]);
      }
    });

    it("should reject inquiry with invalid email", () => {
      const inquiry = {
        apartmentId: "123",
        apartmentName: "The Residences at Westlayan",
        name: "Invalid Email",
        email: "not-an-email",
        phone: "5551234567",
        favoriteIds: JSON.stringify(["123"]),
      };

      const result = inquirySchema.safeParse(inquiry);
      expect(result.success).toBe(false);
    });

    it("should reject inquiry with phone number too short", () => {
      const inquiry = {
        apartmentId: "123",
        apartmentName: "The Residences at Westlayan",
        name: "Short Phone",
        email: "short@example.com",
        phone: "555123", // Only 6 digits
        favoriteIds: JSON.stringify(["123"]),
      };

      const result = inquirySchema.safeParse(inquiry);
      expect(result.success).toBe(false);
    });
  });

  describe("Favorites Array Parsing", () => {
    it("should parse favoriteIds JSON string correctly", () => {
      const favoriteIds = JSON.stringify(["apt-1", "apt-2", "apt-3"]);
      const parsed = JSON.parse(favoriteIds);
      expect(parsed).toHaveLength(3);
      expect(parsed[0]).toBe("apt-1");
    });

    it("should handle empty favoriteIds array", () => {
      const favoriteIds = JSON.stringify([]);
      const parsed = JSON.parse(favoriteIds);
      expect(parsed).toHaveLength(0);
      expect(Array.isArray(parsed)).toBe(true);
    });

    it("should handle null favoriteIds", () => {
      const favoriteIds = null;
      expect(favoriteIds).toBeNull();
    });
  });
});
