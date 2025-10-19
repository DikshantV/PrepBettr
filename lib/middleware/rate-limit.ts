/**
 * Rate Limiting Middleware
 * 
 * In-memory rate limiter using Map data structure.
 * Provides configurable rate limits per endpoint with automatic cleanup.
 */

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

/**
 * Rate limit configurations per endpoint
 */
const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  '/api/cover-letter': {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
  '/api/scrape-job': {
    maxRequests: 10,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
  '/api/parse-pdf': {
    maxRequests: 10,
    windowMs: 5 * 60 * 1000, // 5 minutes
  },
};

/**
 * Default rate limit configuration for endpoints without specific limits
 */
const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 100,
  windowMs: 15 * 60 * 1000, // 15 minutes
};

/**
 * RateLimiter class - manages in-memory rate limiting with automatic cleanup
 */
export class RateLimiter {
  private storage: Map<string, RateLimitRecord>;
  private cleanupInterval: NodeJS.Timeout | null;
  private readonly CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.storage = new Map();
    this.cleanupInterval = null;
    this.startCleanupTask();
  }

  /**
   * Start automatic cleanup task to remove expired entries
   */
  private startCleanupTask(): void {
    // Clear any existing interval
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Set up new cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.CLEANUP_INTERVAL_MS);

    // Ensure cleanup runs on process exit
    if (typeof process !== 'undefined') {
      process.on('beforeExit', () => {
        if (this.cleanupInterval) {
          clearInterval(this.cleanupInterval);
        }
      });
    }
  }

  /**
   * Clean up expired entries from storage
   */
  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, record] of this.storage.entries()) {
      if (now >= record.resetAt) {
        this.storage.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`[RateLimiter] Cleaned up ${cleanedCount} expired entries`);
    }
  }

  /**
   * Get rate limit configuration for an endpoint
   */
  private getConfig(endpoint: string): RateLimitConfig {
    return RATE_LIMIT_CONFIGS[endpoint] || DEFAULT_RATE_LIMIT;
  }

  /**
   * Generate storage key from endpoint and user ID
   */
  private getKey(endpoint: string, userId: string): string {
    return `${endpoint}:${userId}`;
  }

  /**
   * Check rate limit for a user on a specific endpoint
   * Thread-safe for concurrent requests
   */
  async checkLimit(userId: string, endpoint: string): Promise<RateLimitResult> {
    const config = this.getConfig(endpoint);
    const key = this.getKey(endpoint, userId);
    const now = Date.now();

    // Get existing record or create new one
    let record = this.storage.get(key);

    // If no record or window has expired, create new window
    if (!record || now >= record.resetAt) {
      const resetAt = now + config.windowMs;
      record = {
        count: 1,
        resetAt,
      };
      this.storage.set(key, record);

      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetAt,
      };
    }

    // Check if limit exceeded
    if (record.count >= config.maxRequests) {
      const retryAfterSeconds = Math.ceil((record.resetAt - now) / 1000);

      return {
        allowed: false,
        remaining: 0,
        resetAt: record.resetAt,
        retryAfter: retryAfterSeconds,
      };
    }

    // Increment count
    record.count++;
    const remaining = config.maxRequests - record.count;

    return {
      allowed: true,
      remaining: Math.max(0, remaining),
      resetAt: record.resetAt,
    };
  }

  /**
   * Get current rate limit status without incrementing count
   */
  async getStatus(userId: string, endpoint: string): Promise<RateLimitResult> {
    const config = this.getConfig(endpoint);
    const key = this.getKey(endpoint, userId);
    const now = Date.now();

    const record = this.storage.get(key);

    if (!record || now >= record.resetAt) {
      return {
        allowed: true,
        remaining: config.maxRequests,
        resetAt: now + config.windowMs,
      };
    }

    const remaining = config.maxRequests - record.count;

    return {
      allowed: record.count < config.maxRequests,
      remaining: Math.max(0, remaining),
      resetAt: record.resetAt,
      retryAfter: record.count >= config.maxRequests 
        ? Math.ceil((record.resetAt - now) / 1000)
        : undefined,
    };
  }

  /**
   * Reset rate limit for a specific user and endpoint
   * Useful for testing or administrative purposes
   */
  reset(userId: string, endpoint: string): void {
    const key = this.getKey(endpoint, userId);
    this.storage.delete(key);
  }

  /**
   * Clear all rate limit data
   * Useful for testing or maintenance
   */
  clearAll(): void {
    this.storage.clear();
    console.log('[RateLimiter] All rate limit data cleared');
  }

  /**
   * Get current storage statistics
   */
  getStats(): { totalKeys: number; activeWindows: number } {
    const now = Date.now();
    let activeWindows = 0;

    for (const record of this.storage.values()) {
      if (now < record.resetAt) {
        activeWindows++;
      }
    }

    return {
      totalKeys: this.storage.size,
      activeWindows,
    };
  }
}

/**
 * Singleton instance of RateLimiter
 * Use this instance across all API routes for consistent rate limiting
 */
export const rateLimiter = new RateLimiter();

/**
 * Helper function to format rate limit headers
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.resetAt.toString(),
  };

  if (!result.allowed && result.retryAfter) {
    headers['Retry-After'] = result.retryAfter.toString();
  }

  return headers;
}
