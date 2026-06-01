import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { generateApartmentInventoryReport } from "../reports/apartmentInventory";
import { generateLeadsReport, type LeadRecord } from "../reports/leadsReport";
import { getRentCastDatabaseApartments } from "../rentcastDatabase";
import { getDb } from "../db";
import { inquiries } from "../../drizzle/schema";

/**
 * Reports Router
 * 
 * Generates professional Excel reports for:
 * - Apartment inventory
 * - Lead capture data
 * 
 * Returns base64-encoded Excel files for download
 */
export const reportsRouter = router({
  /**
   * Generate apartment inventory report
   * Includes all properties with pricing, photos, neighborhoods
   */
  apartmentInventory: publicProcedure.query(async () => {
    try {
      // Get all apartments from RentCast + local database
      const apartments = await getRentCastDatabaseApartments();
      
      if (apartments.length === 0) {
        throw new Error("No apartments found to generate report");
      }
      
      // Generate Excel file
      const buffer = await generateApartmentInventoryReport(apartments);
      
      // Return as base64 for download
      return {
        success: true,
        filename: `apartment-inventory-${new Date().toISOString().split("T")[0]}.xlsx`,
        data: buffer.toString("base64"),
        size: buffer.length,
      };
    } catch (error) {
      console.error("Failed to generate apartment inventory report:", error);
      throw new Error(
        error instanceof Error ? error.message : "Failed to generate report"
      );
    }
  }),

  /**
   * Generate leads report
   * Includes all inquiries with contact info and apartment details
   */
  leadsReport: publicProcedure.query(async () => {
    try {
      const db = await getDb();
      
      if (!db) {
        throw new Error("Database not available");
      }
      
      // Fetch all inquiries
      const inquiryRecords = await db.select().from(inquiries);
      
      // Convert to LeadRecord format
      const leads: LeadRecord[] = inquiryRecords.map((inquiry) => ({
        id: inquiry.id?.toString() || "",
        name: inquiry.name || "",
        email: inquiry.email || "",
        phone: inquiry.phone || "",
        apartmentName: inquiry.apartmentName || "",
        moveInDate: inquiry.moveInDate ? String(inquiry.moveInDate).split("T")[0] : undefined,
        message: inquiry.message || undefined,
        createdAt: inquiry.createdAt || new Date(),
        source: inquiry.source || "website",
      }));
      
      if (leads.length === 0) {
        throw new Error("No leads found to generate report");
      }
      
      // Generate Excel file
      const buffer = await generateLeadsReport(leads);
      
      // Return as base64 for download
      return {
        success: true,
        filename: `leads-report-${new Date().toISOString().split("T")[0]}.xlsx`,
        data: buffer.toString("base64"),
        size: buffer.length,
      };
    } catch (error) {
      console.error("Failed to generate leads report:", error);
      throw new Error(
        error instanceof Error ? error.message : "Failed to generate report"
      );
    }
  }),

  /**
   * Get report generation status
   * Useful for checking if reports are available
   */
  status: publicProcedure.query(async () => {
    try {
      const apartments = await getRentCastDatabaseApartments();
      const db = await getDb();
      
      let leadCount = 0;
      if (db) {
        const result = await db.select().from(inquiries);
        leadCount = result.length;
      }
      
      return {
        apartmentInventory: {
          available: apartments.length > 0,
          count: apartments.length,
        },
        leadsReport: {
          available: leadCount > 0,
          count: leadCount,
        },
      };
    } catch (error) {
      console.error("Failed to get report status:", error);
      return {
        apartmentInventory: { available: false, count: 0 },
        leadsReport: { available: false, count: 0 },
      };
    }
  }),
});
