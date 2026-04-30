/**
 * Tiny in-memory token-bucket rate limiter keyed by IP (or arbitrary key).
 * Acceptable for sprint-01 single-instance dev. For production this should
 * be swapped for Upstash Ratelimit (or similar) so limits are shared across
 * serverless instances.
 */

type Bucket = { tokens: number; updatedAt: number };

const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  /** Number of allowed requests per window. */
  limit: number;
  /** Window in milliseconds. */
  windowMs: number;
}

export function rateLimit(
  key: string,
  { limit, windowMs }: RateLimitOptions,
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const refillRate = limit / windowMs; // tokens per ms
  const existing = buckets.get(key);

  if (!existing) {
    buckets.set(key, { tokens: limit - 1, updatedAt: now });
    return { allowed: true, remaining: limit - 1 };
  }

  const elapsed = now - existing.updatedAt;
  const tokens = Math.min(limit, existing.tokens + elapsed * refillRate);

  if (tokens < 1) {
    existing.tokens = tokens;
    existing.updatedAt = now;
    return { allowed: false, remaining: 0 };
  }

  existing.tokens = tokens - 1;
  existing.updatedAt = now;
  return { allowed: true, remaining: Math.floor(existing.tokens) };
}

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
