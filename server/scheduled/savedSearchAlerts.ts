/**
 * Scheduled handler: daily saved-search alerts
 *
 * Triggered by: Heartbeat cron (daily, see savedSearches.setupCron)
 * Path: /api/scheduled/saved-search-alerts
 *
 * This handler:
 * 1. Authenticates the request as a cron job
 * 2. Loads the full apartment inventory once
 * 3. For each active saved search, diffs current matches against the ids
 *    already seen; on new matches it signals HubSpot (workflow sends the
 *    email) and notifies the owner, then records the new seen set
 *
 * Idempotent: seenListingIds advances only after a successful signal, so a
 * retried run re-attempts only the searches that didn't get their alert.
 *
 * Privacy: the lead-facing summary contains counts, neighborhoods, and
 * prices only — never a property name or address. The owner notification
 * includes real property names so the locator can follow up personally.
 */

import { Request, Response } from "express";
import { sdk } from "../_core/sdk";
import { getActiveSavedSearches, updateSavedSearchSeen } from "../db";
import { getMergedApartments } from "../apartmentInventory";
import { matchingListingIds, parseSavedFilters } from "../savedSearchMatcher";
import { sendSavedSearchAlert } from "../hubspot";
import { notifyOwner } from "../_core/notification";

function describeMatchesForLead(apartments: any[]): string {
  const areas = Array.from(new Set(apartments.map((a) => a.neighborhood || "Houston")));
  const areaText =
    areas.length <= 3 ? areas.join(", ") : `${areas.length} Houston areas`;
  const prices = apartments
    .map((a) => (typeof a.rentMin === "string" ? parseFloat(a.rentMin) : a.rentMin))
    .filter((p: number) => Number.isFinite(p) && p > 0);
  const fromPrice = prices.length > 0 ? Math.min(...prices) : null;
  const count = apartments.length;
  return (
    `${count} new listing${count === 1 ? "" : "s"} in ${areaText}` +
    (fromPrice ? ` from $${fromPrice.toLocaleString()}/mo` : "")
  );
}

export async function savedSearchAlertsHandler(req: Request, res: Response) {
  const startTime = Date.now();

  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      console.warn("[SavedSearch] Unauthorized access to saved-search-alerts endpoint");
      return res.status(403).json({ error: "cron-only" });
    }

    const searches = await getActiveSavedSearches();
    if (searches.length === 0) {
      return res.json({ ok: true, message: "No active saved searches", processed: 0 });
    }

    const hubspotToken = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
    if (!hubspotToken) {
      console.warn("[SavedSearch] HUBSPOT_PRIVATE_APP_TOKEN not configured — skipping");
      return res.json({ ok: true, message: "Skipped: HubSpot not configured", processed: 0 });
    }

    // Load inventory once for all searches
    const inventory = await getMergedApartments();
    const byId = new Map(inventory.map((a: any) => [String(a.id), a]));

    let alerted = 0;
    let unchanged = 0;
    let failed = 0;

    for (const search of searches) {
      try {
        const filters = parseSavedFilters(search.filters);
        const currentIds = matchingListingIds(inventory, filters);

        let seen: string[] = [];
        try {
          const parsed = JSON.parse(search.seenListingIds || "[]");
          if (Array.isArray(parsed)) seen = parsed.map(String);
        } catch { /* treat as never-checked */ }

        const seenSet = new Set(seen);
        const newIds = currentIds.filter((id) => !seenSet.has(id));

        if (newIds.length === 0) {
          await updateSavedSearchSeen(search.id, JSON.stringify(currentIds), false);
          unchanged++;
          continue;
        }

        const newApartments = newIds
          .map((id) => byId.get(id))
          .filter(Boolean) as any[];
        const summary = describeMatchesForLead(newApartments);

        const result = await sendSavedSearchAlert(
          { email: search.email, matchCount: newIds.length, summary },
          hubspotToken
        );

        if (!result.success) {
          // Leave seenListingIds untouched so the next run retries this alert
          failed++;
          console.error("[SavedSearch] HubSpot signal failed", {
            savedSearchId: search.id,
            error: result.error,
          });
          continue;
        }

        // Owner gets the real property names for personal follow-up
        await notifyOwner({
          title: `Saved-search alert: ${newIds.length} new match${newIds.length === 1 ? "" : "es"} for ${search.email}`,
          content: newApartments
            .slice(0, 10)
            .map((a) => `${a.name} (${a.neighborhood || "Houston"})`)
            .join("\n"),
        }).catch((e) => console.warn("[SavedSearch] notifyOwner failed:", e));

        await updateSavedSearchSeen(search.id, JSON.stringify(currentIds), true);
        alerted++;
        console.log("[SavedSearch] Alert signaled", {
          savedSearchId: search.id,
          email: search.email.replace(/(.{2}).*(@.*)/, "$1***$2"),
          newMatches: newIds.length,
        });
      } catch (err) {
        failed++;
        console.error("[SavedSearch] Error processing saved search", {
          savedSearchId: search.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const summary = {
      ok: true,
      message: "Saved-search alert processing complete",
      processed: searches.length,
      alerted,
      unchanged,
      failed,
      duration: `${Date.now() - startTime}ms`,
    };
    console.log("[SavedSearch] Processing complete", { ...summary, taskUid: user.taskUid });
    return res.json(summary);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[SavedSearch] Handler failed", {
      error: errorMessage,
      duration: `${Date.now() - startTime}ms`,
    });
    return res.status(500).json({
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });
  }
}
