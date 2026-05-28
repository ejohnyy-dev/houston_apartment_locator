import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs/promises';

const DATABASE_PATH = process.env.DATABASE_URL || path.join(process.cwd(), 'server', 'data', 'apartments.db');

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    const dir = path.dirname(DATABASE_PATH);
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (e) {
      // Directory might already exist
    }
    db = new Database(DATABASE_PATH);
    db.pragma('journal_mode = WAL');
    initializeSchema();
  }
  return db;
}

function initializeSchema() {
  const database = getDb();

  // Apartments table
  database.exec(`
    CREATE TABLE IF NOT EXISTS apartments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      neighborhood TEXT NOT NULL,
      bedrooms INTEGER,
      bathrooms REAL,
      rentMin INTEGER,
      rentMax INTEGER,
      description TEXT,
      latitude REAL,
      longitude REAL,
      photos TEXT,
      exactAddress TEXT,
      landlordName TEXT,
      landlordPhone TEXT,
      landlordEmail TEXT,
      unitsAvailable INTEGER,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Amenities table
  database.exec(`
    CREATE TABLE IF NOT EXISTS amenities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      icon TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Apartment-Amenity junction table
  database.exec(`
    CREATE TABLE IF NOT EXISTS apartment_amenities (
      apartmentId INTEGER,
      amenityId INTEGER,
      PRIMARY KEY (apartmentId, amenityId),
      FOREIGN KEY (apartmentId) REFERENCES apartments(id),
      FOREIGN KEY (amenityId) REFERENCES amenities(id)
    );
  `);

  // Leads table
  database.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      status TEXT DEFAULT 'new',
      notes TEXT,
      submittedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      lastContactedAt DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Lead interactions table
  database.exec(`
    CREATE TABLE IF NOT EXISTS lead_interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      leadId INTEGER NOT NULL,
      apartmentId INTEGER NOT NULL,
      interactionType TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (leadId) REFERENCES leads(id),
      FOREIGN KEY (apartmentId) REFERENCES apartments(id)
    );
  `);

  // Saved searches table (NEW FEATURE)
  database.exec(`
    CREATE TABLE IF NOT EXISTS saved_searches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      leadId INTEGER NOT NULL,
      name TEXT NOT NULL,
      neighborhood TEXT,
      minRent INTEGER,
      maxRent INTEGER,
      minBedrooms INTEGER,
      maxBedrooms INTEGER,
      amenityIds TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (leadId) REFERENCES leads(id)
    );
  `);

  // Favorites table (NEW FEATURE)
  database.exec(`
    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      leadId INTEGER NOT NULL,
      apartmentId INTEGER NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(leadId, apartmentId),
      FOREIGN KEY (leadId) REFERENCES leads(id),
      FOREIGN KEY (apartmentId) REFERENCES apartments(id)
    );
  `);

  // Email subscriptions table (NEW FEATURE)
  database.exec(`
    CREATE TABLE IF NOT EXISTS email_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      leadId INTEGER NOT NULL,
      savedSearchId INTEGER,
      emailAddress TEXT NOT NULL,
      isActive BOOLEAN DEFAULT 1,
      frequency TEXT DEFAULT 'weekly',
      lastEmailSentAt DATETIME,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (leadId) REFERENCES leads(id),
      FOREIGN KEY (savedSearchId) REFERENCES saved_searches(id)
    );
  `);

  // Create indices for performance
  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
    CREATE INDEX IF NOT EXISTS idx_apartments_neighborhood ON apartments(neighborhood);
    CREATE INDEX IF NOT EXISTS idx_lead_interactions_leadId ON lead_interactions(leadId);
    CREATE INDEX IF NOT EXISTS idx_saved_searches_leadId ON saved_searches(leadId);
    CREATE INDEX IF NOT EXISTS idx_favorites_leadId ON favorites(leadId);
    CREATE INDEX IF NOT EXISTS idx_email_subscriptions_leadId ON email_subscriptions(leadId);
  `);
}

// ============= APARTMENTS =============

export interface Apartment {
  id: number;
  name: string;
  neighborhood: string;
  bedrooms?: number;
  bathrooms?: number;
  rentMin: number;
  rentMax?: number;
  description?: string;
  latitude?: number;
  longitude?: number;
  photos?: string[];
  exactAddress?: string;
  landlordName?: string;
  landlordPhone?: string;
  landlordEmail?: string;
  unitsAvailable?: number;
}

export async function getApartmentFull(id: number): Promise<Apartment | null> {
  const database = getDb();
  const stmt = database.prepare('SELECT * FROM apartments WHERE id = ?');
  const row = stmt.get(id) as any;

  if (!row) return null;

  return {
    ...row,
    photos: row.photos ? JSON.parse(row.photos) : [],
  };
}

export async function getApartmentWithAmenities(id: number): Promise<any> {
  const database = getDb();
  const apt = await getApartmentFull(id);

  if (!apt) return null;

  const stmt = database.prepare(`
    SELECT a.* FROM amenities a
    JOIN apartment_amenities aa ON a.id = aa.amenityId
    WHERE aa.apartmentId = ?
  `);

  const amenities = stmt.all(id);

  return {
    ...apt,
    amenities,
  };
}

export async function getApartmentsForLead(filters?: any): Promise<Apartment[]> {
  const database = getDb();
  let query = 'SELECT * FROM apartments WHERE 1=1';
  const params: any[] = [];

  if (filters?.neighborhood) {
    query += ' AND neighborhood = ?';
    params.push(filters.neighborhood);
  }

  if (filters?.minRent !== undefined) {
    query += ' AND rentMin >= ?';
    params.push(filters.minRent);
  }

  if (filters?.maxRent !== undefined) {
    query += ' AND rentMax <= ?';
    params.push(filters.maxRent);
  }

  if (filters?.minBedrooms !== undefined) {
    query += ' AND bedrooms >= ?';
    params.push(filters.minBedrooms);
  }

  if (filters?.maxBedrooms !== undefined) {
    query += ' AND bedrooms <= ?';
    params.push(filters.maxBedrooms);
  }

  const stmt = database.prepare(query);
  const rows = stmt.all(...params) as any[];

  return rows.map(row => ({
    ...row,
    photos: row.photos ? JSON.parse(row.photos) : [],
  }));
}

export async function createApartment(data: Apartment): Promise<any> {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT INTO apartments (name, neighborhood, bedrooms, bathrooms, rentMin, rentMax, description, latitude, longitude, photos, exactAddress, landlordName, landlordPhone, landlordEmail, unitsAvailable)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    data.name,
    data.neighborhood,
    data.bedrooms,
    data.bathrooms,
    data.rentMin,
    data.rentMax,
    data.description,
    data.latitude,
    data.longitude,
    data.photos ? JSON.stringify(data.photos) : '[]',
    data.exactAddress,
    data.landlordName,
    data.landlordPhone,
    data.landlordEmail,
    data.unitsAvailable
  );

  return info;
}

// ============= LEADS =============

export interface Lead {
  id: number;
  name: string;
  email: string;
  phone: string;
  status: string;
  notes?: string;
  submittedAt: Date;
  lastContactedAt?: Date;
}

export async function createLead(data: { name: string; email: string; phone: string }): Promise<any> {
  const database = getDb();
  const stmt = database.prepare('INSERT INTO leads (name, email, phone) VALUES (?, ?, ?)');
  const info = stmt.run(data.name, data.email, data.phone);
  return info;
}

export async function getLeadById(id: number): Promise<Lead | null> {
  const database = getDb();
  const stmt = database.prepare('SELECT * FROM leads WHERE id = ?');
  return stmt.get(id) as Lead | null;
}

export async function getAllLeads(filters?: any): Promise<Lead[]> {
  const database = getDb();
  let query = 'SELECT * FROM leads WHERE 1=1';
  const params: any[] = [];

  if (filters?.status) {
    query += ' AND status = ?';
    params.push(filters.status);
  }

  if (filters?.searchTerm) {
    query += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)';
    const term = `%${filters.searchTerm}%`;
    params.push(term, term, term);
  }

  query += ' ORDER BY submittedAt DESC';
  const stmt = database.prepare(query);
  return stmt.all(...params) as Lead[];
}

export async function updateLead(id: number, data: { status?: string; notes?: string; lastContactedAt?: Date }): Promise<void> {
  const database = getDb();
  const updates: string[] = [];
  const params: any[] = [];

  if (data.status !== undefined) {
    updates.push('status = ?');
    params.push(data.status);
  }

  if (data.notes !== undefined) {
    updates.push('notes = ?');
    params.push(data.notes);
  }

  if (data.lastContactedAt !== undefined) {
    updates.push('lastContactedAt = ?');
    params.push(data.lastContactedAt);
  }

  if (updates.length === 0) return;

  updates.push('updatedAt = CURRENT_TIMESTAMP');
  params.push(id);

  const query = `UPDATE leads SET ${updates.join(', ')} WHERE id = ?`;
  const stmt = database.prepare(query);
  stmt.run(...params);
}

export async function recordLeadInteraction(leadId: number, apartmentId: number, interactionType: string): Promise<void> {
  const database = getDb();
  const stmt = database.prepare('INSERT INTO lead_interactions (leadId, apartmentId, interactionType) VALUES (?, ?, ?)');
  stmt.run(leadId, apartmentId, interactionType);
}

// ============= AMENITIES =============

export interface Amenity {
  id: number;
  name: string;
  icon?: string;
}

export async function getAllAmenities(): Promise<Amenity[]> {
  const database = getDb();
  const stmt = database.prepare('SELECT * FROM amenities ORDER BY name');
  return stmt.all() as Amenity[];
}

export async function createAmenity(data: { name: string; icon?: string }): Promise<any> {
  const database = getDb();
  const stmt = database.prepare('INSERT INTO amenities (name, icon) VALUES (?, ?)');
  return stmt.run(data.name, data.icon || null);
}

// ============= SAVED SEARCHES (NEW FEATURE) =============

export interface SavedSearch {
  id: number;
  leadId: number;
  name: string;
  neighborhood?: string;
  minRent?: number;
  maxRent?: number;
  minBedrooms?: number;
  maxBedrooms?: number;
  minBathrooms?: number;
  maxBathrooms?: number;
  hasSpecial?: boolean;
  minSqft?: number;
  maxSqft?: number;
  amenityIds?: number[];
  createdAt: Date;
}

export async function createSavedSearch(data: {
  leadId: number;
  name: string;
  neighborhood?: string;
  minRent?: number;
  maxRent?: number;
  minBedrooms?: number;
  maxBedrooms?: number;
  minBathrooms?: number;
  maxBathrooms?: number;
  hasSpecial?: boolean;
  minSqft?: number;
  maxSqft?: number;
  amenityIds?: number[];
}): Promise<any> {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT INTO saved_searches (
      leadId, name, neighborhood, minRent, maxRent, minBedrooms, maxBedrooms,
      minBathrooms, maxBathrooms, hasSpecial, minSqft, maxSqft, amenityIds
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  return stmt.run(
    data.leadId,
    data.name,
    data.neighborhood,
    data.minRent,
    data.maxRent,
    data.minBedrooms,
    data.maxBedrooms,
    data.minBathrooms,
    data.maxBathrooms,
    data.hasSpecial ? 1 : 0,
    data.minSqft,
    data.maxSqft,
    data.amenityIds ? JSON.stringify(data.amenityIds) : '[]'
  );
}

export async function getSavedSearchesByLead(leadId: number): Promise<SavedSearch[]> {
  const database = getDb();
  const stmt = database.prepare('SELECT * FROM saved_searches WHERE leadId = ? ORDER BY createdAt DESC');
  const rows = stmt.all(leadId) as any[];

  return rows.map(row => ({
    ...row,
    amenityIds: row.amenityIds ? JSON.parse(row.amenityIds) : [],
    hasSpecial: !!row.hasSpecial,
  }));
}

export async function deleteSavedSearch(id: number): Promise<void> {
  const database = getDb();
  const stmt = database.prepare('DELETE FROM saved_searches WHERE id = ?');
  stmt.run(id);
}

// ============= FAVORITES (NEW FEATURE) =============

export async function addFavorite(leadId: number, apartmentId: number): Promise<any> {
  const database = getDb();
  const stmt = database.prepare('INSERT INTO favorites (leadId, apartmentId) VALUES (?, ?)');
  return stmt.run(leadId, apartmentId);
}

export async function removeFavorite(leadId: number, apartmentId: number): Promise<void> {
  const database = getDb();
  const stmt = database.prepare('DELETE FROM favorites WHERE leadId = ? AND apartmentId = ?');
  stmt.run(leadId, apartmentId);
}

export async function getFavoritesByLead(leadId: number): Promise<Apartment[]> {
  const database = getDb();
  const stmt = database.prepare(`
    SELECT a.* FROM apartments a
    JOIN favorites f ON a.id = f.apartmentId
    WHERE f.leadId = ?
    ORDER BY f.createdAt DESC
  `);

  const rows = stmt.all(leadId) as any[];
  return rows.map(row => ({
    ...row,
    photos: row.photos ? JSON.parse(row.photos) : [],
  }));
}

export async function isFavorited(leadId: number, apartmentId: number): Promise<boolean> {
  const database = getDb();
  const stmt = database.prepare('SELECT 1 FROM favorites WHERE leadId = ? AND apartmentId = ?');
  return stmt.get(leadId, apartmentId) !== undefined;
}

// ============= EMAIL SUBSCRIPTIONS (NEW FEATURE) =============

export interface EmailSubscription {
  id: number;
  leadId: number;
  savedSearchId?: number;
  emailAddress: string;
  isActive: boolean;
  frequency: string;
  lastEmailSentAt?: Date;
}

export async function createEmailSubscription(data: {
  leadId: number;
  savedSearchId?: number;
  emailAddress: string;
  frequency?: string;
}): Promise<any> {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT INTO email_subscriptions (leadId, savedSearchId, emailAddress, frequency)
    VALUES (?, ?, ?, ?)
  `);

  return stmt.run(
    data.leadId,
    data.savedSearchId || null,
    data.emailAddress,
    data.frequency || 'weekly'
  );
}

