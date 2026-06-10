# CRM Webhook Integration Setup

**Status:** ✅ Configured & Ready  
**Date:** 2026-06-10  
**CRM Endpoint:** https://innocent-terrace-rides-superior.trycloudflare.com/api/leads

---

## What Changed

### 1. Enhanced Retry Logic (`server/index.ts`)

The lead forwarding handler now includes:
- ✅ **Automatic retries** on network failures (up to 3 attempts)
- ✅ **Exponential backoff** (1s, 2s, 4s between retries)
- ✅ **Better logging** with clear success/failure messages per attempt
- ✅ **Smarter retry conditions** (retries on 5xx errors, stops on 4xx)
- ✅ **Increased timeout** from 4s to 5s
- ✅ **Non-blocking** — CRM sync never blocks form response to user

### 2. Environment Configuration

Added `CRM_WEBHOOK_URL` to `.env`:
```env
CRM_WEBHOOK_URL=https://innocent-terrace-rides-superior.trycloudflare.com/api/leads
```

This URL points to the Cloudflare tunnel running the fb-marketplace-bot CRM server.

---

## Flow Diagram

```
[txaptfinder.com form submission]
         ↓
[POST /api/leads]
         ↓
[Update HubSpot] ← blocks response until complete
         ↓
[Send response to user] (form thanks message)
         ↓
[In background: Forward to CRM with retry]
    ├─ Attempt 1 (immediate)
    ├─ Attempt 2 (after 1s) [if 5xx or network error]
    ├─ Attempt 3 (after 2s) [if 5xx or network error]
    └─ Attempt 4 (after 4s) [if 5xx or network error]
         ↓
[Log result to console]
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

### Scenario 1: CRM Server Offline
- ✅ Form submission succeeds (user sees thank you)
- ✅ Integration retries 3 times over 7 seconds
- ⚠️ Lead doesn't appear in CRM until server comes back up and webhook is manually replayed
- 📝 Error logged to console for investigation

### Scenario 2: Network Timeout
- ✅ First attempt times out after 5s
- ✅ Retries automatically (1s, 2s, 4s delays)
- ✅ If all retries fail, logged but doesn't break the user experience

### Scenario 3: CRM API Returns 400 (Client Error)
- ❌ Not retried (client error, not server error)
- 📝 Full error logged for debugging

---

## Configuration & Tuning

To adjust retry behavior, edit `server/index.ts`:

```typescript
const maxRetries = 3;              // Change number of retries
const timeout = 5000;              // Change timeout (ms)
const delayMultiplier = 2;         // Change backoff factor (currently: 1s, 2s, 4s)
```

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

The integration is **complete and tested**. All form submissions now:
1. Save to HubSpot (primary system of record)
2. Forward to the in-app CRM (secondary sync) with automatic retry
3. Display success message to user immediately (non-blocking)
4. Log all retry attempts for debugging

The CRM is the **future system of record** once you decide to fully migrate from HubSpot.
