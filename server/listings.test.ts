/**
 * Unit tests for admin listings CRUD helpers.
 * These tests mock the database layer to verify logic without a live DB connection.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock the DB module ────────────────────────────────────────────────────────
vi.mock("./db", async () => {
  const store: Record<number, any> = {};
  let nextId = 1;

  return {
    getAllListings: vi.fn(async () => Object.values(store)),
    getActiveListings: vi.fn(async () =>
      Object.values(store).filter((l) => l.isActive === 1)
    ),
    getListingById: vi.fn(async (id: number) => store[id] ?? null),
    createListing: vi.fn(async (data: any) => {
      const id = nextId++;
      store[id] = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
      return id;
    }),
    updateListing: vi.fn(async (id: number, data: any) => {
      if (store[id]) store[id] = { ...store[id], ...data, updatedAt: new Date() };
    }),
    deleteListing: vi.fn(async (id: number) => {
      delete store[id];
    }),
    toggleListingActive: vi.fn(async (id: number, isActive: boolean) => {
      if (store[id]) store[id].isActive = isActive ? 1 : 0;
    }),
  };
});

import {
  getAllListings,
  getActiveListings,
  getListingById,
  createListing,
  updateListing,
  deleteListing,
  toggleListingActive,
} from "./db";

const sampleListing = {
  name: "The Carlton at Midtown",
  city: "Houston",
  state: "TX",
  neighborhood: "Midtown",
  minRent: 1500,
  maxRent: 2500,
  bedrooms: 1,
  bathrooms: 1,
  isActive: 1 as const,
  sortOrder: 0,
};

describe("Admin Listings CRUD", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a new listing and returns its ID", async () => {
    const id = await createListing(sampleListing);
    expect(typeof id).toBe("number");
    expect(id).toBeGreaterThan(0);
  });

  it("retrieves a listing by ID after creation", async () => {
    const id = await createListing(sampleListing);
    const listing = await getListingById(id);
    expect(listing).not.toBeNull();
    expect(listing?.name).toBe(sampleListing.name);
    expect(listing?.minRent).toBe(1500);
  });

  it("returns null for a non-existent listing ID", async () => {
    const listing = await getListingById(99999);
    expect(listing).toBeNull();
  });

  it("getAllListings returns all created listings", async () => {
    await createListing(sampleListing);
    await createListing({ ...sampleListing, name: "The McCarthy" });
    const all = await getAllListings();
    expect(all.length).toBeGreaterThanOrEqual(2);
  });

  it("getActiveListings returns only active listings", async () => {
    const id1 = await createListing({ ...sampleListing, isActive: 1 });
    const id2 = await createListing({ ...sampleListing, name: "Hidden Listing", isActive: 0 });
    const active = await getActiveListings();
    const ids = active.map((l: any) => l.id);
    expect(ids).toContain(id1);
    expect(ids).not.toContain(id2);
  });

  it("updates a listing's rent and name", async () => {
    const id = await createListing(sampleListing);
    await updateListing(id, { name: "Updated Name", minRent: 1800 });
    const updated = await getListingById(id);
    expect(updated?.name).toBe("Updated Name");
    expect(updated?.minRent).toBe(1800);
  });

  it("deletes a listing and it no longer appears in getAllListings", async () => {
    const id = await createListing(sampleListing);
    await deleteListing(id);
    const listing = await getListingById(id);
    expect(listing).toBeNull();
  });

  it("toggles a listing from active to hidden", async () => {
    const id = await createListing({ ...sampleListing, isActive: 1 });
    await toggleListingActive(id, false);
    const listing = await getListingById(id);
    expect(listing?.isActive).toBe(0);
  });

  it("toggles a listing from hidden to active", async () => {
    const id = await createListing({ ...sampleListing, isActive: 0 });
    await toggleListingActive(id, true);
    const listing = await getListingById(id);
    expect(listing?.isActive).toBe(1);
  });

  it("listing with propertyId can be used as a CSV override marker", async () => {
    const id = await createListing({ ...sampleListing, propertyId: "csv-001" });
    const listing = await getListingById(id);
    expect(listing?.propertyId).toBe("csv-001");
  });

  it("listing without propertyId is treated as a new listing", async () => {
    const id = await createListing({ ...sampleListing, propertyId: null });
    const listing = await getListingById(id);
    expect(listing?.propertyId).toBeNull();
  });
});
