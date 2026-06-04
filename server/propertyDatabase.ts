import fs from "fs/promises";
import path from "path";
import { createHash } from "crypto";

const DEFAULT_PROPERTY_CSV = process.env.PROPERTY_DATABASE_CSV ||
  path.join(process.cwd(), 'data', 'all-properties-enriched.csv');

export type PropertyFilters = {
  neighborhood?: string;
  minBedrooms?: number;
  maxBedrooms?: number;
  minRent?: number;
  maxRent?: number;
  // When true, use per-bedroom price fields instead of generic minRent/maxRent
  useBedroomPrices?: boolean;
  // NEW: full-text search
  searchText?: string;
  // NEW: require a special offer
  hasSpecial?: boolean;
  // NEW: pet-friendly filter
  petFriendly?: boolean;
};

type CsvRow = Record<string, string>;

export type PropertyApartment = {
  id: number;
  name: string;
  neighborhood: string;
  bedrooms: number;
  bathrooms: number;
  rentMin: number;
  rentMax: number | null;
  // Per-bedroom price splits (from merged CSV)
  price1brMin: number | null;
  price1brMax: number | null;
  price2brMin: number | null;
  price2brMax: number | null;
  description: string | null;
  latitude: number;
  longitude: number;
  photos: string[];
  special?: string | null;
  availability?: string | null;
  minSqft?: number | null;
  maxSqft?: number | null;
  builtYear?: number | null;
  managedBy?: string | null;
  photoCount?: number;
  // Contact info (from merged CSV)
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  // Address quality
  verifiedAddress?: string | null;
  addressMatchStatus?: string | null;
  // Enriched fields from Property_Data_Enriched.xlsx
  unitCount?: number | null;
  floorCount?: number | null;
  deposit?: string | null;
  fees?: string | null;
  leaseTerms?: string | null;
  officeHours?: string | null;
  schoolDistrict?: string | null;
  discounts?: string | null;
  qualificationRules?: string | null;
  acceptanceNotes?: string | null;
  floorplanPricing?: string | null;
  onsiteManager?: string | null;
  commission?: string | null;
  commissionTier?: string | null;
  // Amenity lists (parsed from Yes/No columns)
  exteriorAmenitiesList?: string[];
  interiorAmenitiesList?: string[];
  // NEW fields from search engine
  searchText?: string;
  dataQualityScore?: number;
  matchScore?: number;
  matchReasons?: string[];
};

type PropertyStats = {
  source: string | null;
  status?: "ready" | "disabled" | "error";
  totalProperties: number;
  eligibleProperties: number;
  rentcastMatches?: number;
  monthlyRequestLimit?: number;
  monthlyRequestsUsed?: number;
  monthlyRequestsRemaining?: number;
  withPricing: number;
  withPhotos: number;
  withSpecials: number;
  cities: number;
  lastUpdated: string | null;
};

let cache:
  | {
      source: string;
      mtimeMs: number;
      rows: CsvRow[];
      apartments: PropertyApartment[];
      stats: PropertyStats;
    }
  | null = null;

const AREA_COORDS: Record<string, { lat: number; lng: number }> = {
  Houston: { lat: 29.7604, lng: -95.3698 },
  "Sugar Land": { lat: 29.6197, lng: -95.6349 },
  Katy: { lat: 29.7858, lng: -95.8244 },
  Cypress: { lat: 29.9691, lng: -95.6972 },
  Spring: { lat: 30.0799, lng: -95.4172 },
  "The Woodlands": { lat: 30.1658, lng: -95.4613 },
  Conroe: { lat: 30.3119, lng: -95.4561 },
  Humble: { lat: 29.9988, lng: -95.2622 },
  Tomball: { lat: 30.0972, lng: -95.6161 },
  Pearland: { lat: 29.5636, lng: -95.286 },
  Stafford: { lat: 29.6161, lng: -95.5577 },
  Richmond: { lat: 29.5822, lng: -95.7608 },
  Rosenberg: { lat: 29.5572, lng: -95.8086 },
  Kingwood: { lat: 30.0505, lng: -95.1842 },
  Webster: { lat: 29.5377, lng: -95.1183 },
  "League City": { lat: 29.5075, lng: -95.0949 },
  Pasadena: { lat: 29.6911, lng: -95.2091 },
  "Missouri City": { lat: 29.6186, lng: -95.5377 },
};

