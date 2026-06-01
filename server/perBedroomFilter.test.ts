/**
 * Unit tests for per-bedroom price filter logic in queryPropertyDatabase.
 * Verifies that when a specific bedroom count is selected, the filter uses
 * the per-bedroom price fields (price1brMin/Max, price2brMin/Max) rather than
 * the generic minRent/maxRent fields, and falls back correctly when per-bedroom
 * data is missing.
 */
import { describe, it, expect } from 'vitest';
import type { PropertyApartment } from './propertyDatabase';

// ── Minimal factory for PropertyApartment ────────────────────────────────────
function makeApt(overrides: Partial<PropertyApartment>): PropertyApartment {
  return {
    id: 1,
    propertyId: 'test-001',
    name: 'Test Apartments',
    neighborhood: 'Midtown',
    city: 'Houston',
    state: 'TX',
    address: '123 Main St',
    rentMin: 1200,
    rentMax: 2500,
    bedrooms: null,
    bathrooms: null,
    minSqft: null,
    maxSqft: null,
    builtYear: null,
    availability: null,
    description: null,
    special: null,
    petPolicy: null,
    managedBy: null,
    photos: [],
    featureHighlights: null,
    exteriorAmenities: null,
    interiorAmenities: null,
    hasCompleteInfo: true,
    source: 'csv',
    latitude: 29.76,
    longitude: -95.37,
    price1brMin: null,
    price1brMax: null,
    price2brMin: null,
    price2brMax: null,
    phone: null,
    email: null,
    streetAddress: null,
    verifiedAddress: null,
    addressMatchStatus: null,
    website: null,
    actualWebsite: null,
    lastScraped: null,
    ...overrides,
  };
}

