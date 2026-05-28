import fs from "fs/promises";
import path from "path";

const ANALYTICS_FILE =
  process.env.ANALYTICS_FILE ||
  path.join(process.cwd(), "server", "data", "analytics.json");

export interface SearchEvent {
  timestamp: string;
  neighborhood?: string;
  minRent?: number;
  maxRent?: number;
  minBedrooms?: number;
  maxBedrooms?: number;
  // New filter fields for better analytics
  minBathrooms?: number;
  maxBathrooms?: number;
  hasSpecial?: boolean;
  minSqft?: number;
  maxSqft?: number;
  source?: "search" | "map" | "widget" | "direct";
}

export interface ViewEvent {
  timestamp: string;
  apartmentId: number;
  apartmentName: string;
  source?: "search" | "map" | "widget" | "direct";
}

export interface Analytics {
  searches: SearchEvent[];
  views: ViewEvent[];
}

async function readAnalytics(): Promise<Analytics> {
  try {
    const data = await fs.readFile(ANALYTICS_FILE, "utf8");
    return JSON.parse(data);
  } catch {
    return { searches: [], views: [] };
  }
}

async function writeAnalytics(data: Analytics): Promise<void> {
  const dir = path.dirname(ANALYTICS_FILE);
  await fs.mkdir(dir, { recursive: true });

  const tempFile = `${ANALYTICS_FILE}.tmp`;
  await fs.writeFile(tempFile, JSON.stringify(data, null, 2));
  await fs.rename(tempFile, ANALYTICS_FILE);
}

export async function trackSearch(event: Omit<SearchEvent, "timestamp">) {
  try {
    const analytics = await readAnalytics();
    analytics.searches.push({
      ...event,
      timestamp: new Date().toISOString(),
    });

    // Keep last 10,000 searches for memory
    if (analytics.searches.length > 10000) {
      analytics.searches = analytics.searches.slice(-10000);
    }

    await writeAnalytics(analytics);
  } catch (error) {
    console.error("[Analytics] Failed to track search", error);
  }
}

export async function trackView(event: Omit<ViewEvent, "timestamp">) {
  try {
    const analytics = await readAnalytics();
    analytics.views.push({
      ...event,
      timestamp: new Date().toISOString(),
    });

    // Keep last 10,000 views for memory
    if (analytics.views.length > 10000) {
      analytics.views = analytics.views.slice(-10000);
    }

    await writeAnalytics(analytics);
  } catch (error) {
    console.error("[Analytics] Failed to track view", error);
  }
}

export async function getTopSearches(
  limit = 10
): Promise<Array<{ filters: Partial<SearchEvent>; count: number }>> {
  try {
    const analytics = await readAnalytics();
    const grouped = new Map<string, number>();

    for (const search of analytics.searches) {
      const key = JSON.stringify({
        neighborhood: search.neighborhood,
        minRent: search.minRent,
        maxRent: search.maxRent,
        minBedrooms: search.minBedrooms,
        maxBedrooms: search.maxBedrooms,
      });

      grouped.set(key, (grouped.get(key) || 0) + 1);
    }

    return Array.from(grouped.entries())
      .map(([key, count]) => ({
        filters: JSON.parse(key),
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  } catch (error) {
    console.error("[Analytics] Failed to get top searches", error);
    return [];
  }
}

export async function getTopCities(): Promise<Array<{ city: string; count: number }>> {
  try {
    const analytics = await readAnalytics();
    const grouped = new Map<string, number>();

    for (const search of analytics.searches) {
      if (search.neighborhood) {
        grouped.set(
          search.neighborhood,
          (grouped.get(search.neighborhood) || 0) + 1
        );
      }
    }

    return Array.from(grouped.entries())
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count);
  } catch (error) {
    console.error("[Analytics] Failed to get top cities", error);
    return [];
  }
}

export async function getAnalyticsSummary(): Promise<{
  totalSearches: number;
  totalViews: number;
  topSearches: Array<{ filters: Partial<SearchEvent>; count: number }>;
  topCities: Array<{ city: string; count: number }>;
  conversionRate: number;
}> {
  try {
    const analytics = await readAnalytics();
    const topSearches = await getTopSearches(5);
    const topCities = await getTopCities();

    // Simple conversion: views / searches (assume view = interest)
    const conversionRate =
      analytics.searches.length > 0
        ? (analytics.views.length / analytics.searches.length) * 100
        : 0;

    return {
      totalSearches: analytics.searches.length,
      totalViews: analytics.views.length,
      topSearches,
      topCities,
      conversionRate,
    };
  } catch (error) {
    console.error("[Analytics] Failed to get summary", error);
    return {
      totalSearches: 0,
      totalViews: 0,
      topSearches: [],
      topCities: [],
      conversionRate: 0,
    };
  }
}
