import { QualificationData } from "@/components/QualificationPrompt";

export interface ApartmentData {
  id: string | number;
  name: string;
  neighborhood?: string;
  bedrooms?: number;
  bathrooms?: number | string;
  rentMin?: number | string | null;
  rentMax?: number | string | null;
  price1brMin?: number | null;
  price1brMax?: number | null;
  price2brMin?: number | null;
  price2brMax?: number | null;
  [key: string]: any;
}

export interface MatchResult {
  score: number;
  reasons: string[];
}

export type MatchTier = "great" | "good";

const BUDGET_WEIGHT = 40;
const BEDROOM_WEIGHT = 30;
const AREA_WEIGHT = 30;
const NEAR_BUDGET_TOLERANCE = 0.15;
const GREAT_MATCH_THRESHOLD = 75;
const GOOD_MATCH_THRESHOLD = 45;

function toPrice(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const num = typeof value === "string" ? parseFloat(value) : value;
  return Number.isFinite(num) && num > 0 ? num : null;
}

function parseBedroomRange(value: string): { min: number; max: number } {
  switch (value) {
    case "studio": return { min: 0, max: 0 };
    case "1bed": return { min: 1, max: 1 };
    case "2bed": return { min: 2, max: 2 };
    case "3bed": return { min: 3, max: 3 };
    case "4plus": return { min: 4, max: 10 };
    default: return { min: 0, max: 10 };
  }
}

export function parseBudgetRange(
  value: string | { min: number | null; max: number }
): { min: number; max: number } {
  if (typeof value === "object" && value !== null) {
    return { min: value.min ?? 0, max: value.max ?? 100000 };
  }
  if (typeof value === "string" && value.startsWith("$")) {
    const parts = value.split("-");
    if (parts.length === 2) {
      const min = parseInt(parts[0].replace("$", ""), 10) || 0;
      const max = parseInt(parts[1].replace("$", ""), 10) || 100000;
      return { min, max };
    }
  }
  switch (value) {
    case "under-1000": return { min: 0, max: 999 };
    case "1000-1500": return { min: 1000, max: 1500 };
    case "1500-2000": return { min: 1500, max: 2000 };
    case "2000-2500": return { min: 2000, max: 2500 };
    case "2500-3000": return { min: 2500, max: 3000 };
    case "3000-plus": return { min: 3000, max: 100000 };
    default: return { min: 0, max: 100000 };
  }
}

function listingPriceFor(apt: ApartmentData, bedroomPref: string): number | null {
  if (bedroomPref === "1bed") {
    const min = toPrice(apt.price1brMin);
    if (min !== null) return (min + (toPrice(apt.price1brMax) ?? min)) / 2;
  }
  if (bedroomPref === "2bed") {
    const min = toPrice(apt.price2brMin);
    if (min !== null) return (min + (toPrice(apt.price2brMax) ?? min)) / 2;
  }
  const min = toPrice(apt.rentMin);
  if (min === null) return null;
  return (min + (toPrice(apt.rentMax) ?? min)) / 2;
}

export function getMatchResult(
  apartment: ApartmentData,
  qualification: QualificationData
): MatchResult {
  let earned = 0;
  let possible = 0;
  const reasons: string[] = [];

  if (qualification.budget) {
    possible += BUDGET_WEIGHT;
    const { min: minBudget, max: maxBudget } = parseBudgetRange(qualification.budget);
    const price = listingPriceFor(apartment, qualification.bedrooms);
    if (price !== null) {
      if (price >= minBudget && price <= maxBudget) {
        earned += BUDGET_WEIGHT;
        reasons.push("Fits your budget");
      } else {
        const nearLow = minBudget > 0 && price >= minBudget * (1 - NEAR_BUDGET_TOLERANCE) && price < minBudget;
        const nearHigh = price > maxBudget && price <= maxBudget * (1 + NEAR_BUDGET_TOLERANCE);
        if (nearLow || nearHigh) {
          earned += BUDGET_WEIGHT / 2;
        }
      }
    }
  }

  if (qualification.bedrooms) {
    possible += BEDROOM_WEIGHT;
    const { min: minBed, max: maxBed } = parseBedroomRange(qualification.bedrooms);
    const bedrooms = apartment.bedrooms ?? 0;
    if (bedrooms >= minBed && bedrooms <= maxBed) {
      earned += BEDROOM_WEIGHT;
      reasons.push("Right bedroom count");
    } else if (bedrooms === minBed - 1 || bedrooms === maxBed + 1) {
      earned += BEDROOM_WEIGHT / 2;
    }
  }

  if (qualification.preferredAreas.length > 0) {
    possible += AREA_WEIGHT;
    if (
      apartment.neighborhood &&
      qualification.preferredAreas.includes(apartment.neighborhood)
    ) {
      earned += AREA_WEIGHT;
      reasons.push("Preferred area");
    }
  }

  return {
    score: possible > 0 ? Math.round((earned / possible) * 100) : 0,
    reasons,
  };
}

export function getMatchTier(score: number): MatchTier | null {
  if (score >= GREAT_MATCH_THRESHOLD) return "great";
  if (score >= GOOD_MATCH_THRESHOLD) return "good";
  return null;
}

export function rankApartments<T extends ApartmentData>(
  apartments: T[],
  qualification: QualificationData
): { apartment: T; match: MatchResult }[] {
  return apartments
    .map((apartment, index) => ({
      apartment,
      match: getMatchResult(apartment, qualification),
      index,
    }))
    .sort((a, b) => b.match.score - a.match.score || a.index - b.index)
    .map(({ apartment, match }) => ({ apartment, match }));
}
