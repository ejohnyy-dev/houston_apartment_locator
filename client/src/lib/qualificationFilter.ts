import { QualificationData } from "@/components/QualificationPrompt";

export interface ApartmentData {
  id: string | number;
  name: string;
  neighborhood?: string;
  bedrooms?: number;
  bathrooms?: number | string;
  rentMin?: number | string | null;
  rentMax?: number | string | null;
  [key: string]: any;
}

/**
 * Parse bedroom value from qualification
 */
function parseBedroomRange(value: string): { min: number; max: number } {
  switch (value) {
    case "studio":
      return { min: 0, max: 0 };
    case "1bed":
      return { min: 1, max: 1 };
    case "2bed":
      return { min: 2, max: 2 };
    case "3bed":
      return { min: 3, max: 3 };
    case "4plus":
      return { min: 4, max: 10 };
    default:
      return { min: 0, max: 10 };
  }
}

/**
 * Parse bathroom value from qualification
 */
function parseBathroomRange(value: string): { min: number; max: number } {
  switch (value) {
    case "1bath":
      return { min: 1, max: 1.4 };
    case "1.5bath":
      return { min: 1.5, max: 1.9 };
    case "2bath":
      return { min: 2, max: 2.4 };
    case "2.5plus":
      return { min: 2.5, max: 10 };
    default:
      return { min: 0, max: 10 };
  }
}

/**
 * Parse budget value from qualification
 * Handles both old format (string like "1000-1500") and new format ("$min-$max")
 */
function parseBudgetRange(value: string | { min: number | null; max: number }): { min: number; max: number } {
  // Handle new BudgetRangeSelector format
  if (typeof value === 'object' && value !== null) {
    return {
      min: value.min ?? 0,
      max: value.max ?? 100000,
    };
  }

  // Handle new string format from BudgetRangeSelector ("$0-$2400")
  if (typeof value === 'string' && value.startsWith('$')) {
    const parts = value.split('-');
    if (parts.length === 2) {
      const min = parseInt(parts[0].replace('$', ''), 10) || 0;
      const max = parseInt(parts[1].replace('$', ''), 10) || 100000;
      return { min, max };
    }
  }

  // Handle old format (legacy)
  switch (value) {
    case "under-1000":
      return { min: 0, max: 999 };
    case "1000-1500":
      return { min: 1000, max: 1500 };
    case "1500-2000":
      return { min: 1500, max: 2000 };
    case "2000-2500":
      return { min: 2000, max: 2500 };
    case "2500-3000":
      return { min: 2500, max: 3000 };
    case "3000-plus":
      return { min: 3000, max: 100000 };
    default:
      return { min: 0, max: 100000 };
  }
}

/**
 * Filter apartments based on user qualification preferences
 */
export function filterApartmentsByQualification(
  apartments: ApartmentData[],
  qualification: QualificationData
): ApartmentData[] {
  return apartments.filter((apt) => {
    // Filter by preferred areas/neighborhoods
    if (
      qualification.preferredAreas.length > 0 &&
      apt.neighborhood &&
      !qualification.preferredAreas.includes(apt.neighborhood)
    ) {
      return false;
    }

    // Filter by bedrooms
    if (qualification.bedrooms) {
      const { min: minBed, max: maxBed } = parseBedroomRange(qualification.bedrooms);
      const bedrooms = apt.bedrooms ? parseInt(String(apt.bedrooms)) : 0;
      if (bedrooms < minBed || bedrooms > maxBed) {
        return false;
      }
    }

    // Filter by bathrooms
    if (qualification.bathrooms) {
      const { min: minBath, max: maxBath } = parseBathroomRange(qualification.bathrooms);
      const bathrooms = apt.bathrooms ? parseFloat(String(apt.bathrooms)) : 0;
      if (bathrooms < minBath || bathrooms > maxBath) {
        return false;
      }
    }

    // Filter by rent budget
    if (qualification.budget) {
      const { min: minBudget, max: maxBudget } = parseBudgetRange(qualification.budget);
      const rentMin = apt.rentMin ? parseInt(String(apt.rentMin)) : 0;
      const rentMax = apt.rentMax ? parseInt(String(apt.rentMax)) : 0;
      const avgRent = rentMax > 0 ? (rentMin + rentMax) / 2 : rentMin;

      if (avgRent < minBudget || avgRent > maxBudget) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Calculate match score for an apartment based on qualification
 * Returns 0-100 score
 */
export function calculateMatchScore(
  apartment: ApartmentData,
  qualification: QualificationData
): number {
  let score = 0;
  let maxScore = 0;

  // Neighborhood match (30 points)
  maxScore += 30;
  if (
    apartment.neighborhood &&
    qualification.preferredAreas.includes(apartment.neighborhood)
  ) {
    score += 30;
  }

  // Bedrooms match (20 points)
  maxScore += 20;
  if (qualification.bedrooms) {
    const { min: minBed, max: maxBed } = parseBedroomRange(qualification.bedrooms);
    const bedrooms = apartment.bedrooms ? parseInt(String(apartment.bedrooms)) : 0;
    if (bedrooms >= minBed && bedrooms <= maxBed) {
      score += 20;
    }
  }

  // Bathrooms match (20 points)
  maxScore += 20;
  if (qualification.bathrooms) {
    const { min: minBath, max: maxBath } = parseBathroomRange(qualification.bathrooms);
    const bathrooms = apartment.bathrooms ? parseFloat(String(apartment.bathrooms)) : 0;
    if (bathrooms >= minBath && bathrooms <= maxBath) {
      score += 20;
    }
  }

  // Rent match (30 points)
  maxScore += 30;
  if (qualification.budget) {
    const { min: minBudget, max: maxBudget } = parseBudgetRange(qualification.budget);
    const rentMin = apartment.rentMin ? parseInt(String(apartment.rentMin)) : 0;
    const rentMax = apartment.rentMax ? parseInt(String(apartment.rentMax)) : 0;
    const avgRent = rentMax > 0 ? (rentMin + rentMax) / 2 : rentMin;

    if (avgRent >= minBudget && avgRent <= maxBudget) {
      score += 30;
    }
  }

  return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
}

/**
 * Sort apartments by match score
 */
export function sortByMatchScore(
  apartments: ApartmentData[],
  qualification: QualificationData
): ApartmentData[] {
  return [...apartments].sort((a, b) => {
    const scoreA = calculateMatchScore(a, qualification);
    const scoreB = calculateMatchScore(b, qualification);
    return scoreB - scoreA;
  });
}
