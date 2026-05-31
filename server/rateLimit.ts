/**
 * Rate limiting utilities for API endpoints
 */

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30;

/**
 * Get client IP from request
 */
export function getClientIp(headers?: Record<string, string>): string {
  if (!headers) return 'unknown';
  
  // Check common headers for IP
  const ip =
    headers['x-forwarded-for']?.split(',')[0].trim() ||
    headers['x-real-ip'] ||
    headers['cf-connecting-ip'] ||
    'unknown';
  
  return ip;
}

/**
 * Check if client has exceeded rate limit
 */
export function checkRateLimit(clientIp: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const key = `rate-limit:${clientIp}`;
  
  let record = rateLimitStore.get(key);
  
  // Reset if window has expired
  if (!record || now > record.resetTime) {
    record = { count: 0, resetTime: now + RATE_LIMIT_WINDOW };
    rateLimitStore.set(key, record);
  }
  
  const allowed = record.count < MAX_REQUESTS_PER_WINDOW;
  
  if (allowed) {
    record.count++;
  }
  
  const remaining = Math.max(0, MAX_REQUESTS_PER_WINDOW - record.count);
  
  return { allowed, remaining };
}

/**
 * Clean up old rate limit records periodically
 */
export function cleanupRateLimitStore(): void {
  const now = Date.now();
  
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Cleanup every 5 minutes
setInterval(cleanupRateLimitStore, 5 * 60 * 1000);
