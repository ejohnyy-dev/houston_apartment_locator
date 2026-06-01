# Automation Setup — Houston Apartment Locator

## Phase 1: Scheduled RentCast Data Refresh ✅ IMPLEMENTED

### What Was Built
A **scheduled background job** that automatically refreshes the RentCast apartment cache daily at 3:00 AM UTC.

### Files Created/Modified
1. **`server/scheduled/refreshRentCast.ts`** (NEW)
   - Handles HTTP POST requests from the cron system
   - Authenticates requests as cron-only
   - Triggers RentCast cache refresh via `getRentCastDatabaseStats()`
   - Returns detailed stats on the refresh result
   - Includes error handling and logging

2. **`server/_core/index.ts`** (MODIFIED)
   - Registered `/api/scheduled/refresh-rentcast` endpoint
   - Imported and mounted the refresh handler
   - Placed before static file serving (required)

### How It Works
1. **Trigger**: Manus platform sends HTTP POST to `/api/scheduled/refresh-rentcast` at 3:00 AM UTC
2. **Authentication**: Request is verified as a cron job (not a user request)
3. **Refresh**: `getRentCastDatabaseStats()` is called, which:
   - Reads the existing RentCast cache
   - Fetches fresh listings for properties with stale cache entries
   - Respects the monthly API request limit (50 requests/month)
   - Blends RentCast results with local property database
   - Returns comprehensive stats
4. **Response**: Returns JSON with refresh status, property counts, and API usage

### Benefits
- ✅ **Instant Performance**: Users always see fresh data without waiting for sync
- ✅ **Reliability**: Prevents timeouts during user requests
- ✅ **Rate Limit Control**: Scheduled batches respect API quotas
- ✅ **Transparent**: All refreshes logged with detailed stats
- ✅ **Idempotent**: Safe to retry on failure

### Next Step: Deploy & Schedule
Before the cron job can run, the site must be **deployed to production**. Once deployed:

```bash
# Create the daily 3:00 AM UTC refresh job
manus-heartbeat create \
  --name "daily-rentcast-refresh" \
  --cron "0 0 3 * * *" \
  --path "/api/scheduled/refresh-rentcast" \
  --description "Daily RentCast apartment cache refresh at 3:00 AM UTC" \
  --repeated
```

---

## Phase 2: Centralized Integration Config (NEXT)

### Goal
Streamline management of all integrations (RentCast, HubSpot, Google Sheets) via `manus-config`.

### What Will Be Built
1. **Connector Registry**: Enable/disable integrations from a single config file
2. **Environment Validation**: Verify all required API keys are set
3. **Integration Status Dashboard**: Check health of each service
4. **Graceful Fallbacks**: Site continues working if optional integrations fail

### Expected Files
- `server/_core/integrations.ts` — Centralized integration manager
- `server/routers/integrations.ts` — tRPC endpoints for integration status
- Updated `.env.example` with all required variables

---

## Phase 3: Professional Excel Reports (FINAL)

### Goal
Generate one-click Excel reports for:
- Apartment inventory with pricing, photos, neighborhoods
- Lead capture data with qualification scores
- Monthly performance metrics

### Expected Features
- Professional styling with theme colors
- Data validation and conditional formatting
- Charts and summaries
- Downloadable from admin dashboard

---

## Configuration Reference

### Environment Variables Required
```
# RentCast API
RENTCAST_API_KEY=<32-char hex key>
RENTCAST_MONTHLY_REQUEST_LIMIT=50
RENTCAST_CACHE_TTL_HOURS=24

# HubSpot (required for lead capture)
HUBSPOT_PRIVATE_APP_TOKEN=<token>

# Google Sheets (optional)
GOOGLE_SHEETS_ENDPOINT=<webhook URL>

# Manus Heartbeat (set by deployment platform)
BUILT_IN_FORGE_API_URL=<platform URL>
BUILT_IN_FORGE_API_KEY=<platform key>
```

### Cron Expression Format
All scheduled jobs use **6-field cron** (with seconds):
```
sec min hour dom mon dow
0   0   3    *   *   *     # Daily at 3:00 AM UTC
0   0   9    *   *   1-5   # Weekdays at 9:00 AM UTC
0   0   0,12 *   *   *     # Twice daily (midnight & noon UTC)
```

---

## Monitoring & Troubleshooting

### View Refresh History
```bash
# List all scheduled jobs
manus-heartbeat list

# View recent executions
manus-heartbeat logs --task-uid <task_uid> --with-body
```

### Common Issues
| Issue | Cause | Fix |
|-------|-------|-----|
| Cron never fires | Site not deployed | Deploy to production first |
| "BUILT_IN_FORGE_API_URL not set" | Local dev environment | Only runs on deployed sites |
| API rate limit hit | Monthly quota exceeded | Adjust `RENTCAST_MONTHLY_REQUEST_LIMIT` or cron frequency |
| Stale data | Cache TTL too long | Reduce `RENTCAST_CACHE_TTL_HOURS` |

---

## Success Metrics
- [ ] Cron job created and visible in `manus-heartbeat list`
- [ ] Daily refresh executes successfully (check logs)
- [ ] RentCast API usage tracked and within limits
- [ ] Users see updated listings without manual refresh
- [ ] No errors in `/api/scheduled/refresh-rentcast` responses