// Houston neighborhood boundaries (approximate lat/lng ranges)
const HOUSTON_NEIGHBORHOODS: Array<{
  name: string;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}> = [
  { name: "Downtown", minLat: 29.7400, maxLat: 29.7700, minLng: -95.4000, maxLng: -95.3400 },
  { name: "Midtown", minLat: 29.7300, maxLat: 29.7600, minLng: -95.4100, maxLng: -95.3600 },
  { name: "Montrose", minLat: 29.7200, maxLat: 29.7600, minLng: -95.4300, maxLng: -95.3700 },
  { name: "Upper Kirby", minLat: 29.7100, maxLat: 29.7500, minLng: -95.4500, maxLng: -95.3900 },
  { name: "Uptown", minLat: 29.7400, maxLat: 29.7800, minLng: -95.4600, maxLng: -95.4000 },
  { name: "Galleria Area", minLat: 29.7000, maxLat: 29.7600, minLng: -95.4800, maxLng: -95.4100 },
  { name: "Heights", minLat: 29.7600, maxLat: 29.8000, minLng: -95.4300, maxLng: -95.3700 },
  { name: "Bellaire", minLat: 29.6800, maxLat: 29.7200, minLng: -95.4700, maxLng: -95.4000 },
  { name: "West University", minLat: 29.6600, maxLat: 29.7100, minLng: -95.4900, maxLng: -95.4200 },
  { name: "Pearland", minLat: 29.5300, maxLat: 29.6000, minLng: -95.3500, maxLng: -95.2400 },
  { name: "Sugar Land", minLat: 29.5800, maxLat: 29.6500, minLng: -95.6800, maxLng: -95.5800 },
  { name: "Stafford", minLat: 29.6000, maxLat: 29.6600, minLng: -95.6200, maxLng: -95.5000 },
  { name: "Katy", minLat: 29.7400, maxLat: 29.8300, minLng: -95.9000, maxLng: -95.7500 },
  { name: "Cypress", minLat: 29.9000, maxLat: 30.0300, minLng: -95.8000, maxLng: -95.6000 },
  { name: "Spring", minLat: 30.0200, maxLat: 30.1400, minLng: -95.5500, maxLng: -95.3500 },
  { name: "The Woodlands", minLat: 30.1200, maxLat: 30.2200, minLng: -95.5800, maxLng: -95.3800 },
  { name: "Kingwood", minLat: 29.9600, maxLat: 30.1200, minLng: -95.3000, maxLng: -95.1000 },
  { name: "Humble", minLat: 29.9200, maxLat: 30.0800, minLng: -95.4000, maxLng: -95.1500 },
];

function getHoustonNeighborhood(lat: number, lng: number): string {
  for (const neighborhood of HOUSTON_NEIGHBORHOODS) {
    if (
      lat >= neighborhood.minLat &&
      lat <= neighborhood.maxLat &&
      lng >= neighborhood.minLng &&
      lng <= neighborhood.maxLng
    ) {
      return neighborhood.name;
    }
  }
  return "Houston";
}

function parseCsv(text: string): CsvRow[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some(value => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell || row.length) {
    row.push(cell);
    if (row.some(value => value.trim() !== "")) rows.push(row);
  }

  const [headers = [], ...body] = rows;
  return body.map(values =>
    Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]))
  );
}

function numberFrom(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

// NEW: flexible CSV column mapping — supports multiple column name variants
function getField(row: CsvRow, names: string[]): string | undefined {
  for (const name of names) {
    const value = row[name];
    if (value !== undefined && value !== "") return value;
  }
  return undefined;
}

// NEW: robust rent parsing from messy CSV values
function moneyRangeFrom(...values: Array<string | undefined>): { min: number | null; max: number | null } {
  const numbers = values.flatMap(value =>
    Array.from(value?.matchAll(/\d[\d,]*(?:\.\d+)?/g) ?? [], match => Number(match[0].replace(/,/g, "")))
      .filter(number => Number.isFinite(number) && number >= 500 && number <= 20000)
  );
  if (!numbers.length) return { min: null, max: null };
  return { min: Math.min(...numbers), max: Math.max(...numbers) };
}

function splitList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split("|")
    .map(item => item.trim())
    .filter(Boolean);
}

