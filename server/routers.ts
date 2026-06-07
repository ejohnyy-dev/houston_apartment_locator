import { getSessionCookieOptions, COOKIE_NAME } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, adminProcedure } from "./_core/trpc";
import { leadsRateLimiter, leadsIpRateLimiter } from "./_core/rateLimiter";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  getRentCastDatabaseApartments,
  getRentCastDatabaseStats,
} from "./rentcastDatabase";
import { notifyOwner } from "./_core/notification";
import { createInquiry, getActiveListings, createQualifiedSession, getQualifiedSessionByToken, getQualifiedSessionByEmail } from "./db";
import { randomBytes } from "crypto";
import { integrationsRouter } from "./routers/integrations";
import { reportsRouter } from "./routers/reports";
import { nurtureRouter } from "./routers/nurture";
import { listingsRouter } from "./routers/listings";
import { rentcastRouter } from "./routers/rentcast";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  integrations: integrationsRouter,
  reports: reportsRouter,
  nurture: nurtureRouter,
  listings: listingsRouter,
  rentcast: rentcastRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // ============= APARTMENT LISTINGS ROUTER =============
  apartments: router({
    /**
     * Get all apartments with optional filters (public - teased data only)
     */
    list: publicProcedure
      .input(
        z.object({
          neighborhood: z.string().optional(),
          minBedrooms: z.number().optional(),
          maxBedrooms: z.number().optional(),
          minRent: z.number().optional(),
          maxRent: z.number().optional(),
        }).optional()
      )
      .query(async ({ input }) => {
        try {
          // Get base apartments from RentCast (blends CSV) or CSV only
          let baseApartments: any[];
          if (process.env.RENTCAST_API_KEY) {
            baseApartments = await getRentCastDatabaseApartments(input);
          } else {
            const { queryPropertyDatabase } = await import('./propertyDatabase');
            baseApartments = await queryPropertyDatabase(input);
          }

          // Merge admin-managed SQL listings on top
          // DB listings with a propertyId override matching CSV entries;
          // DB listings without a propertyId are appended as new results.
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
        } catch (error) {
          console.error('Failed to fetch apartments:', error);
          throw new Error('Unable to fetch apartments. Please try again.');
        }
      }),

    /**
     * Get apartments with move-in specials (public)
     */
    specials: publicProcedure.query(async () => {
      try {
        // Prefer RentCast blended data, fall back to CSV-only
        let allApartments: any[];
        if (process.env.RENTCAST_API_KEY) {
          allApartments = await getRentCastDatabaseApartments();
        } else {
          const { queryPropertyDatabase } = await import('./propertyDatabase');
          allApartments = await queryPropertyDatabase();
        }

        // Also include admin-managed listings with specials
        const dbListings = await getActiveListings();
        const dbWithSpecials = dbListings
          .filter(l => l.special && l.special.trim())
          .map(l => ({
            id: l.propertyId ?? `db-${l.id}`,
            name: l.name,
            neighborhood: l.neighborhood ?? l.city ?? '',
            special: l.special,
            rentMin: l.minRent,
            rentMax: l.maxRent ?? null,
          }));

        // Filter CSV/RentCast apartments that have a non-empty special
        const csvWithSpecials = allApartments
          .filter((a: any) => a.special && String(a.special).trim())
          .map((a: any) => ({
            id: a.id,
            name: a.name,
            neighborhood: a.neighborhood,
            special: a.special,
            rentMin: a.rentMin,
            rentMax: a.rentMax ?? null,
          }));

        // Merge: admin listings override CSV entries with same propertyId
        const overrideIds = new Set(dbListings.filter(l => l.propertyId).map(l => l.propertyId!));
        const merged = [
          ...csvWithSpecials.filter((a: any) => !overrideIds.has(String(a.id))),
          ...dbWithSpecials,
        ];

        return merged.slice(0, 50); // cap at 50 for the page
      } catch (error) {
        console.error('Failed to fetch specials:', error);
        throw new Error('Unable to fetch move-in specials. Please try again.');
      }
    }),

    /**
     * Get database stats (inventory count, budget, etc.)
     */
    databaseStats: adminProcedure.query(async () => {
      try {
        if (process.env.RENTCAST_API_KEY) {
          return await getRentCastDatabaseStats();
        }
        return {
          source: null,
          status: 'disabled' as const,
          totalProperties: 0,
          eligibleProperties: 0,
          withPricing: 0,
          withPhotos: 0,
          withSpecials: 0,
          cities: 0,
          lastUpdated: null,
        };
      } catch (error) {
        console.error('Failed to fetch database stats:', error);
        throw new Error('Unable to fetch database statistics. Please try again.');
      }
    }),
  }),

  // ============= INQUIRIES ROUTER =============
  inquiries: router({
    /**
     * Create a new apartment inquiry (lead capture)
     * Sends to Google Sheets, HubSpot, and notifies owner
     */
    create: publicProcedure
      .input(
        z.object({
          apartmentId: z.string(),
          apartmentName: z.string(),
          name: z.string().min(1, "Name is required"),
          email: z.string().email("Valid email is required"),
          phone: z.string().min(7, "Valid phone number is required").refine(
            (val) => /\d{7,}/.test(val.replace(/\D/g, "")),
            "Phone number must contain at least 7 digits"
          ),
          moveInDate: z.string().optional(),
          message: z.string().optional(),
          favoriteIds: z.string().optional(), // JSON array of favorite apartment IDs
          qualificationData: z.string().optional(), // JSON stringified qualification data
        })
      )
      .mutation(async ({ input, ctx }) => {
        // Rate-limit by email (5/hr) and IP (20/hr)
        const clientIp = (ctx.req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
          || ctx.req.socket?.remoteAddress
          || 'unknown';
        if (!leadsRateLimiter.isAllowed(input.email)) {
          const retryAfter = Math.ceil((leadsRateLimiter.getResetTime(input.email) - Date.now()) / 1000);
          throw new TRPCError({
            code: 'TOO_MANY_REQUESTS',
            message: `Too many submissions from this email. Please try again in ${Math.ceil(retryAfter / 60)} minute(s).`,
          });
        }
        if (!leadsIpRateLimiter.isAllowed(clientIp)) {
          const retryAfter = Math.ceil((leadsIpRateLimiter.getResetTime(clientIp) - Date.now()) / 1000);
          throw new TRPCError({
            code: 'TOO_MANY_REQUESTS',
            message: `Too many submissions from this location. Please try again in ${Math.ceil(retryAfter / 60)} minute(s).`,
          });
        }
        try {
          // Parse name into first and last
          const nameParts = input.name.trim().split(/\s+/);
          const firstName = nameParts[0] || "";
          const lastName = nameParts.slice(1).join(" ") || "";

          // Parse favorite IDs if provided
          let favoriteApartmentIds: string[] = [];
          if (input.favoriteIds) {
            try {
              favoriteApartmentIds = JSON.parse(input.favoriteIds);
            } catch (e) {
              console.warn("Failed to parse favoriteIds:", e);
            }
          }

          // Parse qualification data if provided
          let qualificationFields: Record<string, any> = {};
          if (input.qualificationData) {
            try {
              const qual = JSON.parse(input.qualificationData);
              qualificationFields = {
                preferredAreas: qual.preferredAreas?.join(", ") || "",
                moveInTimeline: qual.moveInTimeline || "",
                bedrooms: qual.bedrooms || "",
                bathrooms: qual.bathrooms || "",
                budget: qual.budget || "",
                pets: qual.pets?.join(", ") || "",
              };
            } catch (e) {
              console.warn("Failed to parse qualificationData:", e);
            }
          }

          // Prepare payload for Google Sheets and HubSpot
          // Build payload matching Google Sheet column order: source, first_name, last_name, name, email, phone, budget, bedrooms, move_in_timeline, preferred_area, pets, notes, sms_consent, consent_source, consent_timestamp, opt_out, page_url, user_agent
          const payload = {
            source: "website",
            first_name: firstName,
            last_name: lastName,
            name: input.name,
            email: input.email,
            phone: input.phone,
            budget: qualificationFields.budget || "",
            bedrooms: qualificationFields.bedrooms || "",
            move_in_timeline: qualificationFields.moveInTimeline || "",
            preferred_area: qualificationFields.preferredAreas || "",
            pets: qualificationFields.pets || "",
            notes: input.message || "",
            sms_consent: true,
            consent_source: "txaptfinder.com",
            consent_timestamp: new Date().toISOString(),
            opt_out: false,
            page_url: "https://txaptfinder.com",
            user_agent: (ctx.req.headers["user-agent"] as string) || "",
          };

          // Send to Google Sheets
          const googleSheetsUrl = process.env.GOOGLE_SHEETS_ENDPOINT;
          if (googleSheetsUrl) {
            try {
              const response = await fetch(googleSheetsUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                redirect: "follow",
              });
              if (response.ok) {
                console.log("[Google Sheets] Lead submitted successfully");
              } else {
                console.warn("[Google Sheets] Unexpected status:", response.status);
              }
            } catch (googleError) {
              console.error("[Google Sheets] Error:", googleError);
            }
          }

          // Send to HubSpot
          const hubspotToken = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
          if (hubspotToken) {
            try {
              const hubspotPayload = {
                properties: {
                  firstname: firstName,
                  lastname: lastName,
                  email: input.email,
                  phone: input.phone,
                  apartment_name: input.apartmentName,
                  apartment_id: input.apartmentId,
                  move_in_date: input.moveInDate || "",
                  message: input.message || "",
                  favorite_apartments: favoriteApartmentIds.join(", ") || "None",
                  lifecyclestage: "lead",
                },
              };

              const hubspotResponse = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${hubspotToken}`,
                },
                body: JSON.stringify(hubspotPayload),
              });

              if (hubspotResponse.ok) {
                console.log("[HubSpot] Lead submitted successfully");
              } else {
                console.warn("[HubSpot] Unexpected status:", hubspotResponse.status);
              }
            } catch (hubspotError) {
              console.error("[HubSpot] Error:", hubspotError);
            }
          }

          // Notify owner of new inquiry
          await notifyOwner({
            title: `New Apartment Inquiry: ${input.apartmentName}`,
            content: `Name: ${input.name}\nEmail: ${input.email}\nPhone: ${input.phone}\nMove-in Date: ${input.moveInDate || "Not specified"}\nMessage: ${input.message || "No additional message"}\nSaved Apartments: ${favoriteApartmentIds.length > 0 ? favoriteApartmentIds.join(", ") : "None"}`,
          });

          // Store inquiry in database
          // Schedule nurture follow-up for 24 hours from now
          const nurtureScheduledFor = new Date(Date.now() + 24 * 60 * 60 * 1000);
          await createInquiry({
            name: input.name,
            email: input.email,
            phone: input.phone,
            apartmentId: input.apartmentId,
            apartmentName: input.apartmentName,
            moveInDate: input.moveInDate || null,
            message: input.message || null,
            favoriteIds: input.favoriteIds || null,
            qualificationData: input.qualificationData || null,
            source: "website",
            nurtureStage: "pending",
            nurtureScheduledFor,
          });

          // Create a qualified session so this visitor stays qualified across sessions.
          // The token is set as a long-lived cookie (1 year) and also returned in the
          // response so the client can store it in localStorage as a fallback.
          const sessionToken = randomBytes(32).toString('hex');
          const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year
          try {
            await createQualifiedSession({
              sessionToken,
              email: input.email.toLowerCase().trim(),
              qualificationData: input.qualificationData || null,
              expiresAt,
            });
            // Set a long-lived cookie so the browser sends it back automatically
            ctx.res.cookie('qual_session', sessionToken, {
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
              maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year in ms
              path: '/',
            });
          } catch (sessionError) {
            // Non-fatal: log but don't fail the inquiry submission
            console.warn('[QualSession] Failed to create qualified session:', sessionError);
          }

          return {
            success: true,
            message: "Inquiry submitted successfully",
            sessionToken, // also returned so client can store in localStorage
          };
        } catch (error) {
          console.error("Failed to create inquiry:", error);
          throw new Error("Failed to submit inquiry. Please try again.");
        }
      }),
  }),

  // ============= QUALIFICATION PERSISTENCE ROUTER =============
  qualification: router({
    /**
     * Check if the current visitor has a valid qualified session.
     * Reads the qual_session cookie (set after first inquiry submission).
     * Returns { qualified: true, qualificationData } if found, else { qualified: false }.
     */
    check: publicProcedure.query(async ({ ctx }) => {
      const cookieHeader = ctx.req.headers.cookie || '';
      // Parse qual_session from cookie string
      const match = cookieHeader.match(/(?:^|;\s*)qual_session=([^;]+)/);
      const token = match ? decodeURIComponent(match[1]) : null;
      if (!token) return { qualified: false, qualificationData: null };
      try {
        const session = await getQualifiedSessionByToken(token);
        if (!session) return { qualified: false, qualificationData: null };
        return {
          qualified: true,
          qualificationData: session.qualificationData
            ? JSON.parse(session.qualificationData)
            : null,
        };
      } catch {
        return { qualified: false, qualificationData: null };
      }
    }),

    /**
     * Re-qualify a visitor by email (e.g. on a new device where the cookie is absent).
     * If a valid session exists for this email, sets the qual_session cookie and returns qualified.
     */
    checkByEmail: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(async ({ ctx, input }) => {
        try {
          const session = await getQualifiedSessionByEmail(input.email);
          if (!session) return { qualified: false, qualificationData: null };
          // Re-issue the cookie so future page loads are automatic
          ctx.res.cookie('qual_session', session.sessionToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 365 * 24 * 60 * 60 * 1000,
            path: '/',
          });
          return {
            qualified: true,
            qualificationData: session.qualificationData
              ? JSON.parse(session.qualificationData)
              : null,
            sessionToken: session.sessionToken,
          };
        } catch {
          return { qualified: false, qualificationData: null };
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
