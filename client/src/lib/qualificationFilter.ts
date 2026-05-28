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
    const bedrooms = apt.bedrooms ? parseInt(String(apt.bedrooms)) : 0;
    if (bedrooms < qualification.minBedrooms || bedrooms > qualification.maxBedrooms) {
      return false;
    }

    // Filter by bathrooms
    const bathrooms = apt.bathrooms ? parseFloat(String(apt.bathrooms)) : 0;
    if (bathrooms < qualification.minBathrooms || bathrooms > qualification.maxBathrooms) {
      return false;
    }

    // Filter by rent budget
    const rentMin = apt.rentMin ? parseInt(String(apt.rentMin)) : 0;
    const rentMax = apt.rentMax ? parseInt(String(apt.rentMax)) : 0;
    const avgRent = rentMax > 0 ? (rentMin + rentMax) / 2 : rentMin;

    if (avgRent < qualification.minBudget || avgRent > qualification.maxBudget) {
      return false;
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
  const bedrooms = apartment.bedrooms ? parseInt(String(apartment.bedrooms)) : 0;
  if (
    bedrooms >= qualification.minBedrooms &&
    bedrooms <= qualification.maxBedrooms
  ) {
    score += 20;
  }

  // Bathrooms match (20 points)
  maxScore += 20;
  const bathrooms = apartment.bathrooms ? parseFloat(String(apartment.bathrooms)) : 0;
  if (
    bathrooms >= qualification.minBathrooms &&
    bathrooms <= qualification.maxBathrooms
  ) {
    score += 20;
  }

  // Rent match (30 points)
  maxScore += 30;
  const rentMin = apartment.rentMin ? parseInt(String(apartment.rentMin)) : 0;
  const rentMax = apartment.rentMax ? parseInt(String(apartment.rentMax)) : 0;
  const avgRent = rentMax > 0 ? (rentMin + rentMax) / 2 : rentMin;

  if (avgRent >= qualification.minBudget && avgRent <= qualification.maxBudget) {
    score += 30;
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
