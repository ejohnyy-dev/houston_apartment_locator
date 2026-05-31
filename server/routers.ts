import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import {
  getApartmentsForLead,
  getApartmentFull,
  getApartmentWithAmenities,
  createLead,
  getLeadById,
  getAllLeads,
  updateLead,
  recordLeadInteraction,
  getAllAmenities,
  createAmenity,
  createApartment,
  createSavedSearch,
  getSavedSearchesByLead,
  deleteSavedSearch,
  addFavorite,
  removeFavorite,
  getFavoritesByLead,
  isFavorited,
  createEmailSubscription,
  getActiveEmailSubscriptions,
  getEmailSubscriptionsByLead,
  updateEmailSubscription,
  deleteEmailSubscription,
} from "./db";
import {
  getPropertyDatabaseApartments,
  getPropertyDatabaseStats,
  hasPropertyDatabase,
} from "./propertyDatabase";
import {
  getRentCastDatabaseApartments,
  getRentCastDatabaseStats,
} from "./rentcastDatabase";
import { notifyOwner } from "./_core/notification";
import { 
  sendEmail, 
  renderNewLeadEmail, 
  renderMonthlyReportEmail,
  renderNurtureEmail1,
  renderNurtureEmail2,
  renderNurtureEmail3 
} from "./email";
import { checkRateLimit, getClientIp } from "./rateLimit";
import { trackSearch, trackView, getAnalyticsSummary, getTopSearches, getTopCities } from "./analytics";

