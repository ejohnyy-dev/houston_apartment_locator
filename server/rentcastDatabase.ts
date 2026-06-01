import fs from "fs/promises";
import path from "path";
import { getEligiblePropertyDatabaseRecords, type PropertyApartment } from "./propertyDatabase";

// Logging utility
const log = {
  info: (msg: string, data?: any) => console.log(`[RentCast] ${msg}`, data ? JSON.stringify(data) : ''),
  error: (msg: string, err?: any) => console.error(`[RentCast] ${msg}`, err instanceof Error ? err.message : err),
};

const RENTCAST_BASE_URL = "https://api.rentcast.io/v1";
const RENTCAST_CACHE_FILE =
  process.env.RENTCAST_CACHE_FILE || path.join(process.cwd(), "server", "data", "rentcast-cache.json");
const RENTCAST_CACHE_TTL_MS = Number(process.env.RENTCAST_CACHE_TTL_HOURS || 24) * 60 * 60 * 1000;
const RENTCAST_LIMIT = Number(process.env.RENTCAST_PROPERTY_LIMIT || 354);
const RENTCAST_TARGET_CSV = process.env.RENTCAST_TARGET_CSV;
const RENTCAST_USAGE_FILE =
  process.env.RENTCAST_USAGE_FILE || path.join(process.cwd(), "server", "data", "rentcast-usage.json");
const RENTCAST_MONTHLY_REQUEST_LIMIT = Number(process.env.RENTCAST_MONTHLY_REQUEST_LIMIT || 50);
const RENTCAST_REFRESH_BATCH_SIZE = Number(process.env.RENTCAST_REFRESH_BATCH_SIZE || 50);

type RentCastListing = {
  id?: string;
  formattedAddress?: string;
  addressLine1?: string;
  addressLine2?: string | null;
  city?: string;
  state?: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  squareFootage?: number;
  yearBuilt?: number;
  status?: string;
  price?: number;
  daysOnMarket?: number;
  listedDate?: string | null;
  lastSeenDate?: string | null;
  description?: string | null;
  photos?: string[];
  images?: string[];
  listingAgent?: {
    name?: string;
    phone?: string;
    email?: string;
    website?: string;
  };
  listingOffice?: {
    name?: string;
    phone?: string;
    email?: string;
    website?: string;
  };
};

type RentCastCacheEntry = {
  propertyId: number;
  propertyName: string;
  address: string;
  photos?: string[];
  fetchedAt: string;
  status: "matched" | "not_found" | "error";
  listing?: RentCastListing;
  error?: string;
};

type RentCastCache = {
  version: 1;
  generatedAt: string;
  status: "ready" | "disabled" | "error";
  error?: string;
  entries: RentCastCacheEntry[];
};

type RentCastUsage = {
  month: string;
  requests: number;
};

type RentCastStats = {
  source: string;
  status: "ready" | "disabled" | "error";
  totalProperties: number;
  eligibleProperties: number;
  rentcastMatches: number;
  monthlyRequestLimit: number;
  monthlyRequestsUsed: number;
  monthlyRequestsRemaining: number;
  withPricing: number;
  withPhotos: number;
  withSpecials: number;
  cities: number;
  lastUpdated: string | null;
  error?: string;
};

type PropertyFilters = {
  neighborhood?: string;
  minBedrooms?: number;
  maxBedrooms?: number;
  minRent?: number;
  maxRent?: number;
};

type RentCastTarget = {
  id: number;
  address: string;
  city: string;
  state: string;
  photos: string[];
};

let memoryCache:
  | {
      loadedAt: number;
      apartments: PropertyApartment[];
      stats: RentCastStats;
    }
  | null = null;

function apiKey() {
  return process.env.RENTCAST_API_KEY?.trim() || "";
}

function splitList(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split("|")
    .map(item => item.trim())
    .filter(Boolean);
}

