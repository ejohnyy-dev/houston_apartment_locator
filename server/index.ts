import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  // JSON parsing middleware
  app.use(express.json({ limit: "1mb" }));

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // POST /api/leads - Send to HubSpot (required) and Google Sheets (optional)
  app.post("/api/leads", async (req, res) => {
    try {
      const body = (req.body as Record<string, unknown>) ?? {};
      const first_name = body.first_name;
      const last_name = body.last_name;
      const name = body.name;
      const email = body.email;
      const phone = body.phone;
      const budget = body.budget;
      const bedrooms = body.bedrooms;
      const move_in_timeline = body.move_in_timeline;
      const preferred_area = body.preferred_area;
      const pets = body.pets;
      const notes = body.notes;
      const smsConsent = body.smsConsent;

      if (!email || typeof email !== "string") {
        return res.status(400).json({ ok: false, error: "Email is required" });
      }

      let hubspotSuccess = false;
      let hubspotError: string | null = null;

      // Send to HubSpot (REQUIRED)
      const hubspotToken = process.env.HUBSPOT_PRIVATE_APP_TOKEN;
      if (!hubspotToken) {
        console.error("HubSpot token not configured");
        return res.status(500).json({
          ok: false,
          error: "HubSpot token is not configured",
        });
      }

      try {
        const properties: Record<string, string> = {
          email: String(email),
          firstname: String(
            first_name ||
              (typeof name === "string" ? name.split(" ")?.[0] : "") ||
              ""
          ),
          lastname: String(
            last_name ||
              (typeof name === "string" ? name.split(" ")?.slice(1).join(" ") : "") ||
              ""
          ),
          phone: String(phone || ""),
          budget: String(budget || ""),
          bedrooms: String(bedrooms || ""),
          movein_timeline: String(move_in_timeline || ""),
          preferred_area: String(preferred_area || ""),
          pets: String(pets || ""),
          notes: String(notes || ""),
        };

        // Remove empty properties
        Object.keys(properties).forEach((key) => {
          if (!properties[key]) {
            delete properties[key];
          }
        });

        const updateUrl = `https://api.hubapi.com/crm/v3/objects/contacts/${encodeURIComponent(
          String(email)
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
          hubspotSuccess = true;
          console.log("Lead successfully sent to HubSpot:", email);
        }
      } catch (hubspotError) {
        console.error("HubSpot fetch error:", hubspotError);
        return res.status(500).json({
          ok: false,
          error: "Failed to send lead to HubSpot",
        });
      }

      // Send to Google Sheets (OPTIONAL)
      const googleSheetsUrl = process.env.GOOGLE_SHEETS_ENDPOINT;
      if (googleSheetsUrl) {
        try {
          const googlePayload = new URLSearchParams({
            firstName: String(first_name || ""),
            lastName: String(last_name || ""),
            email: String(email || ""),
            phone: String(phone || ""),
            budget: String(budget || ""),
            bedrooms: String(bedrooms || ""),
            moveIn: String(move_in_timeline || ""),
            areas: String(preferred_area || ""),
            pets: String(pets || ""),
            notes: String(notes || ""),
            smsConsent: String(smsConsent || false),
            sms_consent: String(smsConsent || false),
            contact_consent: String(smsConsent || false),
            consent_source: "txaptfinder.com contact form",
            consent_timestamp: new Date().toISOString(),
            _source: "txaptfinder.com",
            page_url: String(req.headers.referer || ""),
            user_agent: String(req.headers["user-agent"] || ""),
          });

          await fetch(googleSheetsUrl, {
            method: "POST",
            mode: "no-cors",
            body: googlePayload,
          });

          console.log("Lead successfully sent to Google Sheets:", email);
        } catch (googleError) {
          console.error("Google Sheets error:", googleError);
          // Don't fail the request if Google Sheets fails
        }
      } else {
        console.warn("Google Sheets endpoint not configured, skipping");
      }

      // Return success if HubSpot succeeded
      if (hubspotSuccess) {
        return res.status(200).json({ ok: true, message: "Lead saved to HubSpot" });
      } else {
        return res.status(500).json({
          ok: false,
          error: hubspotError || "Failed to save lead",
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

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
