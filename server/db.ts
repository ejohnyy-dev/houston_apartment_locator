import { eq, and, lte, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, inquiries, InsertInquiry, Inquiry, listings, InsertListing, Listing, qualifiedSessions, InsertQualifiedSession, QualifiedSession, savedSearches, SavedSearch } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createInquiry(inquiry: InsertInquiry): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot create inquiry: database not available");
    return;
  }

  try {
    await db.insert(inquiries).values(inquiry);
    console.log("[Database] Inquiry created successfully");
  } catch (error) {
    console.error("[Database] Failed to create inquiry:", error);
    throw error;
  }
}

/**
 * Get all inquiries that are due for nurture follow-up:
 * - nurtureStage = 'pending'
 * - nurtureScheduledFor <= now
 */
export async function getInquiriesDueForNurture(): Promise<Inquiry[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot query nurture leads: database not available");
    return [];
  }

  const now = new Date();
  const result = await db
    .select()
    .from(inquiries)
    .where(
      and(
        eq(inquiries.nurtureStage, "pending"),
        lte(inquiries.nurtureScheduledFor, now)
      )
    )
    .limit(50); // process in batches to stay within 2-min handler timeout

  return result;
}

/**
 * Mark an inquiry nurture as sent.
 */
export async function markNurtureSent(inquiryId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .update(inquiries)
    .set({
      nurtureStage: "sent",
      nurtureSentAt: new Date(),
    })
    .where(eq(inquiries.id, inquiryId));
}

/**
 * Mark an inquiry nurture as failed with an error message.
 */
export async function markNurtureFailed(inquiryId: number, error: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .update(inquiries)
    .set({
      nurtureStage: "failed",
      nurtureError: error,
    })
    .where(eq(inquiries.id, inquiryId));
}

/**
 * Mark an inquiry nurture as skipped (e.g. HubSpot not configured).
 */
export async function markNurtureSkipped(inquiryId: number, reason: string): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .update(inquiries)
    .set({
      nurtureStage: "skipped",
      nurtureError: reason,
    })
    .where(eq(inquiries.id, inquiryId));
}

/**
 * Get recent inquiries with their nurture status (for admin view).
 */
export async function getInquiriesWithNurtureStatus(limit = 50): Promise<Inquiry[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(inquiries)
    .orderBy(inquiries.createdAt)
    .limit(limit);
}

// ─── Listings CRUD helpers ────────────────────────────────────────────────────

/**
 * Get all admin-managed listings, ordered by sortOrder then createdAt.
 */
export async function getAllListings(): Promise<Listing[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(listings).orderBy(listings.sortOrder, listings.createdAt);
}

/**
 * Get only active listings (isActive = 1).
 */
export async function getActiveListings(): Promise<Listing[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(listings).where(eq(listings.isActive, 1)).orderBy(listings.sortOrder, listings.createdAt);
}

/**
 * Get a single listing by its database id.
 */
export async function getListingById(id: number): Promise<Listing | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(listings).where(eq(listings.id, id)).limit(1);
  return rows[0] ?? null;
}

/**
 * Create a new admin listing.
 */
export async function createListing(data: Omit<InsertListing, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  const result = await db.insert(listings).values(data);
  return (result[0] as { insertId: number }).insertId;
}

/**
 * Update an existing listing by id.
 */
export async function updateListing(id: number, data: Partial<Omit<InsertListing, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.update(listings).set(data).where(eq(listings.id, id));
}

/**
 * Delete a listing by id.
 */
export async function deleteListing(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.delete(listings).where(eq(listings.id, id));
}

/**
 * Toggle a listing's active status.
 */
export async function toggleListingActive(id: number, isActive: boolean): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.update(listings).set({ isActive: isActive ? 1 : 0 }).where(eq(listings.id, id));
}

// ─── Qualified Sessions ───────────────────────────────────────────────────────

/**
 * Create a new qualified session row. Returns the inserted row.
 */
export async function createQualifiedSession(
  data: Pick<InsertQualifiedSession, 'sessionToken' | 'email' | 'qualificationData' | 'expiresAt'>
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error('Database not available');
  await db.insert(qualifiedSessions).values(data);
}

/**
 * Look up a qualified session by its cookie token.
 * Returns null if not found or expired.
 */
export async function getQualifiedSessionByToken(
  token: string
): Promise<QualifiedSession | null> {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(qualifiedSessions)
    .where(eq(qualifiedSessions.sessionToken, token))
    .limit(1);
  const row = rows[0] ?? null;
  if (!row) return null;
  // Treat expired sessions as non-existent
  if (row.expiresAt < new Date()) return null;
  return row;
}

/**
 * Look up the most recent non-expired qualified session by email.
 * Used to re-qualify visitors on a new device.
 */
export async function getQualifiedSessionByEmail(
  email: string
): Promise<QualifiedSession | null> {
  const db = await getDb();
  if (!db) return null;
  const now = new Date();
  const rows = await db
    .select()
    .from(qualifiedSessions)
    .where(and(
      eq(qualifiedSessions.email, email.toLowerCase().trim()),
    ))
    .limit(10);
  // Filter expired in JS (MySQL timestamp comparison is fine, but this is safer)
  const valid = rows.filter(r => r.expiresAt > now);
  if (valid.length === 0) return null;
  // Return the most recently created
  return valid.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
}

// ── Saved searches (email alerts for new matching listings) ──

/**
 * Save a search for a lead. seenListingIds should be seeded with the ids
 * currently matching, so only listings added later trigger an alert.
 */
export async function createSavedSearch(data: {
  email: string;
  filters: string;
  seenListingIds: string;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(savedSearches).values({
    email: data.email.toLowerCase().trim(),
    filters: data.filters,
    seenListingIds: data.seenListingIds,
  });
  return (result as any)[0]?.insertId ?? 0;
}

export async function getActiveSavedSearches(): Promise<SavedSearch[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(savedSearches).where(eq(savedSearches.isActive, 1));
}

export async function getSavedSearchesByEmail(email: string): Promise<SavedSearch[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(savedSearches)
    .where(and(
      eq(savedSearches.email, email.toLowerCase().trim()),
      eq(savedSearches.isActive, 1),
    ));
}

/** Record a check run; pass alerted=true when new matches were signaled. */
export async function updateSavedSearchSeen(
  id: number,
  seenListingIds: string,
  alerted: boolean
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const now = new Date();
  await db
    .update(savedSearches)
    .set({
      seenListingIds,
      lastCheckedAt: now,
      ...(alerted ? { lastAlertAt: now } : {}),
    })
    .where(eq(savedSearches.id, id));
}

/** Deactivate a saved search, verifying it belongs to the given email. */
export async function deactivateSavedSearch(id: number, email: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const rows = await db
    .select()
    .from(savedSearches)
    .where(eq(savedSearches.id, id))
    .limit(1);
  const row = rows[0];
  if (!row || row.email !== email.toLowerCase().trim()) return false;
  await db.update(savedSearches).set({ isActive: 0 }).where(eq(savedSearches.id, id));
  return true;
}