function stableNumericId(row: CsvRow, index: number, used: Set<number>): number {
  const propertyId = getField(row, ["property_id"])?.match(/\d+/)?.[0];
  let id = propertyId ? Number(propertyId) : Number.NaN;

  if (!Number.isFinite(id)) {
    const key = `${getField(row, ["Property Name", "property_name"])}-${getField(row, ["verified_address", "street_address", "Address", "address"])}-${index}`;
    id = 100000 + (createHash("sha1").update(key).digest().readUInt32BE(0) % 800000);
  }

  while (used.has(id)) id += 1;
  used.add(id);
  return id;
}

function parseBedrooms(availability: string | undefined): number {
  const text = availability?.toLowerCase() ?? "";
  if (text.includes("efficiency") || text.includes("studio")) return 0;
  // Handle enriched format: "1 Bedroom", "2 Bedrooms", "3 Bedrooms"
  const enrichedMatch = text.match(/(\d+)\s*bedroom/);
  if (enrichedMatch) return Number(enrichedMatch[1]);
  // Handle legacy format: "1x1", "2x2"
  const legacyMatch = text.match(/\b([1-5])x/);
  if (legacyMatch) return Number(legacyMatch[1]);
  return 1;
}

function parseBathrooms(availability: string | undefined): number {
  const text = availability ?? "";
  const half = text.includes("½") ? 0.5 : 0;
  const match = text.match(/x\s*([1-5](?:\.\d)?)/i);
  return match ? Number(match[1]) + half : 1;
}

function areaCoords(city: string): { lat: number; lng: number } {
  return AREA_COORDS[city] ?? AREA_COORDS.Houston;
}

function getDisplayNeighborhood(city: string, lat: number, lng: number): string {
  // For Houston area properties, use neighborhood mapping
  if (city === "Houston" || city === "" || !city) {
    return getHoustonNeighborhood(lat, lng);
  }
  // For other cities, return the city name
  return city;
}

function cleanText(value: string | undefined): string | null {
  const text = value?.trim();
  if (!text || text === "Tags:") return null;
  return text;
}

// NEW: sanitizes availability text, removes marketing spam
function cleanAvailability(value: string | undefined, bedrooms: number): string | null {
  const text = cleanText(value);
  if (
    !text ||
    text.length > 140 ||
    /home\s+photos|floor plans\s+amenities|apply now|residents\s+contact/i.test(text)
  ) {
    return bedrooms === 0 ? "Studio floor plans" : `${bedrooms} bedroom floor plans`;
  }
  return text.replace(/\s+/g, " ");
}

// NEW: proper address/city/state extraction
function addressParts(row: CsvRow): { address: string | null; city: string; state: string } {
  const address = cleanText(getField(row, ["verified_address", "street_address", "Address", "address"]));
  const state = address?.match(/\b([A-Z]{2})\s+\d{5}(?:-\d{4})?\b/)?.[1] ??
    cleanText(getField(row, ["state"])) ??
    "TX";
  const city = address?.match(/,\s*([^,]+),\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/)?.[1]?.trim() ??
    cleanText(getField(row, ["city"])) ??
    cleanText(getField(row, ["Address"]))?.replace(/\bTX\b.*$/i, "").replace(/,\s*$/, "").trim() ??
    "Houston";

  return { address, city, state };
}

