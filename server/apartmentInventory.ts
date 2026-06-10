/**
 * Apartment inventory assembly, shared by the public tRPC API and server
 * jobs (e.g. saved-search alerts). Blends the base dataset (RentCast or CSV)
 * with admin-managed SQL listings: DB rows with a propertyId override the
 * matching base entry; DB rows without one are appended as new results.
 *
 * Returns UNMASKED data — real names, addresses, owner contacts. Anything
 * renter-facing must go through maskApartmentForPublic (see routers.ts).
 */

import { getRentCastDatabaseApartments } from "./rentcastDatabase";
import { getActiveListings } from "./db";

export interface InventoryFilterInput {
  neighborhood?: string;
  minBedrooms?: number;
  maxBedrooms?: number;
  minRent?: number;
  maxRent?: number;
}

export async function getMergedApartments(input?: InventoryFilterInput): Promise<any[]> {
  // Get base apartments from RentCast (blends CSV) or CSV only
  let baseApartments: any[];
  if (process.env.RENTCAST_API_KEY) {
    baseApartments = await getRentCastDatabaseApartments(input);
  } else {
    const { queryPropertyDatabase } = await import("./propertyDatabase");
    baseApartments = await queryPropertyDatabase(input);
  }

  const dbListings = await getActiveListings();
  if (dbListings.length === 0) return baseApartments;

  // Build a map of propertyId overrides
  const overrideMap = new Map<string, any>();
  const newListings: any[] = [];
  for (const l of dbListings) {
    const apt = {
      id: l.propertyId ?? `db-${l.id}`,
      name: l.name,
      neighborhood: l.neighborhood ?? l.city,
      bedrooms: l.bedrooms ?? 0,
      bathrooms: l.bathrooms ?? 0,
      rentMin: l.minRent,
      rentMax: l.maxRent ?? null,
      price1brMin: l.price1brMin ?? null,
      price1brMax: l.price1brMax ?? null,
      price2brMin: l.price2brMin ?? null,
      price2brMax: l.price2brMax ?? null,
      description: [
        l.featureHighlights,
        l.interiorAmenities,
        l.exteriorAmenities,
      ].filter(Boolean).join('. ') || null,
      latitude: l.latitude ? parseFloat(l.latitude) : null,
      longitude: l.longitude ? parseFloat(l.longitude) : null,
      photos: [
        ...(l.primaryImageUrl ? [l.primaryImageUrl] : []),
        ...(l.imageUrls ? JSON.parse(l.imageUrls) : []),
      ],
      special: l.special ?? null,
      availability: l.availability ?? null,
      minSqft: l.minSqft ?? null,
      maxSqft: l.maxSqft ?? null,
      builtYear: l.builtYear ?? null,
      managedBy: l.managedBy ?? null,
      source: 'admin' as const,
    };
    if (l.propertyId) {
      overrideMap.set(l.propertyId, apt);
    } else {
      newListings.push(apt);
    }
  }

  // Replace overridden CSV entries; keep unmatched CSV entries
  const merged = baseApartments.map((a: any) =>
    overrideMap.has(String(a.id)) ? overrideMap.get(String(a.id)) : a
  );

  // Apply filters to new DB-only listings (with per-bedroom price support)
  const targetBedrooms =
    input?.minBedrooms != null &&
    input?.maxBedrooms != null &&
    input.minBedrooms === input.maxBedrooms
      ? input.minBedrooms
      : input?.minBedrooms ?? input?.maxBedrooms;

  const filteredNew = newListings.filter((a) => {
    if (input?.neighborhood && a.neighborhood !== input.neighborhood) return false;
    if (input?.minBedrooms != null && a.bedrooms < input.minBedrooms) return false;
    if (input?.maxBedrooms != null && a.bedrooms > input.maxBedrooms) return false;

    // Use per-bedroom price when a specific bedroom count is targeted
    let effectivePrice = a.rentMin;
    if (targetBedrooms === 1 && a.price1brMin != null) effectivePrice = a.price1brMin;
    else if (targetBedrooms === 2 && a.price2brMin != null) effectivePrice = a.price2brMin;

    if (input?.minRent != null && effectivePrice < input.minRent) return false;
    if (input?.maxRent != null && effectivePrice > input.maxRent) return false;
    return true;
  });

  return [...merged, ...filteredNew];
}
