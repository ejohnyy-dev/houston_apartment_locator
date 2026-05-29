# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Houston Apartment Locator** is a React + Express + tRPC full-stack application that helps renters find apartments in Houston. It features:
- Interactive Google Maps with 530+ apartment listings
- Real-time search & filtering by neighborhood, price, bedrooms, amenities
- Lead capture and management system
- Favorites/bookmarking for registered users
- Qualification-based apartment matching
- Admin dashboard for lead tracking and analytics

---

## Commands Reference

### Development
```bash
pnpm dev          # Start dev server (client + server with hot reload)
pnpm build        # Build client (Vite) + server (esbuild) for production
pnpm start        # Run production build (requires NODE_ENV=production)
```

### Database
```bash
pnpm db:push      # Generate migrations + apply them to MySQL database
```

### Code Quality
```bash
pnpm check        # TypeScript type checking (no emit)
pnpm format       # Auto-format code with Prettier
pnpm test         # Run Vitest tests (suite-based, not watch mode)
```

### Running a Single Test
```bash
pnpm test -- --reporter=verbose server/favorites.test.ts
# Or filter by test name
pnpm test -- --reporter=verbose -t "favorites"
```

---

## Architecture Overview

The application follows a **monorepo structure** with clear separation of concerns:

```
client/                    ← React 19 frontend (Vite)
server/                    ← Express + tRPC backend
├── _core/                 ← Framework infrastructure (OAuth, context, DB)
├── routers.ts             ← All tRPC endpoint definitions
├── db.ts                  ← SQLite query helpers for leads/apartments
├── email.ts               ← Email rendering + sending
├── analytics.ts           ← Analytics event tracking
├── propertyDatabase.ts    ← Local apartment data source
├── rentcastDatabase.ts    ← RentCast API integration
├── qualification.test.ts  ← Qualification filtering logic
└── *.test.ts              ← Feature tests (Vitest)
drizzle/schema.ts          ← MySQL table definitions (used in migrations)
shared/                    ← Shared constants + types
```

### Two Database Strategies

This app **switches between two database backends** depending on environment:

1. **SQLite (Development Default):** `server/db.ts` uses better-sqlite3 with schema in `server/db.ts`. Tables: apartments, leads, amenities, apartment_amenities, lead_interactions, saved_searches, favorites, email_subscriptions, qualifications, inquiries, analytics_events.

2. **MySQL (Production/Manus Platform):** Uses Drizzle ORM with schema in `drizzle/schema.ts`. Schema is managed via `pnpm db:push` (calls `drizzle-kit generate && drizzle-kit migrate`).

**Key Detail:** The app dynamically sources apartment data:
- If `RENTCAST_API_KEY` is set → use RentCast API (real estate listings)
- Else if MySQL database has apartments → use Property Database (local listings)
- Else → fall back to SQLite local apartments

### Data Flow Patterns

**Apartment Search:**
1. Client calls `apartments.list` with filters (neighborhood, rent, bedrooms, etc.)
2. Server chooses data source (RentCast API → Property DB → SQLite)
3. Server applies qualification filter if user has preferences
4. Results returned to frontend for display

**Lead Submission:**
1. Client submits `leads.submit` with name/email/phone
2. Server validates rate limit (10 per hour per IP)
3. Server creates lead record + sends nurture email (Email 1)
4. Server sends owner notification
5. Returns leadId for client tracking

**Favorite/Saved Search:**
1. Requires authentication (protectedProcedure)
2. Stored in database with leadId
3. Used to filter apartment recommendations
4. Persisted for logged-in users

---

## Key tRPC Routers (server/routers.ts)

### `apartments` - Public listings
- `list(filters)` → Returns apartments with optional qualification filtering
- `getTeased(id)` → Public view (no address, landlord info)
- `getFull(id)` → Admin only (full details)
- `create`, `seedSample` → Admin apartment management
- `databaseStats()` → Returns available apartment count + data source

### `leads` - Lead capture & management
- `submit(name, email, phone, moveTimeline)` → Public lead submission + email nurturing
- `list(status, searchTerm)` → Admin: list all leads with optional filters
- `update(id, status, notes)` → Admin: change lead status/notes
- `exportCsv()` → Admin: export leads as CSV

### `favorites` - User bookmarking
- `add/remove(apartmentId)` → Add/remove from favorites
- `list()` → Get user's favorite apartments
- `isFavorited(apartmentId)` → Check if apartment is in favorites

### `savedSearches` - Reusable filters
- `create(name, ...filters)` → Save a search configuration
- `list()` → Get all saved searches for user
- `delete(id)` → Remove a saved search