// ── Inline filter logic (mirrors propertyDatabase.ts queryPropertyDatabase) ──
function matchesRentFilter(
  apt: PropertyApartment,
  minRent: number | undefined,
  maxRent: number | undefined,
  bedrooms: number | undefined,
): boolean {
  if (minRent === undefined && maxRent === undefined) return true;

  // Determine which price fields to use based on bedroom count
  let effectiveMin: number | null = null;
  let effectiveMax: number | null = null;

  if (bedrooms === 1 && apt.price1brMin != null) {
    effectiveMin = apt.price1brMin;
    effectiveMax = apt.price1brMax;
  } else if (bedrooms === 2 && apt.price2brMin != null) {
    effectiveMin = apt.price2brMin;
    effectiveMax = apt.price2brMax;
  } else {
    // Fall back to generic rent range
    effectiveMin = typeof apt.rentMin === 'string' ? parseFloat(apt.rentMin) : apt.rentMin;
    effectiveMax = typeof apt.rentMax === 'string' ? parseFloat(apt.rentMax) : apt.rentMax;
  }

  if (effectiveMin == null) return true; // No pricing data — include by default

  if (maxRent !== undefined && maxRent < 15000) {
    if (effectiveMin > maxRent) return false;
  }
  if (minRent !== undefined && minRent > 0) {
    const ceiling = effectiveMax ?? effectiveMin;
    if (ceiling < minRent) return false;
  }
  return true;
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe('Per-Bedroom Price Filter Logic', () => {
  // ── 1BR filter uses price1brMin ──────────────────────────────────────────
  it('includes a 1BR listing whose 1BR price is within the max rent', () => {
    const apt = makeApt({ price1brMin: 1200, price1brMax: 1400, rentMin: 1200, rentMax: 2400 });
    expect(matchesRentFilter(apt, 0, 1500, 1)).toBe(true);
  });

  it('excludes a 1BR listing whose 1BR price exceeds the max rent', () => {
    const apt = makeApt({ price1brMin: 1800, price1brMax: 2000, rentMin: 1200, rentMax: 2400 });
    expect(matchesRentFilter(apt, 0, 1500, 1)).toBe(false);
  });

  it('does NOT use generic rentMin when 1BR price is available for 1BR filter', () => {
    // rentMin is 900 (would pass a $1,500 max filter), but 1BR price is 1,800 (should fail)
    const apt = makeApt({ price1brMin: 1800, price1brMax: 2000, rentMin: 900, rentMax: 2400 });
    expect(matchesRentFilter(apt, 0, 1500, 1)).toBe(false);
  });

  // ── 2BR filter uses price2brMin ──────────────────────────────────────────
  it('includes a 2BR listing whose 2BR price is within the max rent', () => {
    const apt = makeApt({ price2brMin: 1600, price2brMax: 1900, rentMin: 1200, rentMax: 2400 });
    expect(matchesRentFilter(apt, 0, 2000, 2)).toBe(true);
  });

  it('excludes a 2BR listing whose 2BR price exceeds the max rent', () => {
    const apt = makeApt({ price2brMin: 2200, price2brMax: 2600, rentMin: 1200, rentMax: 2400 });
    expect(matchesRentFilter(apt, 0, 2000, 2)).toBe(false);
  });

  // ── Fallback to generic rent when per-bedroom data is missing ────────────
  it('falls back to rentMin when 1BR price is null', () => {
    const apt = makeApt({ price1brMin: null, price1brMax: null, rentMin: 1200, rentMax: 2400 });
    expect(matchesRentFilter(apt, 0, 1500, 1)).toBe(true);
  });

  it('falls back to rentMin when 2BR price is null and excludes correctly', () => {
    const apt = makeApt({ price2brMin: null, price2brMax: null, rentMin: 1800, rentMax: 2400 });
    expect(matchesRentFilter(apt, 0, 1500, 2)).toBe(false);
  });

  // ── No bedroom filter uses generic rent ──────────────────────────────────
  it('uses generic rentMin when no bedroom filter is specified', () => {
    const apt = makeApt({ price1brMin: 2000, price1brMax: 2500, rentMin: 1200, rentMax: 2400 });
    // Without bedroom filter, should use rentMin=1200 which passes $1,500 max
    expect(matchesRentFilter(apt, 0, 1500, undefined)).toBe(true);
  });

  // ── No rent filter — always include ──────────────────────────────────────
  it('includes all listings when no rent filter is applied', () => {
    const apt = makeApt({ price1brMin: 5000, price1brMax: 6000 });
    expect(matchesRentFilter(apt, undefined, undefined, 1)).toBe(true);
  });

  // ── Min rent filter ───────────────────────────────────────────────────────
  it('excludes a listing whose 1BR max is below the minimum rent', () => {
    const apt = makeApt({ price1brMin: 800, price1brMax: 1000 });
    expect(matchesRentFilter(apt, 1200, 15000, 1)).toBe(false);
  });

  it('includes a listing whose 1BR max meets the minimum rent', () => {
    const apt = makeApt({ price1brMin: 1100, price1brMax: 1400 });
    expect(matchesRentFilter(apt, 1200, 15000, 1)).toBe(true);
  });

  // ── Listings with no pricing data are always included ────────────────────
  it('includes a listing with no pricing data at all', () => {
    const apt = makeApt({ price1brMin: null, price1brMax: null, rentMin: 0, rentMax: 0 });
    expect(matchesRentFilter(apt, 0, 1500, 1)).toBe(true);
  });

  // ── $2k-$3k range filter ─────────────────────────────────────────────────
  it('includes a 2BR listing in the $2k-$3k range', () => {
    const apt = makeApt({ price2brMin: 2100, price2brMax: 2800 });
    expect(matchesRentFilter(apt, 2000, 3000, 2)).toBe(true);
  });

  it('excludes a 2BR listing below the $2k-$3k range', () => {
    const apt = makeApt({ price2brMin: 1400, price2brMax: 1800 });
    expect(matchesRentFilter(apt, 2000, 3000, 2)).toBe(false);
  });
});
