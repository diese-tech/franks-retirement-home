// Tiny in-memory token-bucket rate limiter. Keyed on a string (typically
// IP + endpoint). Lives in process memory — across multiple Node processes
// (e.g. Vercel Hobby cold starts) each instance has its own bucket. That's
// acceptable for this app's scale. Swap for a shared store if we move to
// horizontal scaling.

const buckets = new Map();
let lastSweep = Date.now();
const SWEEP_INTERVAL_MS = 60_000;

function sweep(now) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    // Drop empty buckets that haven't been touched in the last 5 minutes.
    if (bucket.tokens >= bucket.capacity && now - bucket.lastRefill > 5 * 60_000) {
      buckets.delete(key);
    }
  }
}

/**
 * Try to consume one token from the bucket identified by `key`.
 * Returns true if allowed, false if rate-limited.
 *
 * @param {string} key       Bucket key (e.g. `chat:${ip}`).
 * @param {object} opts
 * @param {number} opts.capacity      Maximum tokens (burst size).
 * @param {number} opts.refillPerSec  Tokens added per second (steady-state rate).
 */
export function consume(key, { capacity, refillPerSec }) {
  const now = Date.now();
  sweep(now);

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: capacity, capacity, refillPerSec, lastRefill: now };
    buckets.set(key, bucket);
  }

  // Refill tokens proportionally to time elapsed.
  const elapsedSec = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(bucket.capacity, bucket.tokens + elapsedSec * bucket.refillPerSec);
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return true;
  }
  return false;
}

/**
 * Best-effort client identifier for rate-limit keys. Trusts standard proxy
 * headers; in production behind Vercel/Supabase those are set by the platform.
 * Falls back to a fixed string for dev/sandbox runs without a proxy.
 */
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

// Expose for tests that need a clean slate.
export function _clearBucketsForTesting() { buckets.clear(); }