function parseCsv(text: string): Record<string, string>[] {
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

function cleanStreetAddress(address: string) {
  const matches = address.match(/\b\d{1,6}\s+[^,\n]{2,90},\s*[^,\n]{2,50},\s*TX\s+\d{5}\b/g);
  const cleaned = matches?.at(-1)?.trim() || address.trim();
  const [street, ...rest] = cleaned.split(",");
  const words = street.trim().split(/\s+/);
  if (words.length % 2 === 0) {
    const half = words.length / 2;
    const left = words.slice(0, half).join(" ").toLowerCase();
    const right = words.slice(half).join(" ").toLowerCase();
    if (left === right) return [words.slice(0, half).join(" "), ...rest].join(",").trim();
  }
  return cleaned;
}

function normalizeAddress(target: RentCastTarget) {
  const address = cleanStreetAddress(target.address);
  const city = target.city.trim();
  const state = target.state.trim() || "TX";

  if (!address) return "";
  if (/\bTX\s+\d{5}\b/i.test(address)) {
    return address;
  }
  return [address, city, state].filter(Boolean).join(", ");
}

async function getRentCastTargets(): Promise<RentCastTarget[]> {
  if (RENTCAST_TARGET_CSV) {
    try {
      const csvText = await fs.readFile(RENTCAST_TARGET_CSV, "utf8");
      const rows = parseCsv(csvText);

      if (rows.length === 0) {
        log.error('Target CSV is empty', { path: RENTCAST_TARGET_CSV });
        throw new Error(`Target CSV is empty: ${RENTCAST_TARGET_CSV}`);
      }

      log.info('Loaded target CSV', { path: RENTCAST_TARGET_CSV, rowCount: rows.length });

      return rows.slice(0, RENTCAST_LIMIT).map((row, index) => ({
        id: Number(row.target_id) || index + 1,
        address: row.address?.trim() || "",
        city: row.city?.trim() || "",
        state: row.state?.trim() || "TX",
        photos: splitList(row.photo_urls),
      }));
    } catch (error) {
      log.error('Failed to read target CSV', error);
      throw new Error(`Target CSV not found or invalid: ${RENTCAST_TARGET_CSV}`);
    }
  }

  const records = (await getEligiblePropertyDatabaseRecords()).slice(0, RENTCAST_LIMIT);
  return records.map(({ row, apartment }, index) => ({
    id: apartment.id || index + 1,
    address: row.address?.trim() || "",
    city: row.city?.trim() || "",
    state: row.state?.trim() || "TX",
    photos: apartment.photos,
  }));
}

async function readCache(): Promise<RentCastCache | null> {
  try {
    const data = JSON.parse(await fs.readFile(RENTCAST_CACHE_FILE, "utf8")) as RentCastCache;
    if (data.version !== 1) {
      log.error('Cache version mismatch', { version: data.version });
      return null;
    }
    return data;
  } catch (error) {
    log.error('Failed to read cache', error);
    return null;
  }
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

async function readUsage(): Promise<RentCastUsage> {
  try {
    const usage = JSON.parse(await fs.readFile(RENTCAST_USAGE_FILE, "utf8")) as RentCastUsage;
    if (usage.month === currentMonth()) return usage;
  } catch {
    // Missing or invalid usage files are reset for the current month.
  }

  return { month: currentMonth(), requests: 0 };
}

async function writeUsage(usage: RentCastUsage) {
  await fs.mkdir(path.dirname(RENTCAST_USAGE_FILE), { recursive: true });
  // Atomic write: write to temp file, then rename (prevents corruption from concurrent writes)
  const tempFile = `${RENTCAST_USAGE_FILE}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(usage, null, 2));
  await fs.rename(tempFile, RENTCAST_USAGE_FILE);
}

async function writeCache(cache: RentCastCache) {
  await fs.mkdir(path.dirname(RENTCAST_CACHE_FILE), { recursive: true });
  // Atomic write: write to temp file, then rename (prevents corruption from concurrent writes)
  const tempFile = `${RENTCAST_CACHE_FILE}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(cache, null, 2));
  await fs.rename(tempFile, RENTCAST_CACHE_FILE);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

async function fetchRentCastListing(address: string): Promise<RentCastListing | null> {
  const url = new URL(`${RENTCAST_BASE_URL}/listings/rental/long-term`);
  url.search = new URLSearchParams({
    address,
    propertyType: "Apartment",
    status: "Active",
    limit: "1",
  }).toString();

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "X-Api-Key": apiKey(),
    },
  });

  if (response.status === 401) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.message || "RentCast API authorization failed");
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`RentCast API returned ${response.status}: ${body.slice(0, 180)}`);
  }

  const data = (await response.json()) as RentCastListing[];
  return Array.isArray(data) && data.length ? data[0] : null;
}

function shouldRefreshEntry(entry: RentCastCacheEntry | undefined) {
  if (!entry) return true;
  const fetchedAt = Date.parse(entry.fetchedAt);
  if (!Number.isFinite(fetchedAt)) return true;
  return Date.now() - fetchedAt > RENTCAST_CACHE_TTL_MS;
}

function selectRefreshTargets(targets: RentCastTarget[], existingEntries: Map<number, RentCastCacheEntry>, limit: number) {
  return targets
    .filter(target => shouldRefreshEntry(existingEntries.get(target.id)))
    .slice(0, Math.max(0, limit));
}