// NEW: lowercase, whitespace-normalized search text
function normalizeSearch(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

// UPDATED: robust filtering (removes commission spam, cookies, privacy policies, non-special text)
function filterCommissionFromSpecial(special: string | null): string | null {
  if (!special) return null;
  const lower = special.toLowerCase();
  if (
    lower.includes('commission') ||
    lower.includes('cookie') ||
    lower.includes('privacy') ||
    lower.includes('free apartment search') ||
    lower.length > 180
  ) {
    return null;
  }
  if (!/(special|free|off|waiv|concession|look.?lease|month|move.?in|reduced|save|credit|\$|\d+%)/i.test(special)) {
    return null;
  }
  return special;
}

// UPDATED: richer descriptions combining availability, features, amenities, pet policy
function buildDescription(row: CsvRow): string | null {
  const rawAvailability = cleanText(getField(row, ["Floorplan Availability", "availability"]));
  const bedrooms = parseBedrooms(rawAvailability ?? undefined);
  const availability = cleanAvailability(rawAvailability ?? undefined, bedrooms);
  const pieces = [
    availability ? `Available floor plans include ${availability}.` : null,
    cleanText(row.feature_highlights),
    cleanText(getField(row, ["exterior_amenities"])) ? `Community features: ${cleanText(getField(row, ["exterior_amenities"]))}.` : null,
    cleanText(getField(row, ["interior_amenities"])) ? `Interior features: ${cleanText(getField(row, ["interior_amenities"]))}.` : null,
    cleanText(getField(row, ["pet_policy"])) ? `Pet policy: ${cleanText(getField(row, ["pet_policy"]))}.` : null,
    cleanText(getField(row, ["lease_terms"])) ? `Lease terms: ${cleanText(getField(row, ["lease_terms"]))}.` : null,
    cleanText(getField(row, ["deposit"])) ? `Deposit: ${cleanText(getField(row, ["deposit"]))}.` : null,
    cleanText(getField(row, ["fees"])) ? `Fees: ${cleanText(getField(row, ["fees"]))}.` : null,
    cleanText(getField(row, ["office_hours"])) ? `Office hours: ${cleanText(getField(row, ["office_hours"]))}.` : null,
    cleanText(getField(row, ["qualification_rules"])) ? `Qualifications: ${cleanText(getField(row, ["qualification_rules"]))}.` : null,
    cleanText(getField(row, ["acceptance_notes"])) ? `Notes: ${cleanText(getField(row, ["acceptance_notes"]))}.` : null,
    cleanText(getField(row, ["school_district"])) ? `Schools: ${cleanText(getField(row, ["school_district"]))}.` : null,
  ].filter(Boolean);

  return pieces.length ? pieces.join(" ") : null;
}

function extractBuildingName(propertyName: string | null): string {
  if (!propertyName) return "Property";

  // Remove street addresses - keep only building/complex name
  // This regex removes patterns like "123 Main St" or "123 Main Street"
  const cleaned = propertyName
    .replace(/^\d+\s+[A-Za-z\s]+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Ln|Lane|Ct|Court|Pl|Place|Way|Circle|Cir|Pkwy|Parkway|Terr|Terrace|Tr|Trail|Trl).*$/i, '')
    .trim();

  return cleaned || propertyName.trim();
}

// NEW: creates full-text index from all searchable fields
function buildSearchText(row: CsvRow, apartment: Omit<PropertyApartment, "searchText" | "dataQualityScore">): string {
  return normalizeSearch([
    apartment.neighborhood,
    apartment.availability,
    apartment.special,
    apartment.description,
    row.feature_highlights,
    row.exterior_amenities,
    row.interior_amenities,
    row.pet_policy,
    row.managed_by,
  ].filter(Boolean).join(" "));
}

// NEW: 0-100 completeness score
function dataQualityScore(row: CsvRow, apartment: Omit<PropertyApartment, "searchText" | "dataQualityScore">): number {
  const checks = [
    Boolean(apartment.name && apartment.name !== "Property"),
    Boolean(apartment.neighborhood),
    apartment.rentMin > 0,
    Boolean(apartment.rentMax),
    Boolean(apartment.availability),
    apartment.latitude !== 0 && apartment.longitude !== 0,
    Boolean(getField(row, ["url audit", "Website", "website"])),
    Boolean(apartment.description),
    Boolean(getField(row, ["Phone", "phone"])),
    Boolean(getField(row, ["address_match_status"]) === "confirmed"),
  ];
  const passed = checks.filter(Boolean).length;
  return Math.round((passed / checks.length) * 100);
}