/**
 * Admin-only procedure - checks if user is admin
 */
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new Error('Unauthorized: Admin access required');
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,

  // ============= HEALTH CHECK =============
  health: publicProcedure.query(async () => {
    return { status: 'ok', timestamp: new Date() };
  }),

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
          amenityIds: z.array(z.number()).optional(),
          // New renter-focused filters (ported from development)
          minBathrooms: z.number().optional(),
          maxBathrooms: z.number().optional(),
          hasSpecial: z.boolean().optional(),
          minSqft: z.number().optional(),
          maxSqft: z.number().optional(),
        }).optional()
      )
      .query(async ({ input }) => {
        try {
          // Track search for analytics
          if (input) {
            await trackSearch({
              neighborhood: input.neighborhood,
              minRent: input.minRent,
              maxRent: input.maxRent,
              minBedrooms: input.minBedrooms,
              maxBedrooms: input.maxBedrooms,
              // New filter fields
              minBathrooms: input.minBathrooms,
              maxBathrooms: input.maxBathrooms,
              hasSpecial: input.hasSpecial,
              minSqft: input.minSqft,
              maxSqft: input.maxSqft,
              source: 'search',
            }).catch(err => console.error('[Analytics] Failed to track search', err));
          }

          if (process.env.RENTCAST_API_KEY) {
            return await getRentCastDatabaseApartments(input);
          }

          if (await hasPropertyDatabase()) {
            return await getPropertyDatabaseApartments(input);
          }

          return await getApartmentsForLead(input);
        } catch (error) {
          console.error('Failed to fetch apartments:', error);
          throw new Error('Unable to fetch apartments. Please try again.');
        }
      }),

    databaseStats: publicProcedure.query(async () => {
      try {
        if (process.env.RENTCAST_API_KEY) {
          return await getRentCastDatabaseStats();
        }

        return await getPropertyDatabaseStats();
      } catch (error) {
        console.error('Failed to fetch database stats:', error);
        throw new Error('Unable to fetch database statistics. Please try again.');
      }
    }),

    /**
     * Get single apartment teased details (public - no exact address/landlord/availability)
     */
    getTeased: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const apartment = await getApartmentFull(input.id);
        if (!apartment) return null;

        // Return only teased data
        return {
          id: apartment.id,
          name: apartment.name,
          neighborhood: apartment.neighborhood,
          bedrooms: apartment.bedrooms,
          bathrooms: apartment.bathrooms,
          rentMin: apartment.rentMin,
          rentMax: apartment.rentMax,
          description: apartment.description,
          latitude: apartment.latitude,
          longitude: apartment.longitude,
          photos: apartment.photos,
        };
      }),

    /**
     * Get full apartment details (owner only - includes sensitive data)
     */
    getFull: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getApartmentFull(input.id);
      }),

    /**
     * Get apartment with amenities (owner only)
     */
    getWithAmenities: adminProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return await getApartmentWithAmenities(input.id);
      }),

    /**
     * Create new apartment (owner only)
     */
    create: adminProcedure
      .input(
        z.object({
          name: z.string(),
          neighborhood: z.string(),
          bedrooms: z.number(),
          bathrooms: z.number(),
          rentMin: z.number(),
          rentMax: z.number().optional(),
          description: z.string().optional(),
          latitude: z.number(),
          longitude: z.number(),
          photos: z.array(z.string()).optional(),
          exactAddress: z.string().optional(),
          landlordName: z.string().optional(),
          landlordPhone: z.string().optional(),
          landlordEmail: z.string().optional(),
          unitsAvailable: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const result = await createApartment(input);
        return { success: true, insertId: (result as any).insertId ?? 0 };
      }),


  }),

  // ============= LEADS ROUTER =============
  leads: router({
    /**
     * Submit lead information (public - anyone can submit)
     */
    submit: publicProcedure
      .input(
        z.object({
          name: z.string().min(1),
          email: z.string().email(),
          phone: z.string().min(10),
          moveTimeline: z.string().optional(),   // Added for txaptfinder.com nurture + prioritization (vault spec)
        })
      )
      .mutation(async ({ input, ctx }) => {
        // Rate limiting: max 30 submissions per minute per IP
        const clientIp = getClientIp(
          ctx.req.headers as Record<string, string>
        );

        const rateLimitResult = checkRateLimit(clientIp);

        if (!rateLimitResult.allowed) {
          throw new Error('Too many submissions. Please try again later.');
        }

        const result = await createLead({
          name: input.name,
          email: input.email,
          phone: input.phone,
          moveTimeline: input.moveTimeline,
        });

        const leadId = (result as any).insertId || 0;

        // ============================================
        // TX APT FINDER NURTURE — Email 1 (Immediate)
        // Exact sequence from Obsidian vault
        // ============================================
        try {
          const firstName = input.name.split(' ')[0] || input.name;
          const nurtureHtml = renderNurtureEmail1(
            firstName,
            input.moveTimeline,           // will be used in copy if provided
            undefined,                    // budget (future enhancement)
            undefined                     // neighborhoods (future)
          );

          await sendEmail({
            to: input.email,
            subject: `Got your Houston apartment details, ${firstName} — here's what happens next`,
            html: nurtureHtml,
          });

          // Update nurture stage in DB (for future Day 2 / Day 5 scheduling)
          // await updateLead(leadId, { 
          //   lastNurtureSentAt: new Date()
          // });
        } catch (error) {
          console.error("Failed to send nurture Email 1 to lead:", error);
        }

        // Notify owner via email (unchanged)
        try {
          const dashboardUrl = `${process.env.WEBSITE_URL || 'http://localhost:3000'}/dashboard?leadId=${leadId}`;
          const emailHtml = renderNewLeadEmail(input.name, input.email, input.phone, dashboardUrl);

          await sendEmail({
            to: process.env.OWNER_EMAIL || '',
            subject: `New Lead: ${input.name}`,
            html: emailHtml,
          });
        } catch (error) {
          console.error("Failed to send owner email:", error);
        }

        // Also use old notification method as backup
        try {
          await notifyOwner({
            title: "New Lead Submitted",
            content: `${input.name} (${input.email}, ${input.phone}) has submitted their information and is interested in apartment listings.`,
          });
        } catch (error) {
          console.error("Failed to notify owner:", error);
        }

        return {
          success: true,
          leadId,
          rateLimitRemaining: rateLimitResult.remaining,
        };
      }),

    /**
     * Get lead by ID (protected - leads can view their own info)
     */
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const lead = await getLeadById(input.id);
        return lead;
      }),

    /**
     * Record lead interaction (view, favorite, inquiry)
     */
    recordInteraction: publicProcedure
      .input(
        z.object({
          leadId: z.number(),
          apartmentId: z.number(),
          interactionType: z.enum(['view', 'favorite', 'inquiry']),
        })
      )
      .mutation(async ({ input }) => {
        await recordLeadInteraction(input.leadId, input.apartmentId, input.interactionType);
        return { success: true };
      }),

    /**
     * Get all leads (owner only)
     */
    list: adminProcedure
      .input(
        z.object({
          status: z.string().optional(),
          searchTerm: z.string().optional(),
        }).optional()
      )
      .query(async ({ input }) => {
        return await getAllLeads(input);
      }),

    /**
     * Update lead status and notes (owner only)
     */
    update: adminProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(['new', 'contacted', 'qualified', 'converted', 'inactive']).optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        await updateLead(input.id, {
          status: input.status,
          notes: input.notes,
          lastContactedAt: input.status ? new Date() : undefined,
        });
        return { success: true };
      }),

    /**
     * Export leads as CSV (owner only)
     */
    exportCsv: adminProcedure.query(async () => {
      const leads = await getAllLeads();
      
      // Build CSV
      const headers = ['ID', 'Name', 'Email', 'Phone', 'Status', 'Submitted At', 'Last Contacted'];
      const rows = leads.map((lead: any) => [
        lead.id,
        lead.name,
        lead.email,
        lead.phone,
        lead.status,
        new Date(lead.submittedAt).toISOString(),
        lead.lastContactedAt ? new Date(lead.lastContactedAt).toISOString() : '',
      ]);

      const csv = [
        headers.join(','),
        ...rows.map((row: any) => row.map((cell: any) => `"${cell}"`).join(',')),
      ].join('\n');

      return { csv, filename: `leads-${Date.now()}.csv` };
    }),
  }),

  // ============= AMENITIES ROUTER =============
  amenities: router({
    /**
     * Get all amenities (public)
     */
    list: publicProcedure.query(async () => {
      return await getAllAmenities();
    }),

    /**
     * Create amenity (owner only)
     */
    create: adminProcedure
      .input(
        z.object({
          name: z.string(),
          icon: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return await createAmenity(input);
      }),
  }),

  // ============= ANALYTICS ROUTER =============
  analytics: router({
    /**
     * Get analytics summary (admin only)
     */
    summary: adminProcedure.query(async () => {
      return await getAnalyticsSummary();
    }),

    /**
     * Get top searches (admin only)
     */
    topSearches: adminProcedure
      .input(z.object({ limit: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return await getTopSearches(input?.limit || 10);
      }),

    /**
     * Get top cities (admin only)
     */
    topCities: adminProcedure.query(async () => {
      return await getTopCities();
    }),

    /**
     * Send monthly report email (admin only)
     */
    sendMonthlyReport: adminProcedure.mutation(async ({ ctx }) => {
      try {
        const summary = await getAnalyticsSummary();
        const html = renderMonthlyReportEmail({
          newLeads: 0, // Would need to fetch from DB
          convertedLeads: 0,
          topCity: summary.topCities[0]?.city || 'N/A',
          rentcastMatches: summary.totalSearches,
          apiUsage: 'Check health endpoint',
        });

        await sendEmail({
          to: process.env.OWNER_EMAIL || '',
          subject: `Monthly Report - ${new Date().toLocaleDateString()}`,
          html,
        });

        return { success: true, message: 'Report sent' };
      } catch (error) {
        console.error('Failed to send monthly report:', error);
        throw new Error('Failed to send report');
      }
    }),
  }),

  // ============= SAVED SEARCHES ROUTER (NEW FEATURE) =============
  savedSearches: router({
    /**
     * Create a new saved search (protected - requires login)
     */
    create: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          neighborhood: z.string().optional(),
          minRent: z.number().optional(),
          maxRent: z.number().optional(),
          minBedrooms: z.number().optional(),
          maxBedrooms: z.number().optional(),
          minBathrooms: z.number().optional(),
          maxBathrooms: z.number().optional(),
          hasSpecial: z.boolean().optional(),
          minSqft: z.number().optional(),
          maxSqft: z.number().optional(),
          amenityIds: z.array(z.number()).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const leadId = ctx.user.id || (ctx.user as any).leadId;
        if (!leadId) {
          throw new Error('Must be logged in to save searches');
        }

        const result = await createSavedSearch({
          leadId,
          name: input.name,
          neighborhood: input.neighborhood,
          minRent: input.minRent,
          maxRent: input.maxRent,
          minBedrooms: input.minBedrooms,
          maxBedrooms: input.maxBedrooms,
          minBathrooms: input.minBathrooms,
          maxBathrooms: input.maxBathrooms,
          hasSpecial: input.hasSpecial,
          minSqft: input.minSqft,
          maxSqft: input.maxSqft,
          amenityIds: input.amenityIds,
        });

        return { success: true, id: (result as any).lastID };
      }),

    /**
     * Get all saved searches for the current user
     */
    list: protectedProcedure.query(async ({ ctx }) => {
      const leadId = ctx.user.id || (ctx.user as any).leadId;
      if (!leadId) {
        throw new Error('Must be logged in to view saved searches');
      }

      return await getSavedSearchesByLead(leadId);
    }),

    /**
     * Delete a saved search
     */
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteSavedSearch(input.id);
        return { success: true };
      }),
  }),

  // ============= FAVORITES ROUTER (NEW FEATURE) =============
  favorites: router({
    /**
     * Add an apartment to favorites
     */
    add: protectedProcedure
      .input(z.object({ apartmentId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const leadId = ctx.user.id || (ctx.user as any).leadId;
        if (!leadId) {
          throw new Error('Must be logged in to save favorites');
        }

        try {
          await addFavorite(leadId, input.apartmentId);
          await recordLeadInteraction(leadId, input.apartmentId, 'favorite');
          return { success: true };
        } catch (error: any) {
          if (error.message?.includes('UNIQUE')) {
            return { success: true, message: 'Already favorited' };
          }
          throw error;
        }
      }),

    /**
     * Remove an apartment from favorites
     */
    remove: protectedProcedure
      .input(z.object({ apartmentId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const leadId = ctx.user.id || (ctx.user as any).leadId;
        if (!leadId) {
          throw new Error('Must be logged in to manage favorites');
        }

        await removeFavorite(leadId, input.apartmentId);
        return { success: true };
      }),

    /**
     * Get all favorite apartments for current user
     */
    list: protectedProcedure.query(async ({ ctx }) => {
      const leadId = ctx.user.id || (ctx.user as any).leadId;
      if (!leadId) {
        throw new Error('Must be logged in to view favorites');
      }

      return await getFavoritesByLead(leadId);
    }),

    /**
     * Check if an apartment is favorited
     */
    isFavorited: protectedProcedure
      .input(z.object({ apartmentId: z.number() }))
      .query(async ({ input, ctx }) => {
        const leadId = ctx.user.id || (ctx.user as any).leadId;
        if (!leadId) return false;

        return await isFavorited(leadId, input.apartmentId);
      }),
  }),

  // ============= EMAIL SUBSCRIPTIONS ROUTER (NEW FEATURE) =============
  emailSubscriptions: router({
    /**
     * Create a new email subscription for a saved search
     */
    create: protectedProcedure
      .input(
        z.object({
          savedSearchId: z.number().optional(),
          emailAddress: z.string().email(),
          frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly']).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const leadId = ctx.user.id || (ctx.user as any).leadId;
        if (!leadId) {
          throw new Error('Must be logged in to subscribe');
        }

        const result = await createEmailSubscription({
          leadId,
          savedSearchId: input.savedSearchId,
          emailAddress: input.emailAddress,
          frequency: input.frequency || 'weekly',
        });

        return { success: true, id: (result as any).lastID };
      }),

    /**
     * Get all email subscriptions for current user
     */
    list: protectedProcedure.query(async ({ ctx }) => {
      const leadId = ctx.user.id || (ctx.user as any).leadId;
      if (!leadId) {
        throw new Error('Must be logged in to view subscriptions');
      }

      return await getEmailSubscriptionsByLead(leadId);
    }),

    /**
     * Update an email subscription (unsubscribe or change frequency)
     */
    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          isActive: z.boolean().optional(),
          frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly']).optional(),
        })
      )
      .mutation(async ({ input }) => {
        await updateEmailSubscription(input.id, {
          isActive: input.isActive,
        });
        return { success: true };
      }),

    /**
     * Delete an email subscription
     */
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteEmailSubscription(input.id);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
