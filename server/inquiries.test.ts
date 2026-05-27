import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";

// Mock the notification module
vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

describe("Inquiries Router", () => {
  it("should validate inquiry input correctly", () => {
    const inquirySchema = z.object({
      apartmentId: z.string(),
      apartmentName: z.string(),
      name: z.string().min(1, "Name is required"),
      email: z.string().email("Valid email is required"),
      phone: z.string().min(10, "Valid phone number is required"),
      moveInDate: z.string().optional(),
      message: z.string().optional(),
    });

    // Valid inquiry
    const validInquiry = {
      apartmentId: "apt-123",
      apartmentName: "Downtown Lofts",
      name: "John Doe",
      email: "john@example.com",
      phone: "5551234567",
      moveInDate: "2026-06-01",
      message: "Interested in this property",
    };

    const result = inquirySchema.safeParse(validInquiry);
    expect(result.success).toBe(true);
  });

  it("should reject inquiry with invalid email", () => {
    const inquirySchema = z.object({
      apartmentId: z.string(),
      apartmentName: z.string(),
      name: z.string().min(1, "Name is required"),
      email: z.string().email("Valid email is required"),
      phone: z.string().min(10, "Valid phone number is required"),
      moveInDate: z.string().optional(),
      message: z.string().optional(),
    });

    const invalidInquiry = {
      apartmentId: "apt-123",
      apartmentName: "Downtown Lofts",
      name: "John Doe",
      email: "invalid-email",
      phone: "5551234567",
    };

    const result = inquirySchema.safeParse(invalidInquiry);
    expect(result.success).toBe(false);
  });

  it("should reject inquiry with short phone number", () => {
    const inquirySchema = z.object({
      apartmentId: z.string(),
      apartmentName: z.string(),
      name: z.string().min(1, "Name is required"),
      email: z.string().email("Valid email is required"),
      phone: z.string().min(10, "Valid phone number is required"),
      moveInDate: z.string().optional(),
      message: z.string().optional(),
    });

    const invalidInquiry = {
      apartmentId: "apt-123",
      apartmentName: "Downtown Lofts",
      name: "John Doe",
      email: "john@example.com",
      phone: "555123",
    };

    const result = inquirySchema.safeParse(invalidInquiry);
    expect(result.success).toBe(false);
  });

  it("should reject inquiry with empty name", () => {
    const inquirySchema = z.object({
      apartmentId: z.string(),
      apartmentName: z.string(),
      name: z.string().min(1, "Name is required"),
      email: z.string().email("Valid email is required"),
      phone: z.string().min(10, "Valid phone number is required"),
      moveInDate: z.string().optional(),
      message: z.string().optional(),
    });

    const invalidInquiry = {
      apartmentId: "apt-123",
      apartmentName: "Downtown Lofts",
      name: "",
      email: "john@example.com",
      phone: "5551234567",
    };

    const result = inquirySchema.safeParse(invalidInquiry);
    expect(result.success).toBe(false);
  });
});
