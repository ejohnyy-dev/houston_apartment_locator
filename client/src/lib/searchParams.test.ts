import { describe, expect, it } from "vitest";
import {
  DEFAULT_FILTER_STATE,
  RENT_RANGE_DEFAULT,
  decodeSearchFilters,
  encodeSearchFilters,
  type SearchFilterState,
} from "./searchParams";

function state(overrides: Partial<SearchFilterState> = {}): SearchFilterState {
  return { ...DEFAULT_FILTER_STATE, rentRange: [...RENT_RANGE_DEFAULT], ...overrides };
}

describe("encodeSearchFilters", () => {
  it("returns an empty string for default filters", () => {
    expect(encodeSearchFilters(state())).toBe("");
  });

  it("encodes only non-default values", () => {
    const qs = encodeSearchFilters(
      state({ neighborhood: "Katy", bedrooms: "2", rentRange: [0, 1800] })
    );
    expect(qs).toBe("area=Katy&beds=2&max=1800");
  });

  it("encodes search text, min rent, and sort", () => {
    const qs = encodeSearchFilters(
      state({ searchText: "pool special", rentRange: [1000, 15000], sortBy: "price-asc" })
    );
    const params = new URLSearchParams(qs);
    expect(params.get("q")).toBe("pool special");
    expect(params.get("min")).toBe("1000");
    expect(params.get("max")).toBeNull();
    expect(params.get("sort")).toBe("price-asc");
  });

  it("omits invalid bedroom values", () => {
    expect(encodeSearchFilters(state({ bedrooms: "7" }))).toBe("");
  });
});

describe("decodeSearchFilters", () => {
  it("returns defaults for an empty query string", () => {
    expect(decodeSearchFilters("")).toEqual(state());
    expect(decodeSearchFilters("?")).toEqual(state());
  });

  it("parses a full query string with or without the leading ?", () => {
    const expected = state({
      neighborhood: "Katy",
      bedrooms: "2",
      rentRange: [1000, 1800],
      searchText: "pool",
      sortBy: "price-desc",
    });
    expect(decodeSearchFilters("?area=Katy&beds=2&min=1000&max=1800&q=pool&sort=price-desc")).toEqual(expected);
    expect(decodeSearchFilters("area=Katy&beds=2&min=1000&max=1800&q=pool&sort=price-desc")).toEqual(expected);
  });

  it("round-trips an encoded state", () => {
    const original = state({
      neighborhood: "Sugar Land",
      bedrooms: "1",
      rentRange: [500, 2200],
      searchText: "gym",
      sortBy: "price-asc",
    });
    expect(decodeSearchFilters(encodeSearchFilters(original))).toEqual(original);
  });

  it("falls back to defaults for malformed values", () => {
    const decoded = decodeSearchFilters("?beds=99&min=abc&max=xyz&sort=hacked");
    expect(decoded.bedrooms).toBe("");
    expect(decoded.rentRange).toEqual(RENT_RANGE_DEFAULT);
    expect(decoded.sortBy).toBe("recommended");
  });

  it("clamps rent values to the slider bounds and swaps inverted ranges", () => {
    expect(decodeSearchFilters("?min=-500&max=999999").rentRange).toEqual([0, 15000]);
    expect(decodeSearchFilters("?min=3000&max=1000").rentRange).toEqual([1000, 3000]);
  });
});
