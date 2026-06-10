import { describe, expect, it } from "vitest";
import {
  matchesSavedSearch,
  matchingListingIds,
  parseSavedFilters,
  type MatchableApartment,
} from "./savedSearchMatcher";

function apt(overrides: Partial<MatchableApartment> = {}): MatchableApartment {
  return {
    id: "a1",
    neighborhood: "Katy",
    bedrooms: 2,
    rentMin: 1500,
    rentMax: 1800,
    ...overrides,
  };
}

describe("matchesSavedSearch", () => {
  it("matches everything with empty filters", () => {
    expect(matchesSavedSearch(apt(), {})).toBe(true);
    expect(matchesSavedSearch(apt({ rentMin: null }), {})).toBe(true);
  });

  it("filters by neighborhood exactly", () => {
    expect(matchesSavedSearch(apt(), { neighborhood: "Katy" })).toBe(true);
    expect(matchesSavedSearch(apt(), { neighborhood: "Pearland" })).toBe(false);
  });

  it("filters by exact bedrooms, with 4 meaning four or more", () => {
    expect(matchesSavedSearch(apt({ bedrooms: 2 }), { bedrooms: "2" })).toBe(true);
    expect(matchesSavedSearch(apt({ bedrooms: 3 }), { bedrooms: "2" })).toBe(false);
    expect(matchesSavedSearch(apt({ bedrooms: 0 }), { bedrooms: "0" })).toBe(true);
    expect(matchesSavedSearch(apt({ bedrooms: 5 }), { bedrooms: "4" })).toBe(true);
    expect(matchesSavedSearch(apt({ bedrooms: 3 }), { bedrooms: "4" })).toBe(false);
  });

  it("filters by rent range", () => {
    expect(matchesSavedSearch(apt({ rentMin: 1500 }), { minRent: 1000, maxRent: 2000 })).toBe(true);
    expect(matchesSavedSearch(apt({ rentMin: 900 }), { minRent: 1000 })).toBe(false);
    expect(matchesSavedSearch(apt({ rentMin: 2500 }), { maxRent: 2000 })).toBe(false);
  });

  it("uses per-bedroom price splits when that size is targeted", () => {
    const listing = apt({ rentMin: 2500, price1brMin: 1200 });
    expect(matchesSavedSearch(listing, { bedrooms: "1", maxRent: 1500 })).toBe(false); // bedrooms=2
    const oneBr = apt({ bedrooms: 1, rentMin: 2500, price1brMin: 1200 });
    expect(matchesSavedSearch(oneBr, { bedrooms: "1", maxRent: 1500 })).toBe(true);
  });

  it("keeps unpriced listings unless a minimum rent is set", () => {
    const unpriced = apt({ rentMin: null, rentMax: null });
    expect(matchesSavedSearch(unpriced, { maxRent: 2000 })).toBe(true);
    expect(matchesSavedSearch(unpriced, { minRent: 500 })).toBe(false);
  });

  it("requires every search term to match (AND semantics)", () => {
    const listing = apt({ special: "One month free", description: "Pool and gym" });
    expect(matchesSavedSearch(listing, { searchText: "katy pool" })).toBe(true);
    expect(matchesSavedSearch(listing, { searchText: "katy garage" })).toBe(false);
  });

  it("matches bedroom synonyms in search text", () => {
    expect(matchesSavedSearch(apt({ bedrooms: 0 }), { searchText: "studio" })).toBe(true);
    expect(matchesSavedSearch(apt({ bedrooms: 2 }), { searchText: "2br" })).toBe(true);
  });
});

describe("matchingListingIds", () => {
  it("returns matching ids as strings", () => {
    const listings = [
      apt({ id: 1, neighborhood: "Katy" }),
      apt({ id: 2, neighborhood: "Pearland" }),
      apt({ id: "db-3", neighborhood: "Katy" }),
    ];
    expect(matchingListingIds(listings, { neighborhood: "Katy" })).toEqual(["1", "db-3"]);
  });
});

describe("parseSavedFilters", () => {
  it("parses valid JSON", () => {
    expect(parseSavedFilters('{"neighborhood":"Katy","maxRent":2000}')).toEqual({
      neighborhood: "Katy",
      maxRent: 2000,
    });
  });

  it("returns empty filters for malformed data", () => {
    expect(parseSavedFilters("not json")).toEqual({});
    expect(parseSavedFilters('"a string"')).toEqual({});
  });
});
