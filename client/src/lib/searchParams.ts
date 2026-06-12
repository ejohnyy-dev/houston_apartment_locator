export const RENT_RANGE_DEFAULT: [number, number] = [0, 15000];

export type SortOption = "recommended" | "price-asc" | "price-desc";

export interface SearchFilterState {
  neighborhood: string;
  bedrooms: string;
  rentRange: [number, number];
  searchText: string;
  sortBy: SortOption;
}

export const DEFAULT_FILTER_STATE: SearchFilterState = {
  neighborhood: "",
  bedrooms: "",
  rentRange: RENT_RANGE_DEFAULT,
  searchText: "",
  sortBy: "recommended",
};

const BEDROOM_VALUES = new Set(["0", "1", "2", "3", "4"]);
const SORT_VALUES = new Set<SortOption>(["recommended", "price-asc", "price-desc"]);

function clampRent(value: number): number {
  if (!Number.isFinite(value)) return RENT_RANGE_DEFAULT[0];
  return Math.min(Math.max(Math.round(value), RENT_RANGE_DEFAULT[0]), RENT_RANGE_DEFAULT[1]);
}

export function encodeSearchFilters(state: SearchFilterState): string {
  const params = new URLSearchParams();
  if (state.neighborhood) params.set("area", state.neighborhood);
  if (state.bedrooms && BEDROOM_VALUES.has(state.bedrooms)) params.set("beds", state.bedrooms);
  if (state.rentRange[0] !== RENT_RANGE_DEFAULT[0]) params.set("min", String(state.rentRange[0]));
  if (state.rentRange[1] !== RENT_RANGE_DEFAULT[1]) params.set("max", String(state.rentRange[1]));
  if (state.searchText.trim()) params.set("q", state.searchText.trim());
  if (state.sortBy !== "recommended") params.set("sort", state.sortBy);
  return params.toString();
}

export function decodeSearchFilters(search: string): SearchFilterState {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  } catch {
    return { ...DEFAULT_FILTER_STATE };
  }

  const beds = params.get("beds") ?? "";
  const sort = params.get("sort") as SortOption | null;

  let min = clampRent(parseInt(params.get("min") ?? "", 10) || RENT_RANGE_DEFAULT[0]);
  let max = params.has("max")
    ? clampRent(parseInt(params.get("max") ?? "", 10) || RENT_RANGE_DEFAULT[1])
    : RENT_RANGE_DEFAULT[1];
  if (min > max) [min, max] = [max, min];

  return {
    neighborhood: params.get("area") ?? "",
    bedrooms: BEDROOM_VALUES.has(beds) ? beds : "",
    rentRange: [min, max],
    searchText: params.get("q") ?? "",
    sortBy: sort && SORT_VALUES.has(sort) ? sort : "recommended",
  };
}
