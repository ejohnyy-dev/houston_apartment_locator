import { describe, it, expect } from "vitest";
import {
  filterApartmentsByQualification,
  calculateMatchScore,
  sortByMatchScore,
  type ApartmentData,
} from "../client/src/lib/qualificationFilter";
import { type QualificationData } from "../client/src/components/QualificationPrompt";

describe("Qualification Filtering", () => {
  const mockApartments: ApartmentData[] = [
    {
      id: 1,
      name: "Downtown Lofts",
      neighborhood: "Downtown",
      bedrooms: 2,
      bathrooms: 2,
      rentMin: 1500,
      rentMax: 1800,
    },
    {
      id: 2,
      name: "Midtown Modern",
      neighborhood: "Midtown",
      bedrooms: 1,
      bathrooms: 1,
      rentMin: 1200,
      rentMax: 1400,
    },
    {
      id: 3,
      name: "Upper Kirby Luxury",
      neighborhood: "Upper Kirby",
      bedrooms: 3,
      bathrooms: 2.5,
      rentMin: 2500,
      rentMax: 3000,
    },
    {
      id: 4,
      name: "Montrose Apartment",
      neighborhood: "Montrose",
      bedrooms: 2,
      bathrooms: 1,
      rentMin: 1300,
      rentMax: 1600,
    },
  ];

  const mockQualification: QualificationData = {
    preferredAreas: ["Downtown", "Midtown"],
    moveInTimeline: "immediate",
    minBedrooms: 1,
    maxBedrooms: 2,
    minBathrooms: 1,
    maxBathrooms: 2,
    minBudget: 1000,
    maxBudget: 2000,
    pets: { dogs: false, cats: false, other: "" },
  };

  describe("filterApartmentsByQualification", () => {
    it("should filter apartments by preferred neighborhoods", () => {
      const filtered = filterApartmentsByQualification(
        mockApartments,
        mockQualification
      );
      expect(filtered.length).toBe(2);
      expect(filtered.every((apt) =>
        mockQualification.preferredAreas.includes(apt.neighborhood)
      )).toBe(true);
    });

    it("should filter apartments by bedroom count", () => {
      const filtered = filterApartmentsByQualification(
        mockApartments,
        mockQualification
      );
      expect(filtered.every((apt) =>
        apt.bedrooms &&
        apt.bedrooms >= mockQualification.minBedrooms &&
        apt.bedrooms <= mockQualification.maxBedrooms
      )).toBe(true);
    });

    it("should filter apartments by budget", () => {
      const filtered = filterApartmentsByQualification(
        mockApartments,
        mockQualification
      );
      expect(filtered.every((apt) => {
        const rentMin = apt.rentMin ? parseInt(String(apt.rentMin)) : 0;
        const rentMax = apt.rentMax ? parseInt(String(apt.rentMax)) : 0;
        const avgRent = rentMax > 0 ? (rentMin + rentMax) / 2 : rentMin;
        return (
          avgRent >= mockQualification.minBudget &&
          avgRent <= mockQualification.maxBudget
        );
      })).toBe(true);
    });

    it("should return empty array when no apartments match", () => {
      const strictQualification: QualificationData = {
        ...mockQualification,
        preferredAreas: ["NonExistent"],
      };
      const filtered = filterApartmentsByQualification(
        mockApartments,
        strictQualification
      );
      expect(filtered.length).toBe(0);
    });
  });

  describe("calculateMatchScore", () => {
    it("should calculate perfect match score", () => {
      const apartment = mockApartments[0]; // Downtown Lofts
      const score = calculateMatchScore(apartment, mockQualification);
      expect(score).toBeGreaterThan(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it("should give higher score for neighborhood match", () => {
      const downtown = mockApartments[0]; // Downtown (preferred)
      const upperKirby = mockApartments[2]; // Upper Kirby (not preferred)

      const scoreDowntown = calculateMatchScore(downtown, mockQualification);
      const scoreUpperKirby = calculateMatchScore(
        upperKirby,
        mockQualification
      );

      expect(scoreDowntown).toBeGreaterThan(scoreUpperKirby);
    });

    it("should return 0 for apartments with no matching criteria", () => {
      const noMatch: ApartmentData = {
        id: 99,
        name: "No Match",
        neighborhood: "Unknown",
        bedrooms: 5,
        bathrooms: 4,
        rentMin: 5000,
        rentMax: 6000,
      };
      const score = calculateMatchScore(noMatch, mockQualification);
      expect(score).toBe(0);
    });
  });

  describe("sortByMatchScore", () => {
    it("should sort apartments by match score in descending order", () => {
      const sorted = sortByMatchScore(mockApartments, mockQualification);
      for (let i = 0; i < sorted.length - 1; i++) {
        const currentScore = calculateMatchScore(sorted[i], mockQualification);
        const nextScore = calculateMatchScore(sorted[i + 1], mockQualification);
        expect(currentScore).toBeGreaterThanOrEqual(nextScore);
      }
    });

    it("should not modify original array", () => {
      const original = [...mockApartments];
      sortByMatchScore(mockApartments, mockQualification);
      expect(mockApartments).toEqual(original);
    });

    it("should return all apartments", () => {
      const sorted = sortByMatchScore(mockApartments, mockQualification);
      expect(sorted.length).toBe(mockApartments.length);
    });
  });

  describe("Edge cases", () => {
    it("should handle apartments with null rent values", () => {
      const apartmentsWithNull: ApartmentData[] = [
        {
          id: 1,
          name: "Test",
          neighborhood: "Downtown",
          bedrooms: 2,
          bathrooms: 1,
          rentMin: null,
          rentMax: null,
        },
      ];
      const filtered = filterApartmentsByQualification(
        apartmentsWithNull,
        mockQualification
      );
      expect(filtered.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle apartments with missing neighborhood", () => {
      const apartmentsNoNeighborhood: ApartmentData[] = [
        {
          id: 1,
          name: "Test",
          bedrooms: 2,
          bathrooms: 1,
          rentMin: 1500,
          rentMax: 1800,
        },
      ];
      const filtered = filterApartmentsByQualification(
        apartmentsNoNeighborhood,
        mockQualification
      );
      expect(Array.isArray(filtered)).toBe(true);
    });

    it("should handle empty apartment list", () => {
      const filtered = filterApartmentsByQualification([], mockQualification);
      expect(filtered.length).toBe(0);
    });
  });
});