### `emailSubscriptions` - Email alerts
- `create(savedSearchId, emailAddress, frequency)` → Subscribe to search updates
- `list/update/delete()` → Manage subscriptions

### `amenities` - Feature catalog
- `list()` → Public amenities
- `create(name, icon)` → Admin amenities

### `analytics` - Admin metrics
- `summary()` → Search count, top cities, API usage
- `topSearches(limit)` → Most-searched filter combinations
- `sendMonthlyReport()` → Email analytics to owner

### `auth` - Authentication
- `me()` → Return current user
- `logout()` → Clear session cookie

---

## Database Schema (SQLite/MySQL)

### Core Tables

**apartments** - Listing data
- `id`, `name`, `neighborhood`, `bedrooms`, `bathrooms`, `rentMin`, `rentMax`
- `description`, `latitude`, `longitude`, `photos` (JSON array)
- `exactAddress` (private, not shown to public), `landlordName`, `landlordPhone`, `landlordEmail`
- `unitsAvailable`, `createdAt`, `updatedAt`

**leads** - Lead submissions (user records)
- `id`, `name`, `email`, `phone`
- `moveTimeline` (e.g., "0-2 weeks", "2-4 weeks")
- `status` (enum: new | contacted | qualified | converted | inactive)
- `notes`, `nurtureStage`, `lastNurtureSentAt`
- `submittedAt`, `lastContactedAt`, `createdAt`

**qualifications** - User apartment preferences (search profile)
- `userId`, `preferredAreas` (JSON text), `moveInTimeline`
- `minBedrooms`, `maxBedrooms`, `minBathrooms`, `maxBathrooms`
- `minBudget`, `maxBudget`, `pets` (JSON)

**favorites** - Bookmarked apartments
- `id`, `apartmentId`, `apartmentName`, `neighborhood`, `rentMin`, `rentMax`, `bedrooms`, `createdAt`

**lead_interactions** - User activity tracking
- `id`, `leadId`, `apartmentId`, `interactionType` (enum: view | favorite | inquiry), `timestamp`

**saved_searches** - Reusable filter sets
- `id`, `leadId`, `name`, neighborhood, minRent, maxRent, minBedrooms, maxBedrooms, etc., `createdAt`

**email_subscriptions** - Email alerts for saved searches
- `id`, `leadId`, `savedSearchId`, `emailAddress`, `frequency` (daily | weekly | biweekly | monthly), `isActive`, `createdAt`

**inquiries** - Contact form submissions
- `id`, `name`, `email`, `phone`, `apartmentId`, `apartmentName`, `moveInDate`
- `message`, `favoriteIds` (JSON array), `qualificationData` (JSON)
- `source`, `createdAt`

**analytics_events** - Search + view tracking
- `id`, `eventType` (search | view), `neighborhood`, `minRent`, `maxRent`, `minBedrooms`, `maxBedrooms`, etc., `source`, `createdAt`

---

## Frontend Structure (client/src/)

### Pages
- `Home.tsx` → Landing page with hero, map view, matched apartments section
- `ApartmentSearch.tsx` → Advanced search interface with filter sidebar + results
- `ContactPage.tsx` → Contact form (InquiryForm)
- `Services.tsx`, `HoustonPage.tsx`, `HowItWorksPage.tsx` → Content pages
- `NeighborhoodPage.tsx` → Dynamic neighborhood detail pages (from slug)
- `MoveInSpecials.tsx` → Special offers page
- `FAQ.tsx` → Frequently asked questions

### Components
- `Map.tsx` → Google Maps integration with marker clustering + info windows
- `InquiryForm.tsx` → Lead capture form (used in Contact + map flow)
- `QualificationPrompt.tsx` → First-time qualification survey (modal/bottom sheet)
- `ApartmentCard.tsx` → Reusable apartment listing card with favorites button
- `FilterBar.tsx` → Search filters (neighborhood, rent, bedrooms, amenities)
- `MobileStickyBottomCTA.tsx` → Mobile action button (fixed bottom)
- `Breadcrumbs.tsx` → Navigation aid on all pages

### Contexts
- `QualificationContext.tsx` → User apartment preferences + localStorage persistence
- `ThemeContext.tsx` → Dark/light theme management

### Hooks
- `useAuth()` → Current user state, login/logout
- `useQualification()` → Access user preferences from context

### Shared Utilities
- `qualificationFilter.ts` → Filter apartments by user preferences
- `trpc.ts` → tRPC client configuration
- `const.ts` → Constants + OAuth URL builder

