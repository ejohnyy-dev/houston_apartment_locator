import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import {
  failedLeadSinks,
  getConfigHealth,
  hasSuccessfulLeadSink,
  logSinkHealth,
  type LeadSinkResults,
} from "./leadSinks";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  logSinkHealth();

  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "1mb" }));

  app.get("/api/health/config", (_req, res) => {
    res.json(getConfigHealth());
  });

  app.post("/api/leads", async (req, res) => {
    const clean = (value: unknown) =>
      value === null || value === undefined ? "" : String(value).trim();

    const email = clean(req.body.email).toLowerCase();

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Parse budget option strings like "$1,000 – $1,500", "Under $1,000",
    // "$3,000+" into min/max. Naive digit-stripping would turn
    // "$1,000 – $1,500" into 10001500.
    const parseBudget = (v: unknown): { min?: number; max?: number } => {
      const s = String(v ?? "");
      const nums = (s.match(/\d[\d,]*/g) ?? [])
        .map((n) => parseInt(n.replace(/,/g, ""), 10))
        .filter((n) => Number.isFinite(n) && n >= 100 && n <= 50000);
      if (nums.length === 0) return {};
      if (nums.length === 1) {
        if (/under|below|less/i.test(s)) return { max: nums[0] };
        if (/\+|over|above|more/i.test(s)) return { min: nums[0] };
        return { max: nums[0] };
      }
      return { min: Math.min(...nums), max: Math.max(...nums) };
    };

    // "Studio" → 0, "1 Bedroom" → 1, "3+ Bedrooms" → 3
    const parseBedrooms = (v: unknown): number | undefined => {
      const s = String(v ?? "");
      if (/studio/i.test(s)) return 0;
      const m = s.match(/\d+/);
      return m ? parseInt(m[0], 10) : undefined;
    };

    const budget = parseBudget(req.body.budget);
    const pets = clean(req.body.pets);
    const notes = clean(req.body.notes);
    const combinedNotes =
      [pets && pets !== "No pets" ? `Pets: ${pets}` : "", notes]
        .filter(Boolean)
        .join(" | ") || undefined;

    const sinkResults: LeadSinkResults = {
      sheets: null,
    };

    const sheetsUrl = process.env.GOOGLE_SHEETS_ENDPOINT;
    if (sheetsUrl) {
      try {
        const sheetPayload = new URLSearchParams({
          firstName: clean(req.body.first_name || req.body.firstName),
          lastName: clean(req.body.last_name || req.body.lastName),
          email,
          phone: clean(req.body.phone),
          budget: clean(req.body.budget),
          bedrooms: clean(req.body.bedrooms),
          moveIn: clean(req.body.move_in_timeline || req.body.moveIn),
          areas: clean(req.body.preferred_area || req.body.areas),
          pets,
          notes: combinedNotes ?? "",
          smsConsent: String(req.body.sms_consent ?? req.body.smsConsent ?? false),
          sms_consent: String(req.body.sms_consent ?? req.body.smsConsent ?? false),
          contact_consent: String(req.body.sms_consent ?? req.body.smsConsent ?? false),
          consent_source: "txaptfinder.com contact form",
          consent_timestamp: new Date().toISOString(),
          _source: "txaptfinder.com",
          page_url: clean(req.headers.referer),
          user_agent: clean(req.headers["user-agent"]),
        });

        const response = await fetch(sheetsUrl, {
          method: "POST",
          body: sheetPayload,
        });

        sinkResults.sheets = response.ok;
        if (response.ok) {
          console.log(`[Google Sheets] Lead submitted successfully: ${email}`);
        } else {
          console.warn("[Google Sheets] Unexpected status:", response.status);
        }
      } catch (error) {
        sinkResults.sheets = false;
        console.error("Google Sheets error:", error);
      }
    } else {
      console.warn("Google Sheets endpoint not configured, skipping");
    }

    if (!hasSuccessfulLeadSink(sinkResults)) {
      console.error(`[leads] All sinks missing or failed for ${email}. Returning 503.`);
      return res.status(503).json({
        ok: false,
        error: "Lead could not be saved. Please try again or contact us directly.",
      });
    }

    for (const sink of failedLeadSinks(sinkResults)) {
      console.warn(`[leads] sink ${sink} failed for ${email}`);
    }

    return res.status(200).json({ ok: true, message: "Lead received" });
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
