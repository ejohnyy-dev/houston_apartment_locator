import express from "express";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from "url";
import { enqueueLead, makeCrmDeliver, startLeadWorker } from "./leadQueue";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "1mb" }));

  // Background CRM delivery. The URL is read per attempt so a rotated tunnel URL
  // in the environment is picked up without losing queued leads.
  const leadWorker = startLeadWorker((entry) =>
    makeCrmDeliver(process.env.CRM_WEBHOOK_URL)(entry)
  );

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

    const crmPayload = {
      first_name: clean(req.body.first_name || req.body.firstName),
      last_name: clean(req.body.last_name || req.body.lastName),
      email,
      phone: clean(req.body.phone),
      bedrooms: parseBedrooms(req.body.bedrooms),
      budget_min: budget.min,
      budget_max: budget.max,
      move_in_date: clean(req.body.move_in_timeline || req.body.moveIn),
      preferred_area: clean(req.body.preferred_area || req.body.areas),
      notes: combinedNotes,
      sms_consent: req.body.sms_consent ?? req.body.smsConsent ?? false,
      consent_source: "txaptfinder.com contact form",
      source: "txaptfinder",
    };

    // Persist first, deliver later: the visitor is only told "saved" once the lead
    // is durably on disk. Delivery to the CRM (with backoff, replay after restarts)
    // happens in the background worker – see server/leadQueue.ts.
    try {
      const entry = enqueueLead(crmPayload);
      console.log(`[Lead intake] queued ${entry.id} for ${email}`);
      leadWorker.kick();
      res.json({ ok: true, message: "Lead saved" });
    } catch (error) {
      console.error(`[Lead intake] ✗ could not persist lead for ${email}:`, error);
      res.status(503).json({ error: "Could not save your information. Please call or text Eric." });
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