function toApartment(row: CsvRow, index: number, usedIds: Set<number>): PropertyApartment {
  const { city } = addressParts(row);
  const rentRange = moneyRangeFrom(
    getField(row, ["min_rent"]),
    getField(row, ["max_rent"]),
    getField(row, ["Price 1 Bedroom", "price_1br_min", "price_1br_max"]),
    getField(row, ["Price 2 Bedroom", "price_2br_min", "price_2br_max"])
  );
  const minRent = rentRange.min ?? 0;
  const maxRent = rentRange.max;
  const imageUrls = splitList(getField(row, ["image_urls"]));
  const primaryPhoto = cleanText(getField(row, ["primary_image_url"]));
  const photos = primaryPhoto ? [primaryPhoto, ...imageUrls.filter(url => url !== primaryPhoto)] : imageUrls;

  // Use real lat/lon from merged CSV if available; fall back to area centroid
  const csvLat = numberFrom(getField(row, ["latitude"]));
  const csvLng = numberFrom(getField(row, ["longitude"]));
  const fallbackCoords = areaCoords(city);
  const lat = csvLat ?? fallbackCoords.lat;
  const lng = csvLng ?? fallbackCoords.lng;

  const displayNeighborhood = getDisplayNeighborhood(city, lat, lng);
  const buildingName = extractBuildingName(cleanText(getField(row, ["Property Name", "property_name"])));

  // Additional check to ensure building name doesn't contain digits followed by space (likely address)
  const sanitizedName = /^\d+\s+/.test(buildingName)
    ? buildingName.split(' ').slice(2).join(' ') || buildingName
    : buildingName;

  const rawAvailability = cleanText(getField(row, ["Floorplan Availability", "availability"]));
  const bedrooms = parseBedrooms(rawAvailability ?? undefined);
  const availability = cleanAvailability(rawAvailability ?? undefined, bedrooms);

  const apartment: Omit<PropertyApartment, "searchText" | "dataQualityScore"> = {
    id: stableNumericId(row, index, usedIds),
    name: sanitizedName || `Property ${index + 1}`,
    neighborhood: displayNeighborhood,
    bedrooms,
    bathrooms: parseBathrooms(rawAvailability ?? undefined),
    rentMin: minRent,
    rentMax: maxRent && maxRent !== minRent ? maxRent : null,
    // Per-bedroom price splits from merged CSV
    price1brMin: numberFrom(getField(row, ["price_1br_min", "Price 1 Bedroom"])),
    price1brMax: numberFrom(getField(row, ["price_1br_max"])),
    price2brMin: numberFrom(getField(row, ["price_2br_min", "Price 2 Bedroom"])),
    price2brMax: numberFrom(getField(row, ["price_2br_max"])),
    description: buildDescription(row),
    latitude: lat,
    longitude: lng,
    photos,
    special: filterCommissionFromSpecial(cleanText(getField(row, ["Specials", "special"]))),
    availability,
    minSqft: numberFrom(getField(row, ["min_sqft"])),
    maxSqft: numberFrom(getField(row, ["max_sqft"])),
    builtYear: numberFrom(getField(row, ["built_year"])),
    managedBy: cleanText(getField(row, ["managed_by"])),
    photoCount: numberFrom(getField(row, ["photo_count"])) ?? photos.length,
    // Contact info from merged CSV
    phone: cleanText(getField(row, ["phone"])),
    email: cleanText(getField(row, ["email"])),
    website: cleanText(getField(row, ["website"])),
    // Address quality
    verifiedAddress: cleanText(getField(row, ["verified_address"])),
    addressMatchStatus: cleanText(getField(row, ["address_match_status"])),
    // Enriched fields
    unitCount: numberFrom(getField(row, ["unit_count"])),
    floorCount: numberFrom(getField(row, ["floor_count"])),
    deposit: cleanText(getField(row, ["deposit"])),
    fees: cleanText(getField(row, ["fees"])),
    leaseTerms: cleanText(getField(row, ["lease_terms"])),
    officeHours: cleanText(getField(row, ["office_hours"])),
    schoolDistrict: cleanText(getField(row, ["school_district"])),
    discounts: cleanText(getField(row, ["discounts"])),
    qualificationRules: cleanText(getField(row, ["qualification_rules"])),
    acceptanceNotes: cleanText(getField(row, ["acceptance_notes"])),
    floorplanPricing: cleanText(getField(row, ["floorplan_pricing"])),
    onsiteManager: cleanText(getField(row, ["onsite_manager"])),
    commission: cleanText(getField(row, ["commission"])),
    commissionTier: cleanText(getField(row, ["commission_tier"])),
    // Parsed amenity lists
    exteriorAmenitiesList: splitList(getField(row, ["exterior_amenities"])),
    interiorAmenitiesList: splitList(getField(row, ["interior_amenities"])),
  };

  return {
    ...apartment,
    searchText: buildSearchText(row, apartment),
    dataQualityScore: dataQualityScore(row, apartment),
  };
}