---

## Email System (server/email.ts)

The app sends HTML emails via `sendEmail({ to, subject, html })` helper.

### Email Types

**Nurture emails** - Sent to leads after submission (txaptfinder.com sequence):
- `renderNurtureEmail1(firstName, moveTimeline, budget?, neighborhoods?)` → Day 0 (immediate)
- `renderNurtureEmail2(firstName)` → Day 2 (template prepared, not yet scheduled)
- `renderNurtureEmail3(firstName, apartments?)` → Day 5 (template prepared, not yet scheduled)

**Operational emails**:
- `renderNewLeadEmail(name, email, phone, dashboardUrl)` → Sent to owner on new lead
- `renderMonthlyReportEmail(stats)` → Monthly analytics summary

**Setup Required:**
- `OWNER_EMAIL` environment variable must be set to receive notifications
- Email backend via `BUILT_IN_FORGE_API_URL` (Manus platform)

---

## Data Sources Integration

### RentCast API (server/rentcastDatabase.ts)
- Requires `RENTCAST_API_KEY` environment variable
- Fetches real estate listing data for Houston area
- Returns ~22 properties with real market data
- Used when available (checked first before local database)

### Property Database (server/propertyDatabase.ts)
- Falls back to imported apartments from data files
- Used when RentCast key not available but MySQL database populated
- Contains ~508 manually curated apartments

### Local SQLite (server/db.ts)
- Development default when no external data source available
- Stores lead records, user interactions, saved searches, favorites
- Schema defined inline in `initializeSchema()` function

---

## Apartment Data Privacy

**Critical Rule:** Exact addresses and landlord contact info are **never shown to public users**.

**Public view** (getTeased):
- `getDisplayName()` strips street address → shows neighborhood only
- Returns: `id`, `name`, `neighborhood`, `bedrooms`, `bathrooms`, `rentMin`, `rentMax`, `description`, `latitude`, `longitude`, `photos`

**Admin view** (getFull):
- Full details including `exactAddress`, `landlordName`, `landlordPhone`, `landlordEmail`
- Accessible only to users with `role: 'admin'`

**Inquiry form**:
- Uses public apartment name (stripped address)
- Submitted apartment info sent to owner + HubSpot

---

## Testing Strategy

### Test Files
- `server/*.test.ts` → Vitest suite files (one per major feature)
- `favorites.test.ts` → Favorites add/remove/list operations
- `qualification.test.ts` → Apartment filtering by user preferences
- `inquiries.test.ts` → Form validation + submission flow
- `rentcast.test.ts` → RentCast API integration

### Test Patterns

**Create test context** (if testing tRPC procedures):
```ts
const caller = appRouter.createCaller(ctx); // Creates callable router
const result = await caller.auth.logout();  // Call procedure as function
```

**Mock database** (for unit tests):
```ts
// Vitest automatically isolates tests; use vi.mock() for external APIs
vi.mock('./rentcast', () => ({ 
  fetchListings: vi.fn().mockResolvedValue([...])
}));
```

### Run Tests
```bash
pnpm test                    # Run all
pnpm test -- --reporter=verbose server/favorites.test.ts  # Single file
pnpm test -- -t "favorites" # Filter by name
```

---

## Important Implementation Details

### Rate Limiting (server/rateLimit.ts)
- `leads.submit` is rate-limited: **10 submissions per hour per IP**
- Uses in-memory cache + sliding window
- Returns `remaining` count to client

### Analytics Tracking (server/analytics.ts)
- `trackSearch()` → Logs each apartment search with filters
- `trackView()` → Logs each apartment detail view
- `getAnalyticsSummary()` → Returns aggregated metrics
- Used for monthly reporting + trending insights

### Qualification Filtering (client/lib/qualificationFilter.ts)
- Filters apartments by user preferences (areas, budget, bedrooms, pets, timeline)
- Returns "Strong Matches for You" on home page
- Stored in localStorage for persistence across sessions

### Authentication Context (server/_core/context.ts)
- Builds `ctx.user` from session cookie for each tRPC call
- User is `null` for public procedures
- `protectedProcedure` throws if `ctx.user` is missing
- `adminProcedure` throws if `ctx.user.role !== 'admin'`

### File Uploads (server/storage.ts)
- Not heavily used in this app
- Configured for S3-compatible storage via `storagePut(key, buffer, mimeType)`
- Images not stored locally (use signed URLs instead)

---

## Common Development Tasks

