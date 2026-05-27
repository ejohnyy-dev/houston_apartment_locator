import fs from "fs/promises";
import path from "path";
import { createHash } from "crypto";

const DEFAULT_PROPERTY_CSV = process.env.PROPERTY_DATABASE_CSV ||
  path.join(process.cwd(), 'data', 'all-properties-with-info-and-photos.csv');

type PropertyFilters = {
  neighborhood?: string;
  minBedrooms?: number;
  maxBedrooms?: number;
  minRent?: number;
  maxRent?: number;
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

function splitList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split("|")
    .map(item => item.trim())
    .filter(Boolean);
}

function stableNumericId(row: CsvRow, index: number, used: Set<number>): number {
  const propertyId = row.property_id?.match(/\d+/)?.[0];
  let id = propertyId ? Number(propertyId) : Number.NaN;

  if (!Number.isFinite(id)) {
    const key = `${row.property_name}-${row.address}-${index}`;
    id = 100000 + (createHash("sha1").update(key).digest().readUInt32BE(0) % 800000);
  }

  while (used.has(id)) id += 1;
  used.add(id);
  return id;
}

function parseBedrooms(availability: string | undefined): number {
  const text = availability?.toLowerCase() ?? "";
  if (text.includes("efficiency") || text.includes("studio")) return 0;
  const match = text.match(/\b([1-5])x/);
  return match ? Number(match[1]) : 1;
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

function cleanText(value: string | undefined): string | null {
  const text = value?.trim();
  if (!text || text === "Tags:") return null;
  return text;
}

function buildDescription(row: CsvRow): string | null {
  const pieces = [
    cleanText(row.special) ? `Current special: ${cleanText(row.special)}.` : null,
    cleanText(row.availability) ? `Available floor plans include ${cleanText(row.availability)}.` : null,
    cleanText(row.feature_highlights),
    cleanText(row.exterior_amenities) ? `Community features: ${cleanText(row.exterior_amenities)}.` : null,
    cleanText(row.interior_amenities) ? `Interior features: ${cleanText(row.interior_amenities)}.` : null,
    cleanText(row.pet_policy) ? `Pet policy: ${cleanText(row.pet_policy)}.` : null,
  ].filter(Boolean);

  return pieces.length ? pieces.join(" ") : null;
}

function toApartment(row: CsvRow, index: number, usedIds: Set<number>): PropertyApartment {
  const city = cleanText(row.city) ?? "Houston";
  const minRent = numberFrom(row.min_rent) ?? 0;
  const maxRent = numberFrom(row.max_rent);
  const coords = areaCoords(city);
  const imageUrls = splitList(row.image_urls);
  const primaryPhoto = cleanText(row.primary_image_url);
  const photos = primaryPhoto ? [primaryPhoto, ...imageUrls.filter(url => url !== primaryPhoto)] : imageUrls;

  return {
    id: stableNumericId(row, index, usedIds),
    name: cleanText(row.property_name) ?? `Property ${index + 1}`,
    neighborhood: city,
    bedrooms: parseBedrooms(row.availability),
    bathrooms: parseBathrooms(row.availability),
    rentMin: minRent,
    rentMax: maxRent && maxRent !== minRent ? maxRent : null,
    description: buildDescription(row),
    latitude: coords.lat,
    longitude: coords.lng,
    photos,
    special: cleanText(row.special),
    availability: cleanText(row.availability),
    minSqft: numberFrom(row.min_sqft),
    maxSqft: numberFrom(row.max_sqft),
    builtYear: numberFrom(row.built_year),
    managedBy: cleanText(row.managed_by),
    photoCount: numberFrom(row.photo_count) ?? photos.length,
  };
}

function hasCompleteProfile(row: CsvRow, apartment: PropertyApartment): boolean {
  const coreInfo = row.has_complete_core_info?.trim().toLowerCase();
  const isComplete = coreInfo === "true" || coreInfo === "yes";
  return isComplete && apartment.rentMin > 0 && apartment.photos.length > 0;
}

async function readPropertyDatabase() {
  const source = process.env.PROPERTY_DATABASE_CSV || DEFAULT_PROPERTY_CSV;
  const stat = await fs.stat(source);

  if (cache && cache.source === source && cache.mtimeMs === stat.mtimeMs) {
    return cache;
  }

  const text = await fs.readFile(source, "utf8");
  const rows = parseCsv(text);
  const usedIds = new Set<number>();
  const apartments = rows
    .map((row, index) => ({ row, apartment: toApartment(row, index, usedIds) }))
    .filter(({ row, apartment }) => hasCompleteProfile(row, apartment))
    .map(({ apartment }) => apartment);
  const cities = new Set(apartments.map(apartment => apartment.neighborhood).filter(Boolean));
  const generatedAt = rows.map(row => row.generated_at).find(Boolean) ?? null;

  cache = {
    source,
    mtimeMs: stat.mtimeMs,
    rows,
    apartments,
    stats: {
      source: path.basename(source),
      totalProperties: rows.length,
      eligibleProperties: apartments.length,
      withPricing: apartments.filter(apartment => apartment.rentMin > 0).length,
      withPhotos: apartments.filter(apartment => apartment.photos.length > 0).length,
      withSpecials: apartments.filter(apartment => Boolean(apartment.special)).length,
      cities: cities.size,
      lastUpdated: generatedAt,
    },
  };

  return cache;
}

export async function getEligiblePropertyDatabaseRecords(): Promise<
  Array<{ row: CsvRow; apartment: PropertyApartment }>
> {
  const source = process.env.PROPERTY_DATABASE_CSV || DEFAULT_PROPERTY_CSV;
  const text = await fs.readFile(source, "utf8");
  const rows = parseCsv(text);
  const usedIds = new Set<number>();

  return rows
    .map((row, index) => ({ row, apartment: toApartment(row, index, usedIds) }))
    .filter(({ row, apartment }) => hasCompleteProfile(row, apartment));
}

export async function hasPropertyDatabase(): Promise<boolean> {
  try {
    await fs.access(process.env.PROPERTY_DATABASE_CSV || DEFAULT_PROPERTY_CSV);
    return true;
  } catch {
    return false;
  }
}

export async function getPropertyDatabaseStats(): Promise<PropertyStats> {
  try {
    const database = await readPropertyDatabase();
    return database.stats;
  } catch {
    return {
      source: null,
      totalProperties: 0,
      eligibleProperties: 0,
      withPricing: 0,
      withPhotos: 0,
      withSpecials: 0,
      cities: 0,
      lastUpdated: null,
    };
  }
}

export async function getPropertyDatabaseApartments(
  filters?: PropertyFilters
): Promise<PropertyApartment[]> {
  const database = await readPropertyDatabase();

  return database.apartments.filter(apartment => {
    if (filters?.neighborhood && apartment.neighborhood !== filters.neighborhood) return false;
    if (filters?.minBedrooms !== undefined && apartment.bedrooms < filters.minBedrooms) return false;
    if (filters?.maxBedrooms !== undefined && apartment.bedrooms > filters.maxBedrooms) return false;
    if (filters?.minRent !== undefined && apartment.rentMin < filters.minRent) return false;
    if (filters?.maxRent !== undefined && apartment.rentMin > filters.maxRent) return false;
    return true;
  });
}
