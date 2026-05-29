export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

const log = {
  info: (msg: string, data?: any) =>
    console.log(`[Email] ${msg}`, data ? JSON.stringify(data) : ""),
  error: (msg: string, err?: any) =>
    console.error(
      `[Email] ${msg}`,
      err instanceof Error ? err.message : err
    ),
};

/**
 * Send email via configured provider (Resend, SendGrid, Mailgun, etc.)
 * Currently logs to console. Replace with actual email service.
 */
export async function sendEmail(options: EmailOptions): Promise<void> {
  const { to, subject, html } = options;

  // ========== OPTION 1: Using Resend (recommended) ==========
  if (process.env.RESEND_API_KEY) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "noreply@apartmentfinder.local",
          to,
          subject,
          html,
        }),
      });

      if (!response.ok) {
        throw new Error(`Resend API error: ${response.statusText}`);
      }

      log.info("Email sent via Resend", { to, subject });
      return;
    } catch (error) {
      log.error("Resend email failed", error);
    }
  }

  // ========== OPTION 2: Using SendGrid ==========
  if (process.env.SENDGRID_API_KEY) {
    try {
      const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.SENDGRID_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: {
            email: process.env.EMAIL_FROM || "noreply@apartmentfinder.local",
          },
          subject,
          content: [{ type: "text/html", value: html }],
        }),
      });

      if (!response.ok) {
        throw new Error(`SendGrid API error: ${response.statusText}`);
      }

      log.info("Email sent via SendGrid", { to, subject });
      return;
    } catch (error) {
      log.error("SendGrid email failed", error);
    }
  }

  // ========== FALLBACK: Console logging ==========
  log.info("Email (console mode)", {
    to,
    subject,
    preview: html.substring(0, 100),
  });
}

/**
 * Template: New lead notification
 */
export function renderNewLeadEmail(
  leadName: string,
  leadEmail: string,
  leadPhone: string,
  dashboardUrl: string
): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
      <h2>🎯 New Lead Submitted</h2>
      <p>Someone is interested in apartments!</p>

      <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Name:</strong> ${escapeHtml(leadName)}</p>
        <p><strong>Email:</strong> ${escapeHtml(leadEmail)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(leadPhone)}</p>
        <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
      </div>

      <p>
        <a href="${dashboardUrl}" style="background: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
          View Lead in Dashboard
        </a>
      </p>
    </div>
  `;
}

/**
 * Template: Saved search alert
 */
export function renderSearchAlertEmail(
  listings: any[],
  unsubscribeUrl: string
): string {
  const listingHtml = listings
    .map(
      (apt) => `
    <div style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 5px;">
      <h3>${escapeHtml(apt.name)}</h3>
      <p><strong>${apt.bedrooms}bd / ${apt.bathrooms}ba</strong> • <strong>$${apt.rentMin.toLocaleString()}/mo</strong></p>
      <p>${escapeHtml(apt.neighborhood)}</p>
      ${apt.description ? `<p style="color: #666; font-size: 14px;">${escapeHtml(apt.description.substring(0, 150))}...</p>` : ""}
      <a href="https://apartmentfinder.local/apartment/${apt.id}" style="color: #0066cc;">View Details →</a>
    </div>
  `
    )
    .join("");

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
      <h2>✨ ${listings.length} New Apartments Match Your Search</h2>
      ${listingHtml}
      <p style="text-align: center; margin-top: 30px; color: #999; font-size: 12px;">
        <a href="${unsubscribeUrl}" style="color: #0066cc;">Manage alerts</a>
      </p>
    </div>
  `;
}

/**
 * Template: Monthly report
 */
