import { Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { getRentCastDatabaseStats } from "../rentcastDatabase";

/**
 * Scheduled handler: Refresh RentCast apartment cache
 * 
 * Triggered by: manus-heartbeat (HTTP cron)
 * Path: /api/scheduled/refresh-rentcast
 * 
 * This handler:
 * 1. Authenticates the request as a cron job
 * 2. Triggers the RentCast cache refresh
 * 3. Returns stats on the refresh result
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
