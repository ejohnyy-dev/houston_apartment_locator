# txaptfinder.com — Houston Apartment Locator Website

Landing page + lead-capture form for TX Apt Finder. React/Vite client with a
small Express server that receives form submissions and fans them out.

**Hosted on Manus.** Deploys happen through the Manus dashboard, not from here.

## Lead flow

```
Form submit → POST /api/leads (server/index.ts)
   1. validate email, normalize payload
   2. write lead to the on-disk outbox (data/lead-spool, fsync'd)  ← visitor gets "saved" here
   3. background worker (server/leadQueue.ts) POSTs it to the CRM (CRM_WEBHOOK_URL)
        ├─ 2xx            → removed from outbox
        ├─ 5xx/408/429/network → kept, retried with backoff 30s → 15min cap, indefinitely
        └─ other 4xx      → moved to data/lead-spool/dead/ for manual review
```

The CRM is the system of record (HubSpot/Sheets are no longer written). A CRM or
tunnel outage delays leads but does not lose them; the outbox is replayed on every
server start. Each delivery carries an `Idempotency-Key` (hash of email+phone).

**Outbox durability:** `LEAD_SPOOL_DIR` must point at a persistent volume in
production (e.g. a Fly volume mounted at `/data`, `LEAD_SPOOL_DIR=/data/lead-spool`).
On an ephemeral disk the outbox survives CRM outages but not redeploys/restarts.
Check `data/lead-spool/` (pending) and `dead/` (rejected) when leads seem missing.

## Setup & run

```bash
pnpm install
cp .env.example .env        # fill in tokens — never commit .env
pnpm dev                    # local dev (Vite)
pnpm build && pnpm start    # production build + serve
pnpm check                  # typecheck
npx vitest run --root . --dir server   # tests
```

## Environment variables

See `.env.example`. Set the same values in the **Manus dashboard** for the
live site — local `.env` only affects local runs.

| Var | Purpose |
|---|---|
| `CRM_WEBHOOK_URL` | CRM lead-intake endpoint (use a named tunnel, not a trycloudflare URL) |
| `LEAD_SPOOL_DIR` | lead outbox directory (default `./data/lead-spool`) — put on a persistent volume |

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
