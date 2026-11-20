# CRM Lead Intake Integration

**Status:** ✅ Live — CRM is primary system of record  
**Date:** 2026-06-10 (updated from HubSpot to CRM-only)  
**CRM Endpoint:** https://innocent-terrace-rides-superior.trycloudflare.com/api/leads

---

## How delivery works (outbox)

`/api/leads` does not talk to the CRM inline. It writes the lead to a durable on-disk
outbox and replies immediately; `server/leadQueue.ts` delivers in the background:

- Visitor is told "saved" only after the lead is fsync'd to disk (503 only if the disk write fails).
- 2xx → delivered. 5xx / 408 / 429 / network error → retried: 30s, 1m, 2m, 4m, 8m, then every 15 min, indefinitely.
- Other 4xx (e.g. 400 bad payload) → **not** retried; moved to `dead/` for review.
- Replayed automatically on server start; `CRM_WEBHOOK_URL` is read on every attempt, so changing it takes effect without losing queued leads.
- Each request carries `Idempotency-Key` = sha256(email|phone)[:32] so replays can be deduped.
- Spool location: `LEAD_SPOOL_DIR` (default `./data/lead-spool`) — mount a persistent volume in production.

Previously the form blocked up to ~1 min on CRM retries, retried 4xx errors, and dropped
the lead if the CRM was down or `CRM_WEBHOOK_URL` was unset.

```
form → validate → outbox (disk) → 200 to visitor
                       └→ worker → CRM  (retry/backoff; 4xx → dead/)
```

---

## Request Payload to CRM

```json
{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com",
  "phone": "+17135551234",
  "bedrooms": 2,
  "budget_max": "1500-2000",
  "move_in_date": "Within 30 days",
  "preferred_area": "The Heights",
  "sms_consent": true,
  "source": "txaptfinder"
}
```

---

## Testing

### Test 1: Direct CRM Endpoint (Curl)

```bash
curl -X POST https://innocent-terrace-rides-superior.trycloudflare.com/api/leads \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "firstName": "Test",
    "lastName": "User",
    "phone": "+17135551234",
    "bedrooms": 2,
    "smsConsent": true
  }'
```

Expected response:
```json
{
  "leadId": 42,
  "created": true,
  "score": 7,
  "folder": "warm-leads"
}
```

### Test 2: Via Website Form (End-to-End)

1. Start the CRM server: `cd ~/projects/fb-marketplace-bot && npm run dev`
2. Start the tunnel watcher: `launchctl load ~/Library/LaunchAgents/com.txaptfinder.tunnel.plist`
3. Start the website: `cd ~/projects/houston_apartment_locator && npm run dev`
4. Fill out the contact form at http://localhost:5173/
5. Check CRM app at http://localhost:3000 → Leads → should see the new lead
6. Check server logs for `[CRM forward]` messages

### Test 3: Run Test Script

```bash
cd ~/projects/houston_apartment_locator
bash test-crm-webhook.sh
```

---

## Logging

All CRM forward attempts are logged to the server console:

```
[CRM forward] ✓ Success (200) for john@example.com
[CRM forward] Server error (502) — retrying (attempt 2/4)
[CRM forward] Network error — retrying (attempt 3/4): connect ECONNREFUSED
[CRM forward] ✗ Failed (400) for john@example.com: email is required
```

---

## Error Scenarios

- **CRM / tunnel down:** visitor still sees success; the lead waits in the outbox and is delivered when the CRM is back.
- **`CRM_WEBHOOK_URL` unset:** leads queue (logged each attempt) until it is set.
- **CRM returns 400/401/403/404:** lead moved to `dead/` with `lastError`; fix the cause, then move the file back into the spool dir to replay.
- **Disk write fails:** visitor gets 503 with "call or text Eric".
- **Crash mid-delivery:** lead is still on disk; worst case it is delivered twice (hence the idempotency key).

---

## Next Steps

### Immediate
- [ ] Start CRM server: `cd ~/projects/fb-marketplace-bot && npm run dev`
- [ ] Run test script: `bash test-crm-webhook.sh`
- [ ] Verify leads appear in CRM app at http://localhost:3000

### Soon
- [ ] Monitor logs for 24 hours to confirm stable integration
- [ ] Set up metrics/alerts for failed CRM forwards (optional)
- [ ] Consider adding database logging of forwarding attempts (optional)

### Future
- [ ] Named tunnel (`crm.txaptfinder.com`) to avoid tunnel URL changes
- [ ] Webhook retry queue in database (if retries become frequent)
- [ ] Slack notification on repeated CRM sync failures

---

## Summary

All form submissions are saved to a durable outbox first, then delivered to the CRM
(system of record; HubSpot removed) in the background with indefinite backoff. A CRM
outage delays leads but does not lose them. Inspect `data/lead-spool/` (pending) and
`dead/` (rejected) when a lead seems missing.
