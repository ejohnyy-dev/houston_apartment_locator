# Houston Apartment Locator - TODO

## Completed Features
- [x] Multi-page site structure (Home, Services, Houston, How It Works, Contact)
- [x] Interactive Google Maps with 530 apartment markers
- [x] Property database integration (22 RentCast API + 508 local properties)
- [x] Breadcrumb navigation on all pages
- [x] JSON-LD schema markup for SEO
- [x] Removed contact info from Navbar
- [x] Removed redundant buttons from hero section
- [x] Commission filtering - hide commission data from visitors (verified with tests)
- [x] Fixed TypeScript compilation errors
- [x] Inquire Now button in map marker popups (UI added with event dispatch)
- [x] Search/filter bar for the map (with search text, bedrooms, and rent filters)
- [x] Marker clustering for improved performance (CDN-based with fallback)
- [x] Empty state handling when filters return no results
- [x] Error state handling when map fails to load
- [x] Lead capture form for apartment inquiries (InquiryForm component)
- [x] Inquiry endpoint with owner notification (inquiries.create tRPC mutation)
- [x] Inquiry form validation tests (4 test cases for schema validation)
- [x] Address privacy fix: Strip street addresses from map marker inquiry flow (getDisplayName applied in HomeMapView)

## Completed Features (All Done!)
All planned features have been successfully implemented and tested. The application now provides:

- Comprehensive apartment search with 530+ listings
- Real-time map filtering by name, neighborhood, bedrooms, and rent
- Marker clustering for performance optimization
- Lead capture form with validation
- Owner notifications for new inquiries
- Graceful error and empty state handling
- Full test coverage for critical functionality

## Next Steps (Optional Enhancements)
- Add analytics tracking for user interactions
- Implement email notifications to leads
- Add apartment details page with full information
- Implement user authentication for saved favorites
- Add review/rating system for apartments

## Completed Features (Continued)
- [x] Favorites feature: Database schema to store favorites with inquiries
- [x] Favorites feature: Client-side state management with localStorage persistence
- [x] Favorites feature: UI indicators on apartment cards with heart button (add/remove favorites)
- [x] Favorites feature: Favorites list display in inquiry form ("Your Saved Apartments" section)
- [x] Favorites feature: Include favorites in inquiry submission (favoriteIds JSON array)
- [x] Favorites feature: Favorites sent to Google Sheets and HubSpot integrations
- [x] Favorites feature: Favorites included in owner notifications
- [x] Favorites feature: Favorites passed from both Home and ApartmentSearch pages
- [x] Favorites feature: Unit tests for favorites functionality (12 tests passing)
- [x] Favorites feature: Integration tests for inquiry submission (4 tests passing)

## Security Audit - Address Privacy
- [x] Audit: Identified address exposure in HomeMapView marker popup (line 197)
- [x] Fix: Applied getDisplayName() to HomeMapView marker title display
- [x] Audit: Identified address exposure in ApartmentSearch favorites (line 598)
- [x] Fix: Applied getDisplayName() to favorites apartment name storage
- [x] Verified: ApartmentSearch apartment cards show only neighborhood (not address)
- [x] Verified: Apartment details modal uses getDisplayName() for title
- [x] Verified: InquiryForm header uses getDisplayName() for title
- [x] Verified: localStorage favorites store only stripped names, not full addresses
- [x] Verified: Server responses only send apartment object with stripped names
- [x] All tests passing (16/16) with no regressions


## Staged Qualification Flow (Complete)
- [x] Database schema: Add qualifications table to store user preferences
- [x] QualificationPrompt component: Create form with areas, timeline, bedrooms, bathrooms, budget, pets
- [x] Qualification trigger: Implement on first marker click in HomeMapView
- [x] QualificationContext: State management with localStorage persistence
- [x] QualificationProvider: Integrated into App.tsx for global access
- [x] Apartment filtering: Filter listings based on qualification preferences (qualificationFilter.ts)
- [x] Bottom sheet UI: Mobile-optimized qualification flow with BottomSheet component
- [x] Matched apartments display: "Strong Matches for You" section on Home page
- [x] Pass qualification to inquiry: Include qualification context in inquiry submission
- [x] Qualification tests: Comprehensive unit tests for filtering and matching (qualification.test.ts)

## Lead Nurture Automation (Complete)
- [x] Database schema: Add nurtureStage, nurtureSentAt, nurtureScheduledFor, nurtureError columns to inquiries table
- [x] Migration: Applied ALTER TABLE migration via webdev_execute_sql
- [x] HubSpot helper: Created server/hubspot.ts with upsertHubSpotContact, sendNurtureFollowup, getHubSpotContact
- [x] DB helpers: Added getInquiriesDueForNurture, markNurtureSent, markNurtureFailed, markNurtureSkipped, getInquiriesWithNurtureStatus
- [x] Inquiry creation: Updated createInquiry call to set nurtureScheduledFor = createdAt + 24h
- [x] Scheduled handler: Created server/scheduled/nurtureFollowup.ts with cron auth guard and batch processing
- [x] Server registration: Registered /api/scheduled/nurture-followup endpoint in server/_core/index.ts
- [x] Nurture router: Created server/routers/nurture.ts with admin-only status, triggerForLead, cronStatus, setupCron, deleteCron, dueCount
- [x] Admin UI: Created /admin/nurture page with stats, cron management, lead table, manual trigger
- [x] Route: Registered /admin/nurture in App.tsx
- [x] Tests: 13 nurture tests passing (HubSpot helpers, scheduling logic, auth guard, stage transitions)
- [x] Security: Rate limiting on /api/leads endpoint (5/hr per email, 20/hr per IP)

## Admin Listings Interface
- [x] Database schema: Add listings table for admin-managed apartments
- [x] Migration: Apply listings table migration via webdev_execute_sql
- [x] DB helpers: Add CRUD helpers for listings in db.ts
- [x] tRPC router: Create listings router with list, create, update, delete procedures (admin-only)
- [x] Merge logic: SQL listings served via activeList endpoint, merged at query time
- [x] Admin UI: Create /admin/listings page with table view, add/edit form, delete confirmation
- [x] Image upload: Wire up S3 photo upload for apartment images
- [x] Route: Register /admin/listings in App.tsx
- [x] Tests: Write unit tests for listings CRUD operations (11 tests, all passing)

## CSV Merge & Schema Upgrade
- [x] Python merge script: join 489 matched rows + 20 current-only + 39 uploaded-only into unified CSV
- [x] Merged CSV: parse Price 1BR/2BR into numeric min/max fields
- [x] Merged CSV: include lat/lon, phone, email, verified_address, address_match_status
- [x] Schema: add phone, email, streetAddress, verifiedAddress, price1brMin/Max, price2brMin/Max, addressMatchStatus, lastScraped, website, actualWebsite to listings table
- [x] Schema: change latitude/longitude from text to decimal(10,7)
- [x] Migration: generate and apply via webdev_execute_sql
- [x] propertyDatabase.ts: update parser to map new merged CSV columns
- [x] Swap data source to all-properties-merged.csv
- [x] Verify search page shows 541 listings with correct prices and map markers (72 tests passing)
