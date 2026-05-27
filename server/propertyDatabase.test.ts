import { describe, it, expect } from "vitest";
import { queryPropertyDatabase } from "./propertyDatabase";

describe("Property Database Commission Filtering", () => {
  it("should filter out commission information from special field", async () => {
    const apartments = await queryPropertyDatabase();
    
    // Check that no apartment has commission in the special field
    const apartmentsWithCommission = apartments.filter(apt => {
      if (!apt.special) return false;
      return apt.special.toLowerCase().includes("commission");
    });
    
    expect(apartmentsWithCommission).toHaveLength(0);
  });

  it("should return apartments with valid special field (non-commission)", async () => {
    const apartments = await queryPropertyDatabase();
    
    // Verify that apartments still have other types of specials
    const apartmentsWithSpecials = apartments.filter(apt => apt.special && apt.special.length > 0);
    
    // Should have some apartments with specials
    if (apartmentsWithSpecials.length > 0) {
      apartmentsWithSpecials.forEach(apt => {
        expect(apt.special).toBeDefined();
        expect(apt.special).not.toMatch(/commission/i);
      });
    }
  });

  it("should return complete apartment data without commission exposure", async () => {
    const apartments = await queryPropertyDatabase();
    
    expect(apartments.length).toBeGreaterThan(0);
    
    apartments.forEach(apt => {
      // Verify essential fields are present
      expect(apt.id).toBeDefined();
      expect(apt.name).toBeDefined();
      expect(apt.neighborhood).toBeDefined();
      expect(apt.bedrooms).toBeGreaterThanOrEqual(0);
      expect(apt.bathrooms).toBeGreaterThanOrEqual(0);
      expect(apt.rentMin).toBeGreaterThanOrEqual(0);
      expect(apt.latitude).toBeDefined();
      expect(apt.longitude).toBeDefined();
      
      // Verify commission is not in special field
      if (apt.special) {
        expect(apt.special.toLowerCase()).not.toContain("commission");
      }
    });
  });
});