function hasCompleteProfile(row: CsvRow, apartment: PropertyApartment): boolean {
  const coreInfo = row.has_complete_core_info?.trim().toLowerCase();
  const isComplete = coreInfo === "true" || coreInfo === "yes";
  // Show properties with complete data OR with photos
  return isComplete && apartment.rentMin > 0;
}

async function readPropertyDatabase() {
  const source = process.env.PROPERTY_DATABASE_CSV || DEFAULT_PROPERTY_CSV;
  const stat = await fs.stat(source)
    .catch(() => null);

  if (cache && stat && cache.mtimeMs === stat.mtimeMs) {
    return cache;
  }

  const text = await fs.readFile(source, "utf-8");
  const rows = parseCsv(text);
  const usedIds = new Set<number>();
  const apartments = rows
    .map((row, index) => ({ row, apartment: toApartment(row, index, usedIds) }))
    .filter(({ row, apartment }) => hasCompleteProfile(row, apartment))
    .map(({ apartment }) => apartment);

  const cities = new Set(apartments.map(apartment => apartment.neighborhood).filter(Boolean));
  const stats: PropertyStats = {
    source: source.split("/").pop() || source,
    status: "ready",
    totalProperties: rows.length,
    eligibleProperties: apartments.length,
    withPricing: apartments.filter(a => a.rentMin > 0).length,
    withPhotos: apartments.filter(a => a.photos.length > 0).length,
    withSpecials: apartments.filter(a => a.special).length,
    cities: cities.size,
    lastUpdated: new Date(stat?.mtimeMs || Date.now()).toISOString(),
  };

  cache = {
    source,
    mtimeMs: stat?.mtimeMs || Date.now(),
    rows,
    apartments,
    stats,
  };

  return cache;
}

export async function getEligiblePropertyDatabaseRecords() {
  const { rows, apartments } = await readPropertyDatabase();
  const usedIds = new Set(apartments.map(a => a.id));
  return rows
    .map((row, index) => ({ row, apartment: toApartment(row, index, usedIds) }))
    .filter(({ row, apartment }) => hasCompleteProfile(row, apartment));
}

export async function getPropertyDatabaseStats(): Promise<PropertyStats> {
  const { stats } = await readPropertyDatabase();
  return stats;
}

/**
 * Pick the best price field to compare against a rent filter for a given apartment.
 * When a specific bedroom count is selected and per-bedroom price data is available,
 * use that price instead of the generic minRent (which reflects the cheapest unit type).
 */
function getEffectivePrice(
  apartment: PropertyApartment,
  bedroomCount: number | undefined,
  useBedroomPrices: boolean
): number {
  if (!useBedroomPrices || bedroomCount == null) return apartment.rentMin;

  // Exact bedroom match → use per-bedroom price if available
  if (bedroomCount === 0) return apartment.rentMin; // Studio: no split data, fall back
  if (bedroomCount === 1 && apartment.price1brMin != null) return apartment.price1brMin;
  if (bedroomCount === 2 && apartment.price2brMin != null) return apartment.price2brMin;
  // 3+ bedrooms: no dedicated split field yet, use generic rentMin
  return apartment.rentMin;
}

