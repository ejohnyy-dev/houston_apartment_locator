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

  app.post("/api/leads", async (req, res) => {
    const token = process.env.HUBSPOT_PRIVATE_APP_TOKEN;

    if (!token) {
      res.status(500).json({ error: "HubSpot API token is not configured" });
      return;
    }

    const clean = (value: unknown) =>
      value === null || value === undefined ? "" : String(value).trim();

    const email = clean(req.body.email).toLowerCase();

    if (!email) {
      res.status(400).json({ error: "Email is required" });
      return;
    }

    const properties = Object.fromEntries(
      Object.entries({
        email,
        firstname: clean(req.body.first_name || req.body.firstName),
        lastname: clean(req.body.last_name || req.body.lastName),
        phone: clean(req.body.phone),
        budget: clean(req.body.budget),
        bedrooms: clean(req.body.bedrooms),
        movein_timeline: clean(req.body.move_in_timeline || req.body.moveIn),
        preferred_area: clean(req.body.preferred_area || req.body.areas),
      }).filter(([, value]) => value !== "")
    );

    const hubspotHeaders = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };

    try {
      let hubspotResponse = await fetch(
        `https://api.hubapi.com/crm/v3/objects/contacts/${encodeURIComponent(
          email
        )}?idProperty=email`,
        {
          method: "PATCH",
          headers: hubspotHeaders,
          body: JSON.stringify({ properties }),
        }
      );

      if (hubspotResponse.status === 404) {
        hubspotResponse = await fetch(
          "https://api.hubapi.com/crm/v3/objects/contacts",
          {
            method: "POST",
            headers: hubspotHeaders,
            body: JSON.stringify({ properties }),
          }
        );
      }

      const responseBody = await hubspotResponse.json().catch(() => ({}));

      if (!hubspotResponse.ok) {
        res.status(hubspotResponse.status).json({
          error: responseBody.message || "HubSpot request failed",
        });
        return;
      }

      res.json({
        ok: true,
        contactId: responseBody.id || null,
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Unexpected server error",
      });
    }
  });

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

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
