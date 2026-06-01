/**
 * Rate limiter for /api/leads endpoint
 * Prevents abuse and spam submissions
 */

interface RateLimitEntry {
  count: number;
  firstRequestTime: number;
  lastRequestTime: number;
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // Time window in milliseconds
}

class RateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig = { maxRequests: 5, windowMs: 3600000 }) {
    this.config = config;
    // Clean up old entries every 10 minutes
    setInterval(() => this.cleanup(), 600000);
  }

  /**
   * Check if a request should be allowed
   * @param key - Unique identifier (email or IP)
   * @returns true if request is allowed, false if rate limited
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry) {
      // First request from this key
      this.store.set(key, {
        count: 1,
        firstRequestTime: now,
        lastRequestTime: now,
      });
      return true;
    }

    // Check if we're still in the time window
    const timeElapsed = now - entry.firstRequestTime;
    if (timeElapsed > this.config.windowMs) {
      // Window expired, reset
      this.store.set(key, {
        count: 1,
        firstRequestTime: now,
        lastRequestTime: now,
      });
      return true;
    }

    // Still in window, check count
    if (entry.count < this.config.maxRequests) {
      entry.count++;
      entry.lastRequestTime = now;
      return true;
    }

    // Rate limit exceeded
    return false;
  }

  /**
   * Get remaining requests for a key
   */
  getRemaining(key: string): number {
    const entry = this.store.get(key);
    if (!entry) return this.config.maxRequests;

    const now = Date.now();
    const timeElapsed = now - entry.firstRequestTime;
    if (timeElapsed > this.config.windowMs) {
      return this.config.maxRequests;
    }

    return Math.max(0, this.config.maxRequests - entry.count);
  }

  /**
   * Get reset time for a key (in seconds)
   */
  getResetTime(key: string): number {
    const entry = this.store.get(key);
    if (!entry) return 0;

    const now = Date.now();
    const timeElapsed = now - entry.firstRequestTime;
    if (timeElapsed > this.config.windowMs) {
      return 0;
    }

    return Math.ceil((this.config.windowMs - timeElapsed) / 1000);
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now - entry.firstRequestTime > this.config.windowMs) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Reset a specific key (admin use)
   */
  reset(key: string): void {
    this.store.delete(key);
  }

  /**
   * Clear all entries (admin use)
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Get stats for monitoring
   */
  getStats(): {
    totalKeys: number;
    entries: Array<{ key: string; count: number; remaining: number; resetIn: number }>;
  } {
    const entries = Array.from(this.store.entries()).map(([key, entry]) => ({
      key,
      count: entry.count,
      remaining: this.getRemaining(key),
      resetIn: this.getResetTime(key),
    }));

    return {
      totalKeys: this.store.size,
      entries,
    };
  }
}

// Export singleton instance
// 5 requests per hour per email
export const leadsRateLimiter = new RateLimiter({
  maxRequests: 5,
  windowMs: 3600000, // 1 hour
});

// IP-based limiter for additional protection
// 20 requests per hour per IP
export const leadsIpRateLimiter = new RateLimiter({
  maxRequests: 20,
  windowMs: 3600000, // 1 hour
});
