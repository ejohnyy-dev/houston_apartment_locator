import { decimal, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Favorites table to store user-bookmarked apartments
export const favorites = mysqlTable("favorites", {
  id: int("id").autoincrement().primaryKey(),
  apartmentId: varchar("apartmentId", { length: 255 }).notNull(),
  apartmentName: varchar("apartmentName", { length: 255 }).notNull(),
  neighborhood: varchar("neighborhood", { length: 255 }),
  rentMin: int("rentMin"),
  rentMax: int("rentMax"),
  bedrooms: int("bedrooms"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Favorite = typeof favorites.$inferSelect;
export type InsertFavorite = typeof favorites.$inferInsert;

// Inquiries table to store lead submissions
export const inquiries = mysqlTable("inquiries", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  apartmentId: varchar("apartmentId", { length: 255 }).notNull(),
  apartmentName: varchar("apartmentName", { length: 255 }).notNull(),
  moveInDate: varchar("moveInDate", { length: 100 }),
  message: text("message"),
  favoriteIds: text("favoriteIds"), // JSON array of favorite apartment IDs
  qualificationData: text("qualificationData"), // JSON object with qualification preferences
  source: varchar("source", { length: 100 }).default("website"),
  // Lead nurturing automation fields
  nurtureStage: mysqlEnum("nurtureStage", ["pending", "sent", "skipped", "failed"]).default("pending"),
  nurtureSentAt: timestamp("nurtureSentAt"),
  nurtureScheduledFor: timestamp("nurtureScheduledFor"), // when the follow-up should be sent (createdAt + 24h)
  nurtureError: text("nurtureError"), // error message if nurture failed
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Inquiry = typeof inquiries.$inferSelect;
export type InsertInquiry = typeof inquiries.$inferInsert;

// Qualifications table to store user preferences for apartment matching
export const qualifications = mysqlTable("qualifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: varchar("userId", { length: 255 }).notNull(),
  preferredAreas: text("preferredAreas"),
  moveInTimeline: varchar("moveInTimeline", { length: 50 }),
  minBedrooms: int("minBedrooms"),
  maxBedrooms: int("maxBedrooms"),
  minBathrooms: int("minBathrooms"),
  maxBathrooms: int("maxBathrooms"),
  minBudget: int("minBudget"),
  maxBudget: int("maxBudget"),
  pets: text("pets"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Qualification = typeof qualifications.$inferSelect;
export type InsertQualification = typeof qualifications.$inferInsert;

// Admin-managed apartment listings table
// These listings take priority over CSV data when propertyId matches.
// New listings (no CSV counterpart) are appended to search results.
export const listings = mysqlTable("listings", {
  id: int("id").autoincrement().primaryKey(),
  /** Optional: if set, this row overrides the CSV row with this propertyId */
  propertyId: varchar("propertyId", { length: 255 }),
  name: varchar("name", { length: 255 }).notNull(),
  // Address fields — streetAddress is the scraped/raw address, verifiedAddress is Google-confirmed
  address: varchar("address", { length: 500 }),
  streetAddress: varchar("streetAddress", { length: 500 }),
  verifiedAddress: varchar("verifiedAddress", { length: 500 }),
  addressMatchStatus: varchar("addressMatchStatus", { length: 50 }), // confirmed | mismatch | ZERO_RESULTS
  city: varchar("city", { length: 100 }).notNull().default("Houston"),
  state: varchar("state", { length: 10 }).notNull().default("TX"),
  neighborhood: varchar("neighborhood", { length: 100 }),
  // Coordinates — decimal(10,7) for ~1cm precision
  latitude: decimal("latitude", { precision: 10, scale: 7 }),
  longitude: decimal("longitude", { precision: 10, scale: 7 }),
  // Rent fields — generic min/max plus per-bedroom splits
  minRent: int("minRent").notNull(),
  maxRent: int("maxRent"),
  price1brMin: int("price1brMin"),
  price1brMax: int("price1brMax"),
  price2brMin: int("price2brMin"),
  price2brMax: int("price2brMax"),
  bedrooms: int("bedrooms"),
  bathrooms: int("bathrooms"),
  minSqft: int("minSqft"),
  maxSqft: int("maxSqft"),
  builtYear: int("builtYear"),
  availability: varchar("availability", { length: 255 }),
  primaryImageUrl: text("primaryImageUrl"),
  imageUrls: text("imageUrls"),       // JSON array of image URLs
  special: text("special"),
  featureHighlights: text("featureHighlights"),
  exteriorAmenities: text("exteriorAmenities"),
  interiorAmenities: text("interiorAmenities"),
  petPolicy: text("petPolicy"),
  managedBy: varchar("managedBy", { length: 255 }),
  // Contact info per property
  phone: varchar("phone", { length: 30 }),
  email: varchar("email", { length: 320 }),
  // Website URLs
  website: varchar("website", { length: 500 }),
  actualWebsite: varchar("actualWebsite", { length: 500 }),
  // Scraping metadata
  lastScraped: timestamp("lastScraped"),
  isActive: int("isActive").default(1).notNull(), // 1 = active, 0 = hidden
  sortOrder: int("sortOrder").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Listing = typeof listings.$inferSelect;
export type InsertListing = typeof listings.$inferInsert;

// RentCast cron configuration — stores the Heartbeat task_uid and last refresh stats
// Only ever has one row (id=1). Use upsert to update.
export const rentcastCronConfig = mysqlTable("rentcast_cron_config", {
  id: int("id").autoincrement().primaryKey(),
  /** Heartbeat task UID — used to update/delete the cron job */
  scheduleCronTaskUid: varchar("scheduleCronTaskUid", { length: 65 }),
  cronExpression: varchar("cronExpression", { length: 64 }),
  isEnabled: int("isEnabled").default(1).notNull(),
  lastRefreshAt: timestamp("lastRefreshAt"),
  lastRefreshStatus: varchar("lastRefreshStatus", { length: 32 }),
  /** JSON blob: { totalProperties, rentcastMatches, requestsUsed, requestsRemaining, duration } */
  lastRefreshStats: text("lastRefreshStats"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type RentcastCronConfig = typeof rentcastCronConfig.$inferSelect;
export type InsertRentcastCronConfig = typeof rentcastCronConfig.$inferInsert;