### Add a New Search Filter
1. Extend `apartments.list` input schema in `routers.ts` (add Zod field)
2. Pass filter to data source functions: `getApartmentsForLead()`, `getRentCastDatabaseApartments()`, `getPropertyDatabaseApartments()`
3. Implement filtering logic in each function
4. Update frontend `FilterBar` component to show new UI control
5. Track new filter in `trackSearch()` analytics call
6. Test with `pnpm test`

### Add a New Email Type
1. Create `renderXxxEmail()` function in `server/email.ts`
2. Call `sendEmail({ to, subject, html: renderXxxEmail(...) })` from procedure
3. Test email rendering manually (return HTML from procedure, inspect in browser)

### Modify Database Schema
1. Edit table definition in `drizzle/schema.ts` (MySQL) or `server/db.ts` (SQLite)
2. For MySQL: run `pnpm db:push` to generate + apply migration
3. For SQLite: schema auto-initializes on first `getDb()` call (dev only)
4. Update TypeScript types (`InsertXxx`, `Xxx`) after schema change

### Test a tRPC Procedure Locally
```ts
// In test file or console
const ctx = createTestContext(); // Mock user, req, res
const caller = appRouter.createCaller(ctx);
const result = await caller.apartments.list({ neighborhood: 'Midtown' });
console.log(result);
```

---

## Key Conventions

### Naming
- Table names: plural snake_case (e.g., `email_subscriptions`)
- Column names: camelCase (e.g., `minBedrooms`)
- Functions: camelCase (e.g., `getDisplayName()`)
- Component files: PascalCase (e.g., `InquiryForm.tsx`)

### Error Handling
- Procedures throw errors (tRPC auto-converts to client errors)
- Use descriptive messages: "Too many submissions..." (not "Error 429")
- Log errors server-side with context: `console.error('[Feature] message', error)`

### Environment Variables
- Read from `process.env` or `ENV` object (`server/_core/env.ts`)
- Never commit `.env` files
- Document all required vars in comments (see top of `routers.ts`)

### Apartment Data in URLs
- Some routes pass `apartmentId` as number (e.g., `/apartments/123`)
- Use `parseInt(id)` when parsing from URL string

### Qualification Persistence
- User preferences stored in localStorage + state context
- Cleared when user logs out (can add logout handler if needed)
- Used to filter initial apartment recommendations

---

## Common Pitfalls to Avoid

1. **Exposing exact addresses in public endpoints** → Always use `getDisplayName()` for apartment titles in public views
2. **Rate limit bypass** → Don't skip `checkRateLimit()` in lead submission
3. **Losing qualification state** → QualificationContext must persist to localStorage + restore on mount
4. **Mixing data sources** → Check which source is active before calling (RentCast > Property DB > SQLite)
5. **Missing admin check** → Use `adminProcedure` for owner-only features, not just runtime checks
6. **Orphaned favorites** → If apartment is deleted, clean up related favorites + analytics

---

## Helpful File References

| File | Purpose |
|------|---------|
| `server/routers.ts` | All endpoint definitions + schemas |
| `server/db.ts` | SQLite query helpers + schema |
| `drizzle/schema.ts` | MySQL table definitions (production) |
| `server/email.ts` | Email templates + sending logic |
| `client/src/App.tsx` | Route setup + provider hierarchy |
| `client/src/lib/qualificationFilter.ts` | Apartment filtering algorithm |
| `server/analytics.ts` | Event tracking + aggregation |
| `server/_core/context.ts` | Auth context builder |
| `.project-config.json` | Project metadata (not typically edited) |
| `todo.md` | Feature roadmap + completed items |

---

## Debugging Tips

**Check what data source is active:**
```bash
# Call health endpoint
curl http://localhost:5000/api/trpc/health
# Returns: { rentcast: true/false, propertyDb: true/false, localDb: true/false }
```

**Trace lead submission flow:**
1. Check `leads` table for new record: `SELECT * FROM leads ORDER BY createdAt DESC LIMIT 1;`
2. Check `lead_interactions` for apartment views: `SELECT * FROM lead_interactions WHERE leadId = ?;`
3. Check email logs (if available): Look for `sendEmail` calls in console output

**Test qualification filtering:**
```ts
import { filterApartments } from './lib/qualificationFilter';
const filtered = filterApartments(apartments, userPreferences);
console.log(filtered.length); // Should be <= original list
```

---

## Next Steps for New Developers

1. Read `todo.md` for project context + completed features
2. Run `pnpm dev` and explore the UI (Home → Search → Contact)
3. Check `server/routers.ts` to see all available endpoints
4. Pick a small feature bug from recent commits and trace the code path
5. Run tests: `pnpm test` to see test patterns
