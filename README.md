# txaptfinder.com — Houston Apartment Locator Website

Landing page + lead-capture form for TX Apt Finder. React/Vite client with a
small Express server that receives form submissions and fans them out.

**Hosted on Manus.** Deploys happen through the Manus dashboard, not from here.

## Lead flow

```
Form submit → POST /api/leads (server/index.ts)
   ├─ HubSpot contact (blocking — primary store)
   ├─ Google Sheets via GAS endpoint (lands in leads Sheet)
   └─ CRM webhook (legacy push — being replaced by Sheet pull;
      see ~/projects/lead-concierge-bot/PULL_MODE_CUTOVER.md)
```

The form responds to the user as soon as HubSpot succeeds; the other syncs are
background fire-and-forget with retry (3 attempts, exponential backoff).

## Setup & run

```bash
pnpm install
cp .env.example .env        # fill in tokens — never commit .env
pnpm dev                    # local dev (Vite)
pnpm build && pnpm start    # production build + serve
pnpm check                  # typecheck
```

## Environment variables

See `.env.example`. Set the same values in the **Manus dashboard** for the
live site — local `.env` only affects local runs.

| Var | Purpose |
|---|---|
| `HUBSPOT_PRIVATE_APP_TOKEN` | HubSpot contact creation |
| `GOOGLE_SHEETS_ENDPOINT` | GAS web app URL (leads → Sheet) |
| `CRM_WEBHOOK_URL` | legacy direct CRM push — delete after pull-mode cutover |

## Security notes

- `.project-config.json` is a Manus build artifact containing live secrets —
  it is gitignored; never commit it. (It was purged from git history on
  2026-06-10 after a leak; the repo was public at the time, so all credentials
  it contained were rotated.)
- This repo was made private on 2026-06-10.

## Related repos

- `houston_apartment_locator_new` — Manus-side fork with extra setup docs
  (WEBHOOK_SETUP.md etc.); consolidation pending.
- CRM: `~/projects/fb-marketplace-bot` · Lead bot: `~/projects/lead-concierge-bot`