export function renderMonthlyReportEmail(stats: {
  newLeads: number;
  convertedLeads: number;
  topCity: string;
  rentcastMatches: number;
  apiUsage: string;
}): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px;">
      <h2>📊 Monthly Report</h2>

      <div style="background: #f5f5f5; padding: 20px; border-radius: 5px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <div>
            <h3 style="margin: 0; color: #666;">New Leads</h3>
            <p style="font-size: 28px; margin: 10px 0 0 0; color: #0066cc;">${stats.newLeads}</p>
          </div>
          <div>
            <h3 style="margin: 0; color: #666;">Conversions</h3>
            <p style="font-size: 28px; margin: 10px 0 0 0; color: #0066cc;">${stats.convertedLeads}</p>
          </div>
          <div>
            <h3 style="margin: 0; color: #666;">Top City</h3>
            <p style="font-size: 18px; margin: 10px 0 0 0;">${escapeHtml(stats.topCity)}</p>
          </div>
          <div>
            <h3 style="margin: 0; color: #666;">API Usage</h3>
            <p style="font-size: 18px; margin: 10px 0 0 0;">${escapeHtml(stats.apiUsage)}</p>
          </div>
        </div>
      </div>

      <p style="margin-top: 20px; color: #666; font-size: 14px;">
        RentCast matches: <strong>${stats.rentcastMatches}</strong>
      </p>
    </div>
  `;
}

/**
 * Utility: Escape HTML to prevent injection
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

// ============================================
// TX APT FINDER — NURTURE SEQUENCE TEMPLATES
// Exact copy from Obsidian vault (txaptfinder_nurture_sequence.md)
// For leads submitting the form on txaptfinder.com
// ============================================

/**
 * Email 1 — Immediate (Send on form submit)
 */
export function renderNurtureEmail1(
  firstName: string,
  moveDate?: string,
  budget?: string,
  neighborhoods?: string
): string {
  const details = [];
  if (moveDate) details.push(`move around ${moveDate}`);
  if (budget) details.push(`budget in the ${budget} range`);
  if (neighborhoods) details.push(`interest in ${neighborhoods}`);

  const detailsLine = details.length > 0 
    ? `I just received your details — ${details.join(', ')}.` 
    : `I just received your details.`;

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; line-height: 1.6;">
      <p>Hi ${escapeHtml(firstName)},</p>
      
      <p>Thanks for submitting your info. ${detailsLine}</p>
      
      <p>I'm Eric Johnson, the licensed agent who personally handles searches for TX Apt Finder here in Houston. I review every lead myself and start matching properties right away.</p>
      
      <p>You can expect a first set of options from me within the next 24–48 hours. If anything changes on your end (pets, must-haves, new neighborhoods, etc.), just reply and I'll adjust immediately.</p>
      
      <p>Talk soon,</p>
      
      <p>
        <strong>Eric Johnson</strong><br>
        TX Apt Finder | Habitat Apartment Locators<br>
        (832) 603-7278 | ericjohnson@txaptfinder.com
      </p>
    </div>
  `;
}

/**
 * Email 2 — Day 2 (Value-add)
 */
export function renderNurtureEmail2(firstName: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; line-height: 1.6;">
      <p>Hi ${escapeHtml(firstName)},</p>
      
      <p>While I finish pulling options for you, here's something I tell every client in your situation:</p>
      
      <p>When you talk to leasing offices, don't just ask about the rent. Ask for the <strong>full amount due at move-in</strong> — application fee, admin fee, security deposit, prorated rent, and any recurring fees (trash, pest, parking, etc.).</p>
      
      <p>A lot of places quote a nice base rent, then the real first-month number surprises people. Knowing this early helps me filter your list to only the places that actually fit your budget.</p>
      
      <p>I'll have your personalized recommendations ready soon.</p>
      
      <p>
        <strong>Eric Johnson</strong><br>
        TX Apt Finder | Habitat Apartment Locators<br>
        (832) 603-7278 | ericjohnson@txaptfinder.com
      </p>
    </div>
  `;
}

/**
 * Email 3 — Day 5 (Soft follow-up + shortlist offer)
 */
export function renderNurtureEmail3(firstName: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; line-height: 1.6;">
      <p>Hi ${escapeHtml(firstName)},</p>
      
      <p>Just following up on your apartment search. Any updates since you filled out the form — move date changes, new must-haves, or different neighborhoods I should focus on?</p>
      
      <p>If you're still looking, I'd be glad to send over a short, curated list of 6–8 places that match what you shared. No fluff — just the properties I think are worth your time based on your budget, timing, and preferences.</p>
      
      <p>Reply with "send the list" (or any tweaks) and I'll have it in your inbox today. Or if a quick call is easier, just let me know a good time.</p>
      
      <p>
        <strong>Eric Johnson</strong><br>
        TX Apt Finder | Habitat Apartment Locators<br>
        (832) 603-7278 | ericjohnson@txaptfinder.com
      </p>
    </div>
  `;
}
