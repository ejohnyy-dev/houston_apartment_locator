import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  getRentCastDatabaseApartments,
  getRentCastDatabaseStats,
} from "./rentcastDatabase";
import { notifyOwner } from "./_core/notification";

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
     */
    create: publicProcedure
      .input(
        z.object({
          apartmentId: z.string(),
          apartmentName: z.string(),
          name: z.string().min(1, "Name is required"),
          email: z.string().email("Valid email is required"),
          phone: z.string().min(10, "Valid phone number is required"),
          moveInDate: z.string().optional(),
          message: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          // Notify owner of new inquiry
          await notifyOwner({
            title: `New Apartment Inquiry: ${input.apartmentName}`,
            content: `Name: ${input.name}\nEmail: ${input.email}\nPhone: ${input.phone}\nMove-in Date: ${input.moveInDate || "Not specified"}\nMessage: ${input.message || "No additional message"}`,
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
