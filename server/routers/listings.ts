/**
 * Admin Listings Router
 *
 * Provides admin-only CRUD endpoints for managing apartment listings in the database.
 * These listings are merged with the CSV data at query time, with DB listings taking priority.
 */

import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  getAllListings,
  getActiveListings,
  getListingById,
  createListing,
  updateListing,
  deleteListing,
  toggleListingActive,
} from "../db";
import { storagePut } from "../storage";

// Admin-only guard
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user?.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

// Shared listing input schema
const listingInputSchema = z.object({
  propertyId: z.string().optional().nullable(),
  name: z.string().min(1, "Name is required"),
  address: z.string().optional().nullable(),
  city: z.string().default("Houston"),
  state: z.string().default("TX"),
  neighborhood: z.string().optional().nullable(),
  minRent: z.number().int().min(0, "Minimum rent must be positive"),
  maxRent: z.number().int().optional().nullable(),
  bedrooms: z.number().int().min(0).max(10).optional().nullable(),
  bathrooms: z.number().int().min(0).max(10).optional().nullable(),
  minSqft: z.number().int().optional().nullable(),
  maxSqft: z.number().int().optional().nullable(),
  builtYear: z.number().int().min(1900).max(2030).optional().nullable(),
  availability: z.string().optional().nullable(),
  primaryImageUrl: z.string().url().optional().nullable(),
  imageUrls: z.string().optional().nullable(), // JSON array string
  special: z.string().optional().nullable(),
  featureHighlights: z.string().optional().nullable(),
  exteriorAmenities: z.string().optional().nullable(),
  interiorAmenities: z.string().optional().nullable(),
  petPolicy: z.string().optional().nullable(),
  managedBy: z.string().optional().nullable(),
  latitude: z.string().optional().nullable(),
  longitude: z.string().optional().nullable(),
  isActive: z.number().int().min(0).max(1).default(1),
  sortOrder: z.number().int().default(0),
});

export const listingsRouter = router({
  /**
   * Get all admin-managed listings (admin only)
   */
  list: adminProcedure.query(async () => {
    const rows = await getAllListings();
    return rows;
  }),

  /**
   * Get active listings merged with CSV data (public — used by the search page)
   * Returns SQL listings only; merging with CSV happens in the apartments router.
   */
  activeList: publicProcedure.query(async () => {
    return getActiveListings();
  }),

  /**
   * Get a single listing by ID (admin only)
   */
  get: adminProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const listing = await getListingById(input.id);
      if (!listing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found" });
      }
      return listing;
    }),

  /**
   * Create a new listing (admin only)
   */
  create: adminProcedure
    .input(listingInputSchema)
    .mutation(async ({ input }) => {
      const id = await createListing(input);
      const listing = await getListingById(id);
      return listing;
    }),

  /**
   * Update an existing listing (admin only)
   */
  update: adminProcedure
    .input(z.object({ id: z.number() }).merge(listingInputSchema.partial()))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      const existing = await getListingById(id);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found" });
      }
      await updateListing(id, data);
      return getListingById(id);
    }),

  /**
   * Delete a listing (admin only)
   */
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const existing = await getListingById(input.id);
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Listing not found" });
      }
      await deleteListing(input.id);
      return { success: true };
    }),

  /**
   * Toggle active/inactive status (admin only)
   */
  toggleActive: adminProcedure
    .input(z.object({ id: z.number(), isActive: z.boolean() }))
    .mutation(async ({ input }) => {
      await toggleListingActive(input.id, input.isActive);
      return { success: true };
    }),

  /**
   * Upload a photo for a listing and return the storage URL (admin only)
   * Accepts base64-encoded image data.
   */
  uploadPhoto: adminProcedure
    .input(
      z.object({
        filename: z.string(),
        mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
        base64Data: z.string(), // base64-encoded image
      })
    )
    .mutation(async ({ input }) => {
      const buffer = Buffer.from(input.base64Data, "base64");
      const ext = input.mimeType.split("/")[1];
      const key = `listings/${Date.now()}-${input.filename.replace(/[^a-zA-Z0-9._-]/g, "_")}.${ext}`;

      const { url } = await storagePut(key, buffer, input.mimeType);
      return { url, key };
    }),
});
