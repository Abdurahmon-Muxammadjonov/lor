/**
 * Oddiy xotiradagi (in-memory) tezlik chegarasi — ochiq kiosk endpointlari uchun (IP boʻyicha).
 * Serverless muhitda har instans oʻz hisobini yuritadi — bu yerda bu yetarli (himoya, hisob-kitob emas).
 */

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();
let lastSweep = 0;

function sweep(now: number): void {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  /** Sekundlarda — 429 javobda Retry-After uchun */
  retryAfterSec: number;
}

/** `limit` ta soʻrov / `windowMs` oynada; `key` — masalan `kiosk|<ip>` */
export function checkRateLimit(key: string, limit = 30, windowMs = 60_000, now = Date.now()): RateLimitResult {
  sweep(now);
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSec: Math.ceil(windowMs / 1000) };
  }
  if (b.count >= limit) {
    return { ok: false, remaining: 0, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  }
  b.count += 1;
  return { ok: true, remaining: limit - b.count, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
}

/** Testlar uchun */
export function resetRateLimits(): void {
  buckets.clear();
  lastSweep = 0;
}
