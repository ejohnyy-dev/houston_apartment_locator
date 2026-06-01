/**
 * Nurture Admin Router
 *
 * Provides admin-only endpoints for managing the 24-hour lead nurture automation:
 * - View nurture status for all leads
 * - Manually trigger follow-up for a specific lead
 * - Get nurture statistics
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  getInquiriesWithNurtureStatus,
  markNurtureSent,
  markNurtureFailed,
  markNurtureSkipped,
  getInquiriesDueForNurture,
} from "../db";
import { sendNurtureFollowup } from "../hubspot";
import { createHeartbeatJob, listHeartbeatJobs, deleteHeartbeatJob } from "../_core/heartbeat";
import { parse as parseCookie } from "cookie";
import { COOKIE_NAME } from "@shared/const";

// Admin-only guard
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user?.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

export const nurtureRouter = router({
  /**
   * Get nurture status for all leads (admin only)
   */
  status: adminProcedure.query(async () => {
    const leads = await getInquiriesWithNurtureStatus(100);

    const stats = {
      total: leads.length,
      pending: leads.filter((l) => l.nurtureStage === "pending").length,
      sent: leads.filter((l) => l.nurtureStage === "sent").length,
      failed: leads.filter((l) => l.nurtureStage === "failed").length,
      skipped: leads.filter((l) => l.nurtureStage === "skipped").length,
    };

    return {
      stats,
      leads: leads.map((l) => ({
        id: l.id,
        name: l.name,
        email: l.email,
        apartmentName: l.apartmentName,
        nurtureStage: l.nurtureStage,
        nurtureSentAt: l.nurtureSentAt,
        nurtureScheduledFor: l.nurtureScheduledFor,
        nurtureError: l.nurtureError,
        createdAt: l.createdAt,
      })),
    };
  }),

  /**
   * Manually trigger nurture follow-up for a specific lead (admin only)
   */
  triggerForLead: adminProcedure
    .input(z.object({ inquiryId: z.number() }))
    .mutation(async ({ input }) => {
      const hubspotToken = process.env.HUBSPOT_PRIVATE_APP_TOKEN;

      if (!hubspotToken) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "HubSpot is not configured",
        });
      }

      // Get the specific lead
      const leads = await getInquiriesWithNurtureStatus(100);
      const lead = leads.find((l) => l.id === input.inquiryId);

      if (!lead) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Lead not found" });
      }

      const result = await sendNurtureFollowup(
        {
          email: lead.email,
          name: lead.name,
          apartmentName: lead.apartmentName,
          phone: lead.phone || undefined,
        },
        hubspotToken
      );

      if (result.success) {
        await markNurtureSent(lead.id!);
        return { success: true, message: "Follow-up sent successfully" };
      } else {
        await markNurtureFailed(lead.id!, result.error || "HubSpot error");
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: result.error || "Failed to send follow-up",
        });
      }
    }),

  /**
   * Get the current Heartbeat cron job status (admin only)
   */
  cronStatus: adminProcedure.query(async ({ ctx }) => {
    try {
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      const jobs = await listHeartbeatJobs(sessionToken);
      const nurtureJob = jobs.jobs.find((j) => j.name === "nurture-followup-hourly");

      return {
        configured: !!nurtureJob,
        job: nurtureJob
          ? {
              taskUid: nurtureJob.taskUid,
              name: nurtureJob.name,
              cronExpression: nurtureJob.cronExpression,
              isEnabled: nurtureJob.isEnable,
              lastExecutedAt: nurtureJob.lastExecutedAt,
              nextExecutionAt: nurtureJob.nextExecutionAt,
            }
          : null,
      };
    } catch {
      return { configured: false, job: null };
    }
  }),

  /**
   * Create the Heartbeat cron job for nurture follow-ups (admin only)
   * Runs every hour to process leads due for follow-up.
   * NOTE: The site must be deployed before this will work.
   */
  setupCron: adminProcedure.mutation(async ({ ctx }) => {
    const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";

    try {
      const job = await createHeartbeatJob(
        {
          name: "nurture-followup-hourly",
          cron: "0 0 * * * *", // every hour at :00
          path: "/api/scheduled/nurture-followup",
          description: "24-hour lead nurture follow-up: processes pending leads due for HubSpot follow-up",
        },
        sessionToken
      );

      return {
        success: true,
        taskUid: job.taskUid,
        nextExecutionAt: job.nextExecutionAt,
        message: "Nurture cron job created successfully. It will run every hour.",
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to create cron job: ${msg}`,
      });
    }
  }),

  /**
   * Delete the Heartbeat cron job (admin only)
   */
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

  /**
   * Get count of leads currently due for nurture (admin only)
   */
  dueCount: adminProcedure.query(async () => {
    const due = await getInquiriesDueForNurture();
    return { count: due.length };
  }),
});
