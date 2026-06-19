# txaptfinder.com - Houston Apartment Locator Website

Landing page + lead-capture form for TX Apt Finder. React/Vite client with a
small Express server that receives form submissions and writes them to Google
Sheets for the GAS v5 pull-mode CRM handoff.

**Hosted on Manus.** Deploys happen through the Manus dashboard, not from here.

## Lead flow

```
Form submit -> POST /api/leads (server/index.ts)
   └─ Google Sheets via GAS endpoint (lands in the leads Sheet and CRM_Queue)
      → GAS v5 → crm_sheet_poller.py → CRM
```

The form returns success when the Sheets webhook accepts the lead. CRM intake
is now handled by the existing GAS v5 pull-mode queue and poller.

## Setup & run

```bash
pnpm install
cp .env.example .env        # fill in tokens - never commit .env
pnpm dev                    # local dev (Vite)
pnpm build && pnpm start    # production build + serve
pnpm check                  # typecheck
```

## Environment variables

See `.env.example`. Set the same values in the **Manus dashboard** for the
live site - local `.env` only affects local runs.

| Var | Purpose |
|---|---|
| `GOOGLE_SHEETS_ENDPOINT` | GAS web app URL (leads -> Sheet + CRM_Queue) |

## Security notes

- `.project-config.json` is a Manus build artifact containing live secrets -
  it is gitignored; never commit it. (It was purged from git history on
  2026-06-10 after a leak; the repo was public at the time, so all credentials
  it contained were rotated.)
- This repo was made private on 2026-06-10.

## Related repos

- `houston_apartment_locator_new` - Manus-side fork with extra setup docs
  (WEBHOOK_SETUP.md etc.); consolidation pending.
- CRM: `~/projects/fb-marketplace-bot` · Lead bot: `~/projects/lead-concierge-bot`