export async function getActiveEmailSubscriptions(): Promise<EmailSubscription[]> {
  const database = getDb();
  const stmt = database.prepare('SELECT * FROM email_subscriptions WHERE isActive = 1');
  return stmt.all() as EmailSubscription[];
}

export async function getEmailSubscriptionsByLead(leadId: number): Promise<EmailSubscription[]> {
  const database = getDb();
  const stmt = database.prepare('SELECT * FROM email_subscriptions WHERE leadId = ? AND isActive = 1');
  return stmt.all(leadId) as EmailSubscription[];
}

export async function updateEmailSubscription(id: number, data: { isActive?: boolean; lastEmailSentAt?: Date }): Promise<void> {
  const database = getDb();
  const updates: string[] = [];
  const params: any[] = [];

  if (data.isActive !== undefined) {
    updates.push('isActive = ?');
    params.push(data.isActive ? 1 : 0);
  }

  if (data.lastEmailSentAt !== undefined) {
    updates.push('lastEmailSentAt = ?');
    params.push(data.lastEmailSentAt);
  }

  if (updates.length === 0) return;

  updates.push('updatedAt = CURRENT_TIMESTAMP');
  params.push(id);

  const query = `UPDATE email_subscriptions SET ${updates.join(', ')} WHERE id = ?`;
  const stmt = database.prepare(query);
  stmt.run(...params);
}

export async function deleteEmailSubscription(id: number): Promise<void> {
  const database = getDb();
  const stmt = database.prepare('DELETE FROM email_subscriptions WHERE id = ?');
  stmt.run(id);
}
