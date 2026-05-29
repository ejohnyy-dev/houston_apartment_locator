import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  
  // Register API routes BEFORE static file serving
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  
  // POST /api/leads - HubSpot lead capture (MUST be before static files)
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

      const toStr = (val: unknown): string => String(val || "");
      const filterEmptyProperties = (obj: Record<string, string>): Record<string, string> => {
        return Object.fromEntries(
          Object.entries(obj).filter(([, value]) => value !== "")
        );
      };

      try {
        const properties = filterEmptyProperties({
          email: toStr(email),
          firstname: toStr(
            first_name ||
              (typeof name === "string" ? name.split(" ")?.[0] : "")
          ),
          lastname: toStr(
            last_name ||
              (typeof name === "string"
                ? name.split(" ")?.slice(1).join(" ")
                : "")
          ),
          phone: toStr(phone),
          budget: toStr(budget),
          bedrooms: toStr(bedrooms),
          movein_timeline: toStr(move_in_timeline),
          preferred_area: toStr(preferred_area),
          pets: toStr(pets),
          notes: toStr(notes),
        });

        const updateUrl = `https://api.hubapi.com/crm/v3/objects/contacts/${encodeURIComponent(
          String(email)
        )}?idProperty=email`;

        // Try to update existing contact
        const hubspotResponse = await fetch(updateUrl, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${hubspotToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ properties }),
        });

        if (hubspotResponse.status === 404) {
          // Contact doesn't exist, create it
          console.log("Contact not found, creating new contact:", email);
          const createUrl = "https://api.hubapi.com/crm/v3/objects/contacts";
          const createResponse = await fetch(createUrl, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${hubspotToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ properties }),
          });

          if (!createResponse.ok) {
            const errorData = await createResponse.text();
            hubspotError = `HubSpot create error: ${createResponse.status}`;
            console.error("HubSpot create error:", createResponse.status, errorData);
          } else {
            hubspotSuccess = true;
            console.log("Lead successfully created in HubSpot:", email);
          }
        } else if (hubspotResponse.ok) {
          // Contact updated successfully
          hubspotSuccess = true;
          console.log("Lead successfully updated in HubSpot:", email);
        } else {
          // Other error
          const errorData = await hubspotResponse.text();
          hubspotError = `HubSpot error: ${hubspotResponse.status}`;
          console.error("HubSpot API error:", hubspotResponse.status, errorData);
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
            firstName: toStr(first_name),
            lastName: toStr(last_name),
            email: toStr(email),
            phone: toStr(phone),
            budget: toStr(budget),
            bedrooms: toStr(bedrooms),
            moveIn: toStr(move_in_timeline),
            areas: toStr(preferred_area),
            pets: toStr(pets),
            notes: toStr(notes),
            smsConsent: toStr(smsConsent || false),
            sms_consent: toStr(smsConsent || false),
            contact_consent: toStr(smsConsent || false),
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
  
  // Static file serving and Vite (MUST be after all API routes)
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