// NEW: ranking algorithm with matchScore and matchReasons
function scoreApartment(
  apartment: PropertyApartment,
  filters: PropertyFilters | undefined,
  searchTerms: string[]
): PropertyApartment {
  let score = apartment.dataQualityScore ?? 0;
  const reasons: string[] = [];

  if (filters?.maxRent !== undefined && apartment.rentMin <= filters.maxRent) {
    score += 25;
    reasons.push(`Starts under $${filters.maxRent.toLocaleString()}`);
  }

  if (
    filters?.minBedrooms !== undefined &&
    apartment.bedrooms >= filters.minBedrooms &&
    apartment.bedrooms <= (filters.maxBedrooms ?? apartment.bedrooms)
  ) {
    score += 20;
    reasons.push(`${filters.minBedrooms === 0 ? "Studio" : `${filters.minBedrooms} bed`} availability`);
  }

  if (filters?.neighborhood && apartment.neighborhood === filters.neighborhood) {
    score += 20;
    reasons.push(`Matches ${filters.neighborhood}`);
  }

  if (searchTerms.length) {
    const exactNameHit = searchTerms.some(term => normalizeSearch(apartment.name).includes(term));
    score += exactNameHit ? 20 : 10;
    reasons.push(exactNameHit ? "Name matches search" : "Details match search");
  }

  if (apartment.special) {
    score += 8;
    reasons.push("Has a listed special");
  }

  if (apartment.photos.length >= 3) {
    score += 5;
    reasons.push("Multiple photos available");
  }

  return {
    ...apartment,
    matchScore: score,
    matchReasons: reasons.slice(0, 4),
  };
}

// NEW: privacy anonymization for non-lead visitors
function toPublicApartment(apartment: PropertyApartment): PropertyApartment {
  const publicAreaName = `${apartment.neighborhood || "Houston"} apartment`;
  return {
    ...apartment,
    name: publicAreaName,
    searchText: "",
  };
}

export async function queryPropertyDatabase(filters?: PropertyFilters): Promise<PropertyApartment[]> {
  const { apartments } = await readPropertyDatabase();

  // Determine if a single bedroom count is being targeted (minBedrooms === maxBedrooms)
  const targetBedrooms =
    filters?.minBedrooms != null &&
    filters?.maxBedrooms != null &&
    filters.minBedrooms === filters.maxBedrooms
      ? filters.minBedrooms
      : filters?.minBedrooms ?? filters?.maxBedrooms;

  const useBedroomPrices = filters?.useBedroomPrices ?? true;

  const searchTerms = normalizeSearch(filters?.searchText)
    .split(" ")
    .filter(term => term.length > 1);

  return apartments
    .filter(apartment => {
      if (filters?.neighborhood && apartment.neighborhood !== filters.neighborhood) return false;
      if (filters?.minBedrooms != null && apartment.bedrooms < filters.minBedrooms) return false;
      if (filters?.maxBedrooms != null && apartment.bedrooms > filters.maxBedrooms) return false;

      // Use per-bedroom price when a specific bedroom count is selected
      const effectivePrice = getEffectivePrice(apartment, targetBedrooms, useBedroomPrices);
      if (filters?.minRent != null && effectivePrice < filters.minRent) return false;
      if (filters?.maxRent != null && effectivePrice > filters.maxRent) return false;

      // NEW: hasSpecial filter
      if (filters?.hasSpecial && !apartment.special) return false;
      // NEW: petFriendly filter
      if (filters?.petFriendly && !/pet|cat|dog/i.test(apartment.searchText ?? "")) return false;
      // NEW: searchText filter
      if (searchTerms.length && !searchTerms.every(term => apartment.searchText?.includes(term))) return false;

      return true;
    })
    .map(apartment => scoreApartment(apartment, filters, searchTerms))
    .sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0) || a.rentMin - b.rentMin || a.name.localeCompare(b.name));
}
