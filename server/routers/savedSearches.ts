/**
 * Saved Searches Router
 *
 * Leads who completed the questionnaire can save their current /search
 * filters to get email alerts when NEW listings match. The actual email is
 * sent by a HubSpot workflow (same pattern as the nurture follow-up); the
 * daily cron at /api/scheduled/saved-search-alerts diffs the inventory and
 * updates the contact's new_matches_* properties to trigger it.
 *
 * The lead's identity comes from the qual_session cookie — no extra form.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, adminProcedure, router } from "../_core/trpc";
import {
  createSavedSearch,
  getActiveSavedSearches,
  getSavedSearchesByEmail,
  deactivateSavedSearch,
  getQualifiedSessionByToken,
} from "../db";
import { getMergedApartments } from "../apartmentInventory";
import { matchingListingIds, parseSavedFilters, type SavedSearchFilters } from "../savedSearchMatcher";
import { createHeartbeatJob, listHeartbeatJobs, deleteHeartbeatJob } from "../_core/heartbeat";
import { parse as parseCookie } from "cookie";
import { COOKIE_NAME } from "@shared/const";

const filtersSchema = z.object({
  neighborhood: z.string().max(100).optional(),
  bedrooms: z.enum(["0", "1", "2", "3", "4"]).optional(),
  minRent: z.number().int().min(0).max(50000).optional(),
  maxRent: z.number().int().min(0).max(50000).optional(),
  searchText: z.string().max(200).optional(),
});

const MAX_ACTIVE_PER_EMAIL = 5;

/** Resolve the lead's email from their qual_session cookie. */
async function resolveLeadEmail(req: { headers: { cookie?: string } }): Promise<string | null> {
  const cookieHeader = req.headers.cookie || "";
  const match = cookieHeader.match(/(?:^|;\s*)qual_session=([^;]+)/);
  const token = match ? decodeURIComponent(match[1]) : null;
  if (!token) return null;
  try {
    const session = await getQualifiedSessionByToken(token);
    return session?.email ?? null;
  } catch {
    return null;
  }
}

export const savedSearchesRouter = router({
  /**
   * Save the current filters for alerts. Seeds seenListingIds with the
   * listings matching right now, so only listings added later notify.
   */
  create: publicProcedure
    .input(z.object({ filters: filtersSchema }))
    .mutation(async ({ ctx, input }) => {
      const email = await resolveLeadEmail(ctx.req);
      if (!email) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Complete the questionnaire first to turn on alerts.",
        });
      }

      const existing = await getSavedSearchesByEmail(email);
      if (existing.length >= MAX_ACTIVE_PER_EMAIL) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
          message: "You already have the maximum number of saved searches.",
        });
      }

      const inventory = await getMergedApartments();
      const seen = matchingListingIds(inventory, input.filters as SavedSearchFilters);

      const id = await createSavedSearch({
        email,
        filters: JSON.stringify(input.filters),
        seenListingIds: JSON.stringify(seen),
      });

      return { id, matchingNow: seen.length };
    }),

  /** The current lead's active saved searches. */
  mine: publicProcedure.query(async ({ ctx }) => {
    const email = await resolveLeadEmail(ctx.req);
    if (!email) return [];
    const rows = await getSavedSearchesByEmail(email);
    return rows.map((r) => ({
      id: r.id,
      filters: parseSavedFilters(r.filters),
      createdAt: r.createdAt,
      lastAlertAt: r.lastAlertAt,
    }));
  }),

  /** Turn off alerts for one of the current lead's saved searches. */
  remove: publicProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const email = await resolveLeadEmail(ctx.req);
      if (!email) throw new TRPCError({ code: "UNAUTHORIZED" });
      const ok = await deactivateSavedSearch(input.id, email);
      if (!ok) throw new TRPCError({ code: "NOT_FOUND", message: "Saved search not found" });
      return { success: true };
    }),

  /** All active saved searches (admin only). */
  status: adminProcedure.query(async () => {
    const rows = await getActiveSavedSearches();
    return {
      total: rows.length,
      searches: rows.map((r) => ({
        id: r.id,
        email: r.email,
        filters: parseSavedFilters(r.filters),
        lastCheckedAt: r.lastCheckedAt,
        lastAlertAt: r.lastAlertAt,
        createdAt: r.createdAt,
      })),
    };
  }),

  /** Heartbeat cron status for the daily alert job (admin only). */
  cronStatus: adminProcedure.query(async ({ ctx }) => {
    try {
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      const jobs = await listHeartbeatJobs(sessionToken);
      const job = jobs.jobs.find((j) => j.name === "saved-search-alerts-daily");
      return {
        configured: !!job,
        job: job
          ? {
              taskUid: job.taskUid,
              name: job.name,
              cronExpression: job.cronExpression,
              isEnabled: job.isEnable,
              lastExecutedAt: job.lastExecutedAt,
              nextExecutionAt: job.nextExecutionAt,
            }
          : null,
      };
    } catch {
      return { configured: false, job: null };
    }
  }),

  /**
   * Create the daily Heartbeat cron job (admin only).
   * Runs at 14:00 UTC ≈ 8–9am Houston so alerts land as a morning digest.
   * NOTE: The site must be deployed before this will work.
   */
  setupCron: adminProcedure.mutation(async ({ ctx }) => {
    const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
    try {
      const job = await createHeartbeatJob(
        {
          name: "saved-search-alerts-daily",
          cron: "0 0 14 * * *",
          path: "/api/scheduled/saved-search-alerts",
          description: "Daily saved-search alerts: signals HubSpot when new listings match a lead's saved filters",
        },
        sessionToken
      );
      return {
        success: true,
        taskUid: job.taskUid,
        nextExecutionAt: job.nextExecutionAt,
        message: "Saved-search alert cron created. It will run daily.",
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to create cron job: ${msg}`,
      });
    }
  }),

  /** Delete the Heartbeat cron job (admin only). */
  deleteCron: adminProcedure
    .input(z.object({ taskUid: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      try {
        await deleteHeartbeatJob(input.taskUid, sessionToken);
        return { success: true, message: "Cron job deleted" };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to delete cron job: ${msg}`,
        });
      }
    }),
});