async function refreshRentCastCache(existingCache: RentCastCache | null): Promise<RentCastCache> {
  const targets = await getRentCastTargets();
  const usage = await readUsage();
  const remaining = Math.max(0, RENTCAST_MONTHLY_REQUEST_LIMIT - usage.requests);
  const refreshLimit = Math.min(RENTCAST_REFRESH_BATCH_SIZE, remaining);
  const existingEntries = new Map((existingCache?.entries ?? []).map(entry => [entry.propertyId, entry]));

  log.info('Refresh cache started', {
    month: usage.month,
    requestsUsed: usage.requests,
    requestsRemaining: remaining,
    refreshLimit,
    totalTargets: targets.length,
    cachedEntries: existingEntries.size,
  });

  if (!apiKey()) {
    log.error('RentCast API key not configured');
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      status: "disabled",
      error: "RENTCAST_API_KEY is not configured",
      entries: existingCache?.entries ?? [],
    };
  }

  if (refreshLimit <= 0) {
    log.info('Monthly request limit reached, serving cached data only');
    return {
      version: 1,
      generatedAt: new Date().toISOString(),
      status: "ready",
      entries: Array.from(existingEntries.values()),
    };
  }

  const entries = new Map(existingEntries);
  let status: RentCastCache["status"] = "ready";
  let cacheError: string | undefined;
  let requestsMade = 0;
  const refreshTargets = selectRefreshTargets(targets, existingEntries, refreshLimit);

  log.info(`Starting refresh batch`, { targetCount: refreshTargets.length });

  for (const target of refreshTargets) {
    const address = normalizeAddress(target);
    try {
      const listing = address ? await fetchRentCastListing(address) : null;
      requestsMade += 1;
      entries.set(target.id, {
        propertyId: target.id,
        propertyName: address,
        address,
        photos: target.photos,
        fetchedAt: new Date().toISOString(),
        status: listing ? "matched" : "not_found",
        listing: listing ?? undefined,
      });
      log.info(`Fetched listing`, { address, matched: !!listing, requestNumber: requestsMade });
    } catch (error) {
      requestsMade += 1;
      const message = errorMessage(error);
      entries.set(target.id, {
        propertyId: target.id,
        propertyName: address,
        address,
        photos: target.photos,
        fetchedAt: new Date().toISOString(),
        status: "error",
        error: message,
      });
      log.error(`Failed to fetch listing`, { address, error: message, requestNumber: requestsMade });

      if (message.includes("subscription") || message.includes("authorization")) {
        status = "error";
        cacheError = message;
        log.error('Authentication error, stopping refresh batch', { error: message });
        break;
      }
    }
  }

  usage.requests += requestsMade;
  await writeUsage(usage);
  log.info(`Refresh batch complete`, { requestsMade, totalUsage: usage.requests, month: usage.month });

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    status,
    error: cacheError,
    entries: Array.from(entries.values()),
  };
}

function stableApiId(listing: RentCastListing, fallbackIndex: number): number {
  const source = listing.id || listing.formattedAddress || `${listing.addressLine1}-${fallbackIndex}`;
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }
  return 200000 + (hash % 700000);
}

function listingPhotos(listing: RentCastListing): string[] {
  const all = [
    ...(Array.isArray(listing.photos) ? listing.photos : []),
    ...(Array.isArray(listing.images) ? listing.images : []),
  ].filter(Boolean);
  // Remove duplicates using Set
  return Array.from(new Set(all));
}

function listingName(listing: RentCastListing) {
  return listing.formattedAddress || listing.addressLine1 || "RentCast Listing";
}

function listingToApartment(listing: RentCastListing, index: number, fallbackPhotos: string[]): PropertyApartment | null {
  if (!listing.price || listing.price <= 0) return null;

  const descriptionParts = [
    listing.description,
    listing.propertyType ? `Property type: ${listing.propertyType}.` : null,
    listing.status ? `RentCast status: ${listing.status}.` : null,
    listing.daysOnMarket != null ? `Listed for ${listing.daysOnMarket} days.` : null,
    listing.lastSeenDate ? `Last seen ${new Date(listing.lastSeenDate).toLocaleDateString("en-US")}.` : null,
  ].filter(Boolean);

  const rentalPhotos = listingPhotos(listing);
  const finalPhotos = rentalPhotos.length > 0 ? rentalPhotos : (fallbackPhotos || []);

  return {
    id: stableApiId(listing, index),
    name: listingName(listing),
    neighborhood: listing.city || "Houston",
    bedrooms: listing.bedrooms ?? 0,
    bathrooms: listing.bathrooms ?? 0,
    rentMin: listing.price,
    rentMax: null,
    // RentCast doesn't provide per-bedroom price splits
    price1brMin: null,
    price1brMax: null,
    price2brMin: null,
    price2brMax: null,
    description: descriptionParts.length ? descriptionParts.join(" ") : null,
    latitude: listing.latitude ?? 29.7604,
    longitude: listing.longitude ?? -95.3698,
    photos: finalPhotos,
    special: null,
    availability: listing.status || null,
    minSqft: listing.squareFootage ?? null,
    maxSqft: listing.squareFootage ?? null,
    builtYear: listing.yearBuilt ?? null,
    managedBy: listing.listingOffice?.name || listing.listingAgent?.name || null,
    photoCount: finalPhotos.length,
    phone: null,
    email: null,
    website: null,
    verifiedAddress: null,
    addressMatchStatus: null,
  };
}

