import { getSessionCookieOptions, COOKIE_NAME } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  getRentCastDatabaseApartments,
  getRentCastDatabaseStats,
} from "./rentcastDatabase";
import { notifyOwner } from "./_core/notification";
import { createInquiry } from "./db";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
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
          if (process.env.RENTCAST_API_KEY) {
            return await getRentCastDatabaseApartments(input);
          }
          return [];
        } catch (error) {
          console.error('Failed to fetch apartments:', error);
          throw new Error('Unable to fetch apartments. Please try again.');
        }
      }),

    /**
     * Get database stats (inventory count, budget, etc.)
     */
    databaseStats: publicProcedure.query(async () => {
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
        })
      )
      .mutation(async ({ input }) => {
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

          // Prepare payload for Google Sheets and HubSpot
          const payload = {
            firstName,
            lastName,
            name: input.name,
            email: input.email,
            phone: input.phone,
            apartmentName: input.apartmentName,
            apartmentId: input.apartmentId,
            moveInDate: input.moveInDate || "",
            message: input.message || "",
            favoriteApartmentIds: favoriteApartmentIds.join(", ") || "None",
            source: "website",
            smsConsent: true,
            consentSource: "txaptfinder.com",
            pageUrl: "https://txaptfinder.com",
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

              await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${hubspotToken}`,
                },
                body: JSON.stringify(hubspotPayload),
              });
              console.log("[HubSpot] Lead submitted successfully");
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
          await createInquiry({
            name: input.name,
            email: input.email,
            phone: input.phone,
            apartmentId: input.apartmentId,
            apartmentName: input.apartmentName,
            moveInDate: input.moveInDate || null,
            message: input.message || null,
            favoriteIds: input.favoriteIds || null,
            source: "website",
          });

          return {
            success: true,
            message: "Inquiry submitted successfully",
          };
        } catch (error) {
          console.error("Failed to create inquiry:", error);
          throw new Error("Failed to submit inquiry. Please try again.");
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
