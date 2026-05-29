// In-memory token-bucket rate limiter (existing API — unchanged).
// Also exports checkRateLimit() — an async sliding-window limiter backed by
// Upstash Redis when available, falling back to in-memory fixed-window.

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// ─── Token-bucket (existing — for chat and other callers) ─────────────────────

const buckets = new Map();
let lastSweep = Date.now();
const SWEEP_INTERVAL_MS = 60_000;

function sweep(now) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.tokens >= bucket.capacity && now - bucket.lastRefill > 5 * 60_000) {
      buckets.delete(key);
    }
  }
}

export function consume(key, { capacity, refillPerSec }) {
  const now = Date.now();
  sweep(now);
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: capacity, capacity, refillPerSec, lastRefill: now };
    buckets.set(key, bucket);
  }
  const elapsedSec = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(bucket.capacity, bucket.tokens + elapsedSec * bucket.refillPerSec);
  bucket.lastRefill = now;
  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;
  }
  return false;
}

export function clientIp(request) {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0].trim();
    if (first) return first;
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp;
  return 'unknown';
}

export function _clearBucketsForTesting() { buckets.clear(); }

// ─── Async sliding-window rate limiter (new — for admin-auth and future use) ──

// Module-level singleton — one Redis connection shared across all calls.
let _redisLimiters = null;

function getRedisLimiters() {
  if (_redisLimiters !== null) return _redisLimiters;
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    _redisLimiters = false; // sentinel: env vars not set
    return false;
  }
  try {
    const redis = Redis.fromEnv();
    // Cache limiters by `${limit}:${windowSeconds}` key to avoid recreating
    const cache = new Map();
    _redisLimiters = { redis, cache };
  } catch (e) {
    console.error('[rateLimit] Failed to initialise Redis client:', e);
    _redisLimiters = false;
  }
  return _redisLimiters;
}

// Simple fixed-window in-memory fallback for checkRateLimit
const windowCounters = new Map();

function inMemoryWindowCheck(key, limit, windowMs) {
  const now = Date.now();
  let entry = windowCounters.get(key);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    windowCounters.set(key, entry);
  }
  entry.count++;
  return { allowed: entry.count <= limit, remaining: Math.max(0, limit - entry.count) };
}

/**
 * Async sliding-window rate check.
 * Uses Upstash Redis if UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set.
 * Falls back to in-memory fixed-window (per-process) otherwise.
 *
 * @param {string} key          Rate limit key (e.g. `admin-auth:1.2.3.4`)
 * @param {number} limit        Max requests allowed in window
 * @param {number} windowSeconds  Window duration in seconds
 * @returns {Promise<{ allowed: boolean, remaining: number }>}
 */
export async function checkRateLimit(key, limit, windowSeconds) {
  // In non-production with unknown IP (dev/test), skip enforcement to avoid
  // all requests sharing one bucket and breaking tests.
  if (process.env.NODE_ENV !== 'production' && key.endsWith(':unknown')) {
    return { allowed: true, remaining: limit };
  }

  const limiters = getRedisLimiters();
  if (limiters) {
    const cacheKey = `${limit}:${windowSeconds}`;
    let limiter = limiters.cache.get(cacheKey);
    if (!limiter) {
      limiter = new Ratelimit({
        redis: limiters.redis,
        limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
        prefix: 'frh:rl',
      });
      limiters.cache.set(cacheKey, limiter);
    }
    try {
      const { success, remaining } = await limiter.limit(key);
      return { allowed: success, remaining: remaining ?? 0 };
    } catch (e) {
      console.error('[rateLimit] Redis limit check failed, falling back to in-memory:', e?.message);
      // Fall through to in-memory
    }
  }

  return inMemoryWindowCheck(key, limit, windowSeconds * 1000);
}
