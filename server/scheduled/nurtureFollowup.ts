/**
 * Scheduled handler: 24-hour lead nurture follow-up
 *
 * Triggered by: Heartbeat cron (every hour)
 * Path: /api/scheduled/nurture-followup
 *
 * This handler:
 * 1. Authenticates the request as a cron job
 * 2. Queries all inquiries where nurtureStage = 'pending' AND nurtureScheduledFor <= now
 * 3. For each due inquiry, calls HubSpot to update the contact with follow-up properties
 * 4. Marks each inquiry as 'sent', 'failed', or 'skipped'
 *
 * Idempotent: Safe to retry — already-sent inquiries are filtered by nurtureStage.
 * Batch size: 50 per run to stay within the 2-minute handler timeout.
 *
 * HubSpot follow-up strategy:
 * Updates the contact with followup_sent=true and advances lifecycle stage.
 * Configure a HubSpot Workflow to trigger on "followup_sent is known" to send
 * your follow-up email template automatically.
 */

import { Request, Response } from "express";
import { sdk } from "../_core/sdk";
import {
  getInquiriesDueForNurture,
  markNurtureSent,
  markNurtureFailed,
  markNurtureSkipped,
} from "../db";
import { sendNurtureFollowup } from "../hubspot";

export async function nurtureFollowupHandler(req: Request, res: Response) {
  const startTime = Date.now();

  try {
    // Authenticate as cron request
    const user = await sdk.authenticateRequest(req);

    if (!user.isCron || !user.taskUid) {
      console.warn("[Nurture] Unauthorized access to nurture-followup endpoint");
      return res.status(403).json({ error: "cron-only" });
    }

    console.log("[Nurture] Starting 24-hour follow-up processing", { taskUid: user.taskUid });

    const hubspotToken = process.env.HUBSPOT_PRIVATE_APP_TOKEN;

    if (!hubspotToken) {
      console.warn("[Nurture] HUBSPOT_PRIVATE_APP_TOKEN not configured — skipping all leads");
      // Return 200 so the platform doesn't retry (this is a config issue, not a transient error)
      return res.json({
        ok: true,
        message: "Nurture skipped: HubSpot not configured",
        processed: 0,
        sent: 0,
        skipped: 0,
        failed: 0,
        duration: `${Date.now() - startTime}ms`,
      });
    }

    // Fetch all leads due for follow-up
    const dueleads = await getInquiriesDueForNurture();

    console.log("[Nurture] Found leads due for follow-up", {
      count: dueleads.length,
      taskUid: user.taskUid,
    });

    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const inquiry of dueleads) {
      if (!inquiry.id) continue;

      try {
        const result = await sendNurtureFollowup(
          {
            email: inquiry.email,
            name: inquiry.name,
            apartmentName: inquiry.apartmentName,
            phone: inquiry.phone || undefined,
          },
          hubspotToken
        );

        if (result.success) {
          await markNurtureSent(inquiry.id);
          sent++;
          console.log("[Nurture] Follow-up sent", {
            inquiryId: inquiry.id,
            email: inquiry.email.replace(/(.{2}).*(@.*)/, "$1***$2"), // partial mask for logs
            apartmentName: inquiry.apartmentName,
          });
        } else {
          // HubSpot returned an error — mark as failed but continue processing others
          await markNurtureFailed(inquiry.id, result.error || "HubSpot error");
          failed++;
          console.error("[Nurture] Follow-up failed", {
            inquiryId: inquiry.id,
            error: result.error,
            status: result.status,
          });
        }
      } catch (err) {
        // Unexpected error for this lead — mark as failed and continue
        const errorMsg = err instanceof Error ? err.message : String(err);
        await markNurtureFailed(inquiry.id, errorMsg);
        failed++;
        console.error("[Nurture] Unexpected error for lead", {
          inquiryId: inquiry.id,
          error: errorMsg,
        });
      }
    }

    const duration = Date.now() - startTime;
    const summary = {
      ok: true,
      message: "Nurture follow-up processing complete",
      processed: dueleads.length,
      sent,
      skipped,
      failed,
      duration: `${duration}ms`,
    };

    console.log("[Nurture] Processing complete", { ...summary, taskUid: user.taskUid });

    return res.json(summary);
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error("[Nurture] Handler failed", {
      error: errorMessage,
      duration: `${duration}ms`,
    });

    // Return 500 with structured error for platform Investigate flow
    return res.status(500).json({
      error: errorMessage,
      stack: errorStack,
      context: {
        url: req.url,
        taskUid: (
          await sdk.authenticateRequest(req).catch(() => ({ taskUid: "unknown" }))
        ).taskUid,
      },
      timestamp: new Date().toISOString(),
    });
  }
}
