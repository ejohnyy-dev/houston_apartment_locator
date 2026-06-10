/**
 * Saved-search matching.
 *
 * Mirrors the /search page's client-side filter semantics so a saved search
 * alerts on exactly the listings the lead would see with those filters:
 * - neighborhood: exact match
 * - bedrooms: exact, except "4" which means four or more
 * - rent: bedroom-aware (1BR/2BR price splits when that size is targeted);
 *   unpriced listings stay visible unless a minimum rent is set
 * - searchText: every whitespace-separated term must appear (AND semantics)
 */

export interface SavedSearchFilters {
  neighborhood?: string;
  /** "0".."4" matching the search page's bedroom filter values */
  bedrooms?: string;
  minRent?: number;
  maxRent?: number;
  searchText?: string;
}

export interface MatchableApartment {
  id: string | number;
  neighborhood?: string | null;
  bedrooms?: number | null;
  rentMin?: number | string | null;
  rentMax?: number | string | null;
  price1brMin?: number | null;
  price2brMin?: number | null;
  description?: string | null;
  special?: string | null;
  availability?: string | null;
  [key: string]: any;
}

function toPrice(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const num = typeof value === "string" ? parseFloat(value) : value;
  return Number.isFinite(num) && num > 0 ? num : null;
}

function effectivePrice(apt: MatchableApartment, bedrooms?: string): number | null {
  if (bedrooms === "1") {
    const split = toPrice(apt.price1brMin);
    if (split !== null) return split;
  }
  if (bedrooms === "2") {
    const split = toPrice(apt.price2brMin);
    if (split !== null) return split;
  }
  return toPrice(apt.rentMin);
}

function matchesText(apt: MatchableApartment, searchText: string): boolean {
  const terms = searchText.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const bedrooms = apt.bedrooms ?? 0;
  const haystack = [
    apt.neighborhood,
    apt.description,
    apt.special,
    apt.availability,
    bedrooms === 0 ? "studio" : `${bedrooms} bed`,
    `${bedrooms}br ${bedrooms} beds ${bedrooms} bedroom`,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return terms.every(term => haystack.includes(term));
}

export function matchesSavedSearch(
  apt: MatchableApartment,
  filters: SavedSearchFilters
): boolean {
  if (filters.neighborhood && apt.neighborhood !== filters.neighborhood) return false;

  if (filters.bedrooms) {
    const target = parseInt(filters.bedrooms, 10);
    const bedrooms = apt.bedrooms ?? 0;
    if (!Number.isNaN(target)) {
      if (target === 4 ? bedrooms < 4 : bedrooms !== target) return false;
    }
  }

  const minRent = filters.minRent ?? 0;
  const price = effectivePrice(apt, filters.bedrooms);
  if (price !== null) {
    if (price < minRent) return false;
    if (filters.maxRent != null && price > filters.maxRent) return false;
  } else if (minRent > 0) {
    return false;
  }

  if (filters.searchText && !matchesText(apt, filters.searchText)) return false;

  return true;
}

/** Ids of all listings matching the saved search, as strings for stable diffing. */
export function matchingListingIds(
  apartments: MatchableApartment[],
  filters: SavedSearchFilters
): string[] {
  return apartments
    .filter(apt => matchesSavedSearch(apt, filters))
    .map(apt => String(apt.id));
}

/** Parse a stored filters JSON blob, tolerating malformed data. */
export function parseSavedFilters(json: string): SavedSearchFilters {
  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === "object") return parsed as SavedSearchFilters;
  } catch {
    /* fall through */
  }
  return {};
}
