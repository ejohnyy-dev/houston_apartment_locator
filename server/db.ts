import { eq, and, lte, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, inquiries, InsertInquiry, Inquiry, listings, InsertListing, Listing } from "../drizzle/schema";
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
