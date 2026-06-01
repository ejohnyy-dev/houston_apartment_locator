/**
 * RentCast Admin Router
 *
 * Admin-only endpoints for managing the nightly RentCast cache refresh cron:
 * - View current cron status and last refresh stats
 * - Create / delete the Heartbeat cron job
 * - Trigger a manual refresh
 */

import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  createHeartbeatJob,
  listHeartbeatJobs,
  deleteHeartbeatJob,
} from "../_core/heartbeat";
import { parse as parseCookie } from "cookie";
import { COOKIE_NAME } from "@shared/const";
import { getDb } from "../db";
import { rentcastCronConfig } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { getRentCastDatabaseStats } from "../rentcastDatabase";

// Admin-only guard (mirrors nurture router pattern)
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user?.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

/** Job name used to look up the cron in Heartbeat */
const CRON_JOB_NAME = "rentcast-nightly-refresh";
/** Default cron: every day at 03:00 UTC (10pm CT) */
const DEFAULT_CRON = "0 0 3 * * *";

export const rentcastRouter = router({
  /**
   * Get the current Heartbeat cron status + last refresh stats from DB
   */
  cronStatus: adminProcedure.query(async ({ ctx }) => {
    const db = await getDb();

    // Load persisted config row
    let config = null;
    if (db) {
      const rows = await db.select().from(rentcastCronConfig).limit(1);
      config = rows[0] ?? null;
    }

    // Check live Heartbeat status
    let heartbeatJob = null;
    try {
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      const jobs = await listHeartbeatJobs(sessionToken);
      heartbeatJob = jobs.jobs.find((j) => j.name === CRON_JOB_NAME) ?? null;
    } catch {
      // Heartbeat unavailable — not fatal
    }

    return {
      configured: !!heartbeatJob,
      job: heartbeatJob
        ? {
            taskUid: heartbeatJob.taskUid,
            name: heartbeatJob.name,
            cronExpression: heartbeatJob.cronExpression,
            isEnabled: heartbeatJob.isEnable,
            lastExecutedAt: heartbeatJob.lastExecutedAt,
            nextExecutionAt: heartbeatJob.nextExecutionAt,
          }
        : null,
      lastRefresh: config
        ? {
            at: config.lastRefreshAt,
            status: config.lastRefreshStatus,
            stats: config.lastRefreshStats
              ? (JSON.parse(config.lastRefreshStats) as Record<string, unknown>)
              : null,
          }
        : null,
    };
  }),

  /**
   * Create the nightly Heartbeat cron job
   */
  setupCron: adminProcedure
    .input(
      z.object({
        cron: z.string().optional(), // defaults to daily 03:00 UTC
      })
    )
    .mutation(async ({ ctx, input }) => {
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      const cronExpr = input.cron ?? DEFAULT_CRON;

      try {
        const job = await createHeartbeatJob(
          {
            name: CRON_JOB_NAME,
            cron: cronExpr,
            path: "/api/scheduled/refresh-rentcast",
            description:
              "Nightly RentCast cache refresh: fetches fresh rental listings and persists them to the database",
          },
          sessionToken
        );

        // Persist task_uid to DB so the handler can look it up
        const db = await getDb();
        if (db) {
          const existing = await db.select().from(rentcastCronConfig).limit(1);
          if (existing.length > 0) {
            await db
              .update(rentcastCronConfig)
              .set({
                scheduleCronTaskUid: job.taskUid,
                cronExpression: cronExpr,
                isEnabled: 1,
              })
              .where(eq(rentcastCronConfig.id, existing[0].id));
          } else {
            await db.insert(rentcastCronConfig).values({
              scheduleCronTaskUid: job.taskUid,
              cronExpression: cronExpr,
              isEnabled: 1,
            });
          }
        }

        return {
          success: true,
          taskUid: job.taskUid,
          nextExecutionAt: job.nextExecutionAt,
          message: `RentCast refresh cron created. Next run: ${job.nextExecutionAt ?? "soon"}.`,
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
   * Delete the nightly Heartbeat cron job
   */
  deleteCron: adminProcedure
    .input(z.object({ taskUid: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";

      try {
        await deleteHeartbeatJob(input.taskUid, sessionToken);

        // Clear task_uid from DB
        const db = await getDb();
        if (db) {
          await db
            .update(rentcastCronConfig)
            .set({ scheduleCronTaskUid: null, isEnabled: 0 })
            .where(eq(rentcastCronConfig.scheduleCronTaskUid, input.taskUid));
        }

        return { success: true, message: "RentCast refresh cron deleted." };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to delete cron job: ${msg}`,
        });
      }
    }),

  /**
   * Get current RentCast cache stats (without triggering a refresh)
   */
  cacheStats: adminProcedure.query(async () => {
    try {
      const stats = await getRentCastDatabaseStats();
      return { success: true, stats };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Failed to load RentCast stats: ${msg}`,
      });
    }
  }),
});
