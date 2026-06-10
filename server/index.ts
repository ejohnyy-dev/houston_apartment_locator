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
    const crmUrl = process.env.CRM_WEBHOOK_URL;

    if (!crmUrl) {
      console.error("[Lead intake] CRM_WEBHOOK_URL not configured");
      return res.status(500).json({ error: "CRM not configured" });
    }

    const clean = (value: unknown) =>
      value === null || value === undefined ? "" : String(value).trim();

    const email = clean(req.body.email).toLowerCase();

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const toNumber = (v: unknown) => {
      const n = parseInt(String(v ?? "").replace(/[^0-9]/g, ""), 10);
      return Number.isFinite(n) ? n : undefined;
    };

    const crmPayload = {
      first_name: clean(req.body.first_name || req.body.firstName),
      last_name: clean(req.body.last_name || req.body.lastName),
      email,
      phone: clean(req.body.phone),
      bedrooms: toNumber(req.body.bedrooms),
      budget_max: toNumber(req.body.budget),
      move_in_date: clean(req.body.move_in_timeline || req.body.moveIn),
      preferred_area: clean(req.body.preferred_area || req.body.areas),
      sms_consent: req.body.sms_consent ?? req.body.smsConsent ?? false,
      source: "txaptfinder",
    };

    // Retry logic: exponential backoff (1s, 2s, 4s)
    const submitToCrm = async (retryCount = 0): Promise<void> => {
      const maxRetries = 3;
      const timeout = 5000;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(crmUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(crmPayload),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (response.ok) {
          const data = await response.json().catch(() => ({}));
          console.log(`[Lead intake] ✓ Success for ${email} (leadId: ${data.leadId})`);
          return;
        } else if (response.status >= 500 && retryCount < maxRetries) {
          // Server error — retry
          console.warn(
            `[Lead intake] Server error (${response.status}) — retrying (attempt ${retryCount + 2}/${maxRetries + 1})`
          );
          await new Promise((r) => setTimeout(r, Math.pow(2, retryCount) * 1000));
          await submitToCrm(retryCount + 1);
        } else {
          // Client error (4xx) or max retries reached
          const body = await response.json().catch(() => ({}));
          throw new Error(
            `CRM error ${response.status}: ${body.error || "unknown error"}`
          );
        }
      } catch (error) {
        clearTimeout(timer);

        if (retryCount < maxRetries) {
          console.warn(
            `[Lead intake] Network error — retrying (attempt ${retryCount + 2}/${maxRetries + 1}):`,
            error instanceof Error ? error.message : String(error)
          );
          await new Promise((r) => setTimeout(r, Math.pow(2, retryCount) * 1000));
          await submitToCrm(retryCount + 1);
        } else {
          throw new Error(
            `Failed after ${maxRetries} retries: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    };

    try {
      await submitToCrm();
      res.json({ ok: true, message: "Lead saved to CRM" });
    } catch (error) {
      console.error(`[Lead intake] ✗ Failed for ${email}:`, error);
      res.status(503).json({
        error: error instanceof Error ? error.message : "Failed to save lead",
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