async function loadRentCastData() {
  if (memoryCache && Date.now() - memoryCache.loadedAt < RENTCAST_CACHE_TTL_MS) {
    return memoryCache;
  }

  const targets = await getRentCastTargets();
  let cache = await readCache();

  cache = await refreshRentCastCache(cache);
  await writeCache(cache);

  const targetPhotosById = new Map(targets.map(target => [target.id, target.photos]));
  let apartments = cache.entries
    .filter(entry => entry.status === "matched" && entry.listing)
    .map((entry, index) =>
      listingToApartment(entry.listing!, index, entry.photos ?? targetPhotosById.get(entry.propertyId) ?? [])
    )
    .filter((apartment): apartment is PropertyApartment => Boolean(apartment));
  
  // Deduplicate RentCast apartments by ID
  const seenIds = new Set<number>();
  apartments = apartments.filter(apt => {
    if (seenIds.has(apt.id)) {
      return false;
    }
    seenIds.add(apt.id);
    return true;
  });

  // Blend local property database with RentCast results
  try {
    const { getEligiblePropertyDatabaseRecords } = await import('./propertyDatabase');
    const records = await getEligiblePropertyDatabaseRecords();
    const localApartments = records.map(({ apartment }) => apartment);
    // Add local properties that don't duplicate RentCast listings
    // Create a set of RentCast addresses for deduplication
    const rentcastSet = new Set(
      apartments.map(a => (a.name || '').toLowerCase().trim())
    );
    const uniqueLocal = localApartments.filter(apt => {
      const aptAddr = (apt.name || '').toLowerCase().trim();
      return !rentcastSet.has(aptAddr);
    });
    apartments = [...apartments, ...uniqueLocal];
    log.info('Blended apartments', { rentcast: apartments.length - uniqueLocal.length, local: uniqueLocal.length, total: apartments.length });
  } catch (error) {
    log.error('Could not load local property database', error);
  }
  const cities = new Set(apartments.map(apartment => apartment.neighborhood).filter(Boolean));
  const matches = cache.entries.filter(entry => entry.status === "matched").length;
  const usage = await readUsage();
  const remaining = Math.max(0, RENTCAST_MONTHLY_REQUEST_LIMIT - usage.requests);

  memoryCache = {
    loadedAt: Date.now(),
    apartments,
    stats: {
      source: "RentCast API only",
      status: cache.status,
      totalProperties: targets.length,
      eligibleProperties: apartments.length,
      rentcastMatches: matches,
      monthlyRequestLimit: RENTCAST_MONTHLY_REQUEST_LIMIT,
      monthlyRequestsUsed: usage.requests,
      monthlyRequestsRemaining: remaining,
      withPricing: apartments.filter(apartment => apartment.rentMin > 0).length,
      withPhotos: apartments.filter(apartment => apartment.photos.length > 0).length,
      withSpecials: apartments.filter(apartment => Boolean(apartment.special)).length,
      cities: cities.size,
      lastUpdated: cache.generatedAt,
      error: cache.error,
    },
  };

  return memoryCache;
}

export async function getRentCastDatabaseStats(): Promise<RentCastStats> {
  return (await loadRentCastData()).stats;
}

export async function getRentCastDatabaseApartments(
  filters?: PropertyFilters
): Promise<PropertyApartment[]> {
  const database = await loadRentCastData();

  return database.apartments.filter(apartment => {
    if (filters?.neighborhood && apartment.neighborhood !== filters.neighborhood) return false;
    if (filters?.minBedrooms !== undefined && apartment.bedrooms < filters.minBedrooms) return false;
    if (filters?.maxBedrooms !== undefined && apartment.bedrooms > filters.maxBedrooms) return false;
    if (filters?.minRent !== undefined && apartment.rentMin < filters.minRent) return false;
    if (filters?.maxRent !== undefined && apartment.rentMin > filters.maxRent) return false;
    return true;
  });
}
