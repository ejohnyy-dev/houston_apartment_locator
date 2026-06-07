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
import { seedSampleData } from "./seed";
import { ENV } from "./_core/env";

/**
 * Admin-only procedure - checks if user is admin
 */

// ── Helper to format rent display ────────────────────────────────────────
function formatRent(min: string | number | null, max: string | number | null): string {
  const minNum = typeof min === 'string' ? parseFloat(min) : min;
  const maxNum = typeof max === 'string' ? parseFloat(max) : max;
  if (!minNum && !maxNum) return 'Contact for pricing';
  if (!maxNum || minNum === maxNum) return `$${Math.round(minNum).toLocaleString()}/mo`;
  return `$${Math.round(minNum).toLocaleString()} – $${Math.round(maxNum).toLocaleString()}/mo`;
}

// ── Forward lead to CRM via tunnel ───────────────────────────────────────
async function forwardLeadToCrm(data: {
  name: string;
  email: string;
  phone: string;
  source?: string;
  bedrooms?: string;
  budget?: string;
  moveInTimeline?: string;
  preferredArea?: string;
  notes?: string;
  apartmentName?: string;
  apartmentId?: number;
  interactionType?: string;
}) {
  const crmUrl = ENV.crmApiUrl || process.env.CRM_API_URL;
  if (!crmUrl) {
    console.log("[CRM Forward] No CRM_API_URL configured, skipping forward");
    return null;
  }

  const nameParts = data.name.trim().split(/\s+/);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  const payload: any = {
    firstName,
    lastName,
    email: data.email,
    phone: data.phone,
    source: data.source || "txaptfinder",
    smsConsent: true,
  };

  if (data.bedrooms) payload.bedrooms = data.bedrooms;
  if (data.budget) payload.budget = data.budget;
  if (data.moveInTimeline) payload.moveInTimeline = data.moveInTimeline;
  if (data.preferredArea) payload.preferredArea = data.preferredArea;
  if (data.notes) payload.notes = data.notes;

  try {
    const response = await fetch(`${crmUrl.replace(/\/$/, "")}/api/leads`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      console.warn(`[CRM Forward] Failed (${response.status}): ${text}`);
      return null;
    }

    const result = await response.json();
    console.log(`[CRM Forward] Lead forwarded to CRM:`, result);
    return result;
  } catch (err) {
    console.warn("[CRM Forward] Error:", err);
    return null;
  }
}

const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new Error('Unauthorized: Admin access required');
  }
  return next({ ctx });
});

export const appRouter = router({
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
          amenityIds: z.array(z.number()).optional(),
        }).optional()
      )
      .query(async ({ input }) => {
        if (process.env.RENTCAST_API_KEY) {
          return await getRentCastDatabaseApartments(input);
        }

        if (await hasPropertyDatabase()) {
          return await getPropertyDatabaseApartments(input);
        }

        return await getApartmentsForLead(input);
      }),

    databaseStats: publicProcedure.query(async () => {
      if (process.env.RENTCAST_API_KEY) {
        return await getRentCastDatabaseStats();
      }

      return await getPropertyDatabaseStats();
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

    /**
     * Seed sample apartment data (owner only, idempotent)
     */
    seedSample: adminProcedure.mutation(async () => {
      const result = await seedSampleData();
      return result;
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
          source: z.string().optional(),
          bedrooms: z.string().optional(),
          budget: z.string().optional(),
          moveInTimeline: z.string().optional(),
          preferredArea: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const result = await createLead({
          name: input.name,
          email: input.email,
          phone: input.phone,
        });

        // Forward to CRM
        await forwardLeadToCrm({
          name: input.name,
          email: input.email,
          phone: input.phone,
          source: input.source || "txaptfinder",
          bedrooms: input.bedrooms,
          budget: input.budget,
          moveInTimeline: input.moveInTimeline,
          preferredArea: input.preferredArea,
          notes: input.notes,
        });

        // Notify owner of new lead
        try {
          await notifyOwner({
            title: "New Lead Submitted",
            content: `${input.name} (${input.email}, ${input.phone}) has submitted their information and is interested in apartment listings.`,
          });
        } catch (error) {
          console.error("Failed to notify owner:", error);
        }

        return { success: true, leadId: (result as any).insertId || 0 };
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

        // Forward inquiry to CRM
        if (input.interactionType === 'inquiry') {
          const lead = await getLeadById(input.leadId);
          const apt = await getApartmentFull(input.apartmentId);
          if (lead && apt) {
            await forwardLeadToCrm({
              name: lead.name,
              email: lead.email,
              phone: lead.phone,
              source: "txaptfinder-inquiry",
              notes: `Inquiry about ${apt.name} in ${apt.neighborhood} — ${formatRent(apt.rentMin, apt.rentMax)}`,
              apartmentName: apt.name,
              apartmentId: apt.id,
              interactionType: 'inquiry',
            });
          }
        }

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
});

export type AppRouter = typeof appRouter;
