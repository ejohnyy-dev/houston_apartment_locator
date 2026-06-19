# Lead Intake Architecture

**Status:** ✅ Pull-mode — Sheets → GAS v5 → local poller → CRM
**Updated:** 2026-06-17

---

## Flow

```
[txaptfinder.com form submission]
         ↓
[POST /api/leads]
         ↓
[Google Sheets via GOOGLE_SHEETS_ENDPOINT]
         ↓ (GAS v5 writes to CRM_Queue tab)
[crm_sheet_poller.py pulls every 60 s — no public tunnel required]
         ↓
[CRM /api/leads/intake on the Mac mini]
         ↓
[n8n Workflow 1 → mark CONTACTED → property list → first contact]
```

The website no longer pushes directly to the CRM. `CRM_WEBHOOK_URL` has been
removed from the website code. The Mac mini poller (launchd
`com.txaptfinder.crmpoller`) owns the Sheets → CRM handoff.

---

## Website environment variables

| Var | Required | Purpose |
|-----|----------|---------|
| `GOOGLE_SHEETS_ENDPOINT` | ✅ yes | GAS v5 web-app exec URL (writes to Leads Sheet + CRM_Queue) |
| `CRM_WEBHOOK_URL` | ❌ removed | No longer used — poller replaced the direct push |

---

## Health endpoint

`GET /api/health/config` returns:

```json
{ "status": "ok", "sinks": { "sheets": true }, "leadCaptureReady": true }
```

`status` is `"ok"` when `GOOGLE_SHEETS_ENDPOINT` is set, `"no-sinks"` otherwise.

---

## Poller details

| Component | Location |
|-----------|----------|
| Script | `~/projects/lead-concierge-bot/crm_sheet_poller.py` |
| Config | `~/projects/lead-concierge-bot/data/crm_poller.env` |
| Log | `~/projects/lead-concierge-bot/data/crm_poller.log` |
| launchd job | `com.txaptfinder.crmpoller` (every 60 s) |
| GAS v5 doc | `~/projects/lead-concierge-bot/PULL_MODE_CUTOVER.md` |

---

## Testing

```bash
# Health check
curl http://localhost:3000/api/health/config

# Submit a test lead (hits Sheets only; poller picks it up within 60 s)
curl -X POST http://localhost:3000/api/leads \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","first_name":"Test","last_name":"Lead"}'

# Watch poller
tail -f ~/projects/lead-concierge-bot/data/crm_poller.log
```
