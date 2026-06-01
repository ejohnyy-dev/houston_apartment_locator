import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "1mb" }));

  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  app.post("/api/leads", async (req, res) => {
    try {
      const body = (req.body as Record<string, unknown>) ?? {};
      const email = body.email;

      if (!email || typeof email !== "string") {
        return res.status(400).json({ ok: false, error: "Email is required" });
      }

      const hubspotToken = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
      if (!hubspotToken) {
        console.error("HubSpot token not configured");
        return res.status(500).json({
          ok: false,
          error: "HubSpot token is not configured",
        });
      }

      const properties = filterEmptyProperties({
        email: toStr(email),
        firstname: toStr(
          body.first_name ||
            (typeof body.name === "string" ? body.name.split(" ")?.[0] : "")
        ),
        lastname: toStr(
          body.last_name ||
            (typeof body.name === "string"
              ? body.name.split(" ")?.slice(1).join(" ")
              : "")
        ),
        phone: toStr(body.phone),
        budget: toStr(body.budget),
        bedrooms: toStr(body.bedrooms),
        movein_timeline: toStr(body.move_in_timeline),
        preferred_area: toStr(body.preferred_area),
        pets: toStr(body.pets),
        notes: toStr(body.notes),
      });

      let hubspotError: string | null = null;
      try {
        const updateUrl = `https://api.hubapi.com/crm/v3/objects/contacts/${encodeURIComponent(
          email
        )}?idProperty=email`;

        const hubspotResponse = await fetch(updateUrl, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${hubspotToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ properties }),
        });

        if (!hubspotResponse.ok) {
          const errorData = await hubspotResponse.text();
          hubspotError = `HubSpot error: ${hubspotResponse.status}`;
          console.error("HubSpot API error:", hubspotResponse.status, errorData);
        } else {
          console.log("Lead successfully sent to HubSpot:", email);
        }
      } catch (err) {
        console.error("HubSpot fetch error:", err);
        return res.status(500).json({
          ok: false,
          error: "Failed to send lead to HubSpot",
        });
      }

      const googleSheetsUrl = process.env.GOOGLE_SHEETS_ENDPOINT;
      if (googleSheetsUrl) {
        try {
          const googlePayload = new URLSearchParams({
            firstName: toStr(body.first_name),
            lastName: toStr(body.last_name),
            email: toStr(email),
            phone: toStr(body.phone),
            budget: toStr(body.budget),
            bedrooms: toStr(body.bedrooms),
            moveIn: toStr(body.move_in_timeline),
            areas: toStr(body.preferred_area),
            pets: toStr(body.pets),
            notes: toStr(body.notes),
            smsConsent: toStr(body.smsConsent || false),
            sms_consent: toStr(body.smsConsent || false),
            contact_consent: toStr(body.smsConsent || false),
            consent_source: "txaptfinder.com contact form",
            consent_timestamp: new Date().toISOString(),
            _source: "txaptfinder.com",
            page_url: toStr(req.headers.referer),
            user_agent: toStr(req.headers["user-agent"]),
          });

          await fetch(googleSheetsUrl, {
            method: "POST",
            mode: "no-cors",
            body: googlePayload,
          });

          console.log("Lead successfully sent to Google Sheets:", email);
        } catch (err) {
          console.error("Google Sheets error:", err);
        }
      } else {
        console.warn("Google Sheets endpoint not configured, skipping");
      }

      if (!hubspotError) {
        return res.status(200).json({ ok: true, message: "Lead saved to HubSpot" });
      } else {
        return res.status(500).json({
          ok: false,
          error: hubspotError,
        });
      }
    } catch (error) {
      console.error("API error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Internal server error";
      return res.status(500).json({
        ok: false,
        error: errorMessage,
      });
    }
  });

  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

function toStr(val: unknown): string {
  return String(val || "");
}

function filterEmptyProperties(
  obj: Record<string, string>
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) => value !== "")
  );
}

startServer().catch(console.error);
