import { Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { getRentCastDatabaseStats } from "../rentcastDatabase";
import { getDb } from "../db";
import { rentcastCronConfig } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

/**
 * Scheduled handler: Refresh RentCast apartment cache
 *
 * Triggered by: manus-heartbeat (HTTP cron)
 * Path: /api/scheduled/refresh-rentcast
 *
 * This handler:
 * 1. Authenticates the request as a cron job
 * 2. Triggers the RentCast cache refresh
 * 3. Persists refresh stats to the rentcast_cron_config DB row
 * 4. Returns stats on the refresh result
 *
 * Idempotent: Safe to retry on failure
 */
export async function refreshRentCastHandler(req: Request, res: Response) {
  const startTime = Date.now();

  try {
    // Authenticate as cron request
    const user = await sdk.authenticateRequest(req);

    if (!user.isCron || !user.taskUid) {
      console.warn("[Scheduled] Unauthorized access to refresh-rentcast endpoint");
      return res.status(403).json({ error: "cron-only" });
    }

    console.log("[Scheduled] Starting RentCast cache refresh", { taskUid: user.taskUid });

    // Trigger the RentCast cache refresh by loading the data
    // This will automatically refresh stale entries up to the monthly limit
    const stats = await getRentCastDatabaseStats();

    const duration = Date.now() - startTime;
    console.log("[Scheduled] RentCast cache refresh completed", {
      taskUid: user.taskUid,
      duration: `${duration}ms`,
      status: stats.status,
      totalProperties: stats.totalProperties,
      rentcastMatches: stats.rentcastMatches,
      monthlyRequestsUsed: stats.monthlyRequestsUsed,
      monthlyRequestsRemaining: stats.monthlyRequestsRemaining,
    });

    // Persist refresh stats to DB so the admin UI can display them
    try {
      const db = await getDb();
      if (db) {
        const statsJson = JSON.stringify({
          totalProperties: stats.totalProperties,
          rentcastMatches: stats.rentcastMatches,
          requestsUsed: stats.monthlyRequestsUsed,
          requestsRemaining: stats.monthlyRequestsRemaining,
          duration: `${duration}ms`,
        });

        // Look up the config row by taskUid
        const existing = await db
          .select()
          .from(rentcastCronConfig)
          .where(eq(rentcastCronConfig.scheduleCronTaskUid, user.taskUid))
          .limit(1);

        if (existing.length > 0) {
          await db
            .update(rentcastCronConfig)
            .set({
              lastRefreshAt: new Date(),
              lastRefreshStatus: stats.status,
              lastRefreshStats: statsJson,
            })
            .where(eq(rentcastCronConfig.id, existing[0].id));
        } else {
          // Fallback: upsert the first config row if task_uid doesn't match
          // (can happen if the cron was set up via CLI rather than the admin UI)
          const rows = await db.select().from(rentcastCronConfig).limit(1);
          if (rows.length > 0) {
            await db
              .update(rentcastCronConfig)
              .set({
                scheduleCronTaskUid: user.taskUid,
                lastRefreshAt: new Date(),
                lastRefreshStatus: stats.status,
                lastRefreshStats: statsJson,
              })
              .where(eq(rentcastCronConfig.id, rows[0].id));
          } else {
            await db.insert(rentcastCronConfig).values({
              scheduleCronTaskUid: user.taskUid,
              lastRefreshAt: new Date(),
              lastRefreshStatus: stats.status,
              lastRefreshStats: statsJson,
            });
          }
        }

        console.log("[Scheduled] Persisted refresh stats to DB");
      }
    } catch (dbErr) {
      // Non-fatal: log but don't fail the cron response
      console.error("[Scheduled] Failed to persist refresh stats to DB", dbErr);
    }

    return res.json({
      ok: true,
      message: "RentCast cache refresh completed",
      stats: {
        status: stats.status,
        totalProperties: stats.totalProperties,
        rentcastMatches: stats.rentcastMatches,
        monthlyRequestsUsed: stats.monthlyRequestsUsed,
        monthlyRequestsRemaining: stats.monthlyRequestsRemaining,
        lastUpdated: stats.lastUpdated,
      },
      duration: `${duration}ms`,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error("[Scheduled] RentCast cache refresh failed", {
      error: errorMessage,
      duration: `${duration}ms`,
    });

    // Return 500 with error details for platform Investigate flow
    return res.status(500).json({
      error: errorMessage,
      stack: errorStack,
      context: {
        url: req.url,
        taskUid: (await sdk.authenticateRequest(req).catch(() => ({ taskUid: "unknown" }))).taskUid,
      },
      timestamp: new Date().toISOString(),
    });
  }
}
