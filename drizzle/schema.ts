import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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