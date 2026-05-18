/**
 * Simple sliding-window rate limiter.
 *
 * Tracks call timestamps per key and rejects calls that exceed
 * the configured limit within the window.
 */

interface BucketEntry {
  timestamps: number[];
}

const buckets = new Map<string, BucketEntry>();

export interface RateLimitConfig {
  maxCalls: number;
  windowMs: number;
}

/**
 * Check if a call is allowed under the rate limit for the given key.
 * Returns true if allowed, false if rate-limited.
 */
export function checkRateLimit(key: string, config: RateLimitConfig): boolean {
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }

  // Prune timestamps outside the window
  const cutoff = now - config.windowMs;
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

  if (bucket.timestamps.length >= config.maxCalls) {
    return false;
  }

  bucket.timestamps.push(now);
  return true;
}

/**
 * Clear all rate limit buckets (useful for testing).
 */
export function resetRateLimiters(): void {
  buckets.clear();
}
