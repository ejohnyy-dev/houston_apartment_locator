/**
 * HubSpot Integration Module
 *
 * Centralizes all HubSpot API calls:
 * - Contact create/update (used at lead intake)
 * - Nurture follow-up: update contact properties to signal 24-hour follow-up
 *
 * HubSpot follow-up strategy:
 * We update the contact with a `followup_sent` property and set the lifecycle
 * stage to `marketingqualifiedlead`. HubSpot workflows can then trigger
 * automated emails based on these property changes.
 *
 * If you prefer to send emails directly (without HubSpot workflows), you can
 * use the HubSpot Transactional Email API instead — swap `sendNurtureFollowup`
 * to call POST /marketing/v3/transactional/single-email/send with a template ID.
 */

const HUBSPOT_API_BASE = "https://api.hubapi.com";

export type HubSpotContactProperties = {
  firstname?: string;
  lastname?: string;
  email: string;
  phone?: string;
  apartment_name?: string;
  apartment_id?: string;
  move_in_date?: string;
  message?: string;
  favorite_apartments?: string;
  lifecyclestage?: string;
  hs_lead_status?: string;
  followup_sent?: string;
  followup_sent_at?: string;
  notes_last_contacted?: string;
  // Saved-search alert properties (create these as custom contact
  // properties in HubSpot; a workflow on new_matches_found_at sends the email)
  new_matches_count?: string;
  new_matches_summary?: string;
  new_matches_found_at?: string;
};

export type HubSpotResult = {
  success: boolean;
  contactId?: string;
  error?: string;
  status?: number;
};

/**
 * Create or update a HubSpot contact.
 * Uses PATCH-then-POST (upsert) pattern.
 */
export async function upsertHubSpotContact(
  properties: HubSpotContactProperties,
  token: string
): Promise<HubSpotResult> {
  const email = properties.email;

  // Filter out empty string values to avoid overwriting existing data
  const cleanProps = Object.fromEntries(
    Object.entries(properties).filter(([, v]) => v !== "" && v !== undefined)
  );

  // Try PATCH first (update existing contact)
  const patchUrl = `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/${encodeURIComponent(email)}?idProperty=email`;
  const patchRes = await fetch(patchUrl, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ properties: cleanProps }),
  });

  if (patchRes.ok) {
    const data = (await patchRes.json()) as { id?: string };
    return { success: true, contactId: data.id };
  }

  if (patchRes.status === 404) {
    // Contact doesn't exist — create it
    const createRes = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ properties: cleanProps }),
    });

    if (createRes.ok) {
      const data = (await createRes.json()) as { id?: string };
      return { success: true, contactId: data.id };
    }

    const errorText = await createRes.text();
    return {
      success: false,
      error: `HubSpot create failed: ${createRes.status} ${errorText}`,
      status: createRes.status,
    };
  }

  const errorText = await patchRes.text();
  return {
    success: false,
    error: `HubSpot patch failed: ${patchRes.status} ${errorText}`,
    status: patchRes.status,
  };
}

/**
 * Send a 24-hour nurture follow-up for a lead.
 *
 * Strategy: Update the HubSpot contact with follow-up properties.
 * HubSpot workflows configured to watch `followup_sent = true` will
 * automatically trigger the follow-up email sequence.
 *
 * To use this:
 * 1. In HubSpot → Workflows → Create a contact-based workflow
 * 2. Trigger: "Contact property — followup_sent is known"
 * 3. Action: Send email (use your follow-up email template)
 *
 * Returns success/failure with details for logging.
 */
export async function sendNurtureFollowup(
  lead: {
    email: string;
    name: string;
    apartmentName: string;
    phone?: string;
  },
  token: string
): Promise<HubSpotResult> {
  const now = new Date().toISOString();

  const properties: HubSpotContactProperties = {
    email: lead.email,
    // Signal to HubSpot workflows that follow-up is due
    followup_sent: "true",
    followup_sent_at: now,
    // Advance lifecycle stage to trigger workflow
    lifecyclestage: "marketingqualifiedlead",
    hs_lead_status: "IN_PROGRESS",
    // Add a note for the contact timeline
    notes_last_contacted: now,
  };

  return upsertHubSpotContact(properties, token);
}

/**
 * Signal a saved-search alert for a lead.
 *
 * Strategy mirrors the nurture follow-up: update the contact's
 * new_matches_* properties; a HubSpot workflow triggered on
 * "new_matches_found_at is known / property changed" sends the alert email.
 *
 * To use this:
 * 1. In HubSpot → Settings → Properties: create contact properties
 *    new_matches_count (single-line text), new_matches_summary
 *    (single-line text), new_matches_found_at (single-line text)
 * 2. Workflows → contact-based workflow, trigger on new_matches_found_at,
 *    with re-enrollment on property change; action: send your alert email
 *    template (it can reference the summary/count properties).
 *
 * The summary must never identify a property (TREC/privacy rule) — counts,
 * neighborhoods, and prices only.
 */
export async function sendSavedSearchAlert(
  lead: { email: string; matchCount: number; summary: string },
  token: string
): Promise<HubSpotResult> {
  return upsertHubSpotContact(
    {
      email: lead.email,
      new_matches_count: String(lead.matchCount),
      new_matches_summary: lead.summary,
      new_matches_found_at: new Date().toISOString(),
    },
    token
  );
}

/**
 * Look up a HubSpot contact by email.
 * Returns the contact ID and current properties if found.
 */
export async function getHubSpotContact(
  email: string,
  token: string
): Promise<{ found: boolean; contactId?: string; properties?: Record<string, string> }> {
  const url = `${HUBSPOT_API_BASE}/crm/v3/objects/contacts/${encodeURIComponent(email)}?idProperty=email&properties=email,firstname,lastname,lifecyclestage,followup_sent`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 404) return { found: false };

  if (!res.ok) {
    throw new Error(`HubSpot lookup failed: ${res.status}`);
  }

  const data = (await res.json()) as { id?: string; properties?: Record<string, string> };
  return { found: true, contactId: data.id, properties: data.properties };
}
