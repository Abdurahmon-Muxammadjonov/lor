/**
 * Xotiradagi (in-memory) sirpanuvchi oyna rate-limiter — ochiq endpointlar (lead formasi) uchun.
 * Serverless muhitda har bir instansiya oʻz hisobini yuritadi — bu ochiq forma uchun yetarli himoya
 * (DB ga asoslangan login limiti `src/lib/auth/rate-limit.ts` da alohida).
 */

export interface RateLimitOptions {
  /** Oyna ichida ruxsat etilgan soʻrovlar soni */
  limit: number;
  /** Oyna, ms */
  windowMs: number;
  /** Vaqt manbai (testlar uchun almashtiriladi) */
  now?: () => number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export interface RateLimiter {
  check(key: string): RateLimitResult;
  reset(key?: string): void;
  size(): number;
}

const MAX_KEYS = 10_000;

export function createRateLimiter({
  limit,
  windowMs,
  now = () => Date.now(),
}: RateLimitOptions): RateLimiter {
  const hits = new Map<string, number[]>();

  const prune = (ts: number) => {
    // Eng eski kalitlarni tozalash — xotira oʻsmasligi uchun
    for (const [k, arr] of hits) {
      const fresh = arr.filter((t) => t > ts - windowMs);
      if (fresh.length === 0) hits.delete(k);
      else hits.set(k, fresh);
    }
    if (hits.size > MAX_KEYS) {
      const excess = hits.size - MAX_KEYS;
      let i = 0;
      for (const k of hits.keys()) {
        if (i++ >= excess) break;
        hits.delete(k);
      }
    }
  };

  return {
    check(key) {
      const ts = now();
      const arr = (hits.get(key) ?? []).filter((t) => t > ts - windowMs);
      if (arr.length >= limit) {
        const oldest = arr[0] ?? ts;
        const retryAfterMs = oldest + windowMs - ts;
        hits.set(key, arr);
        return { allowed: false, remaining: 0, retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
      }
      arr.push(ts);
      hits.set(key, arr);
      if (hits.size % 100 === 0) prune(ts);
      return { allowed: true, remaining: Math.max(0, limit - arr.length), retryAfterSec: 0 };
    },
    reset(key) {
      if (key === undefined) hits.clear();
      else hits.delete(key);
    },
    size() {
      return hits.size;
    },
  };
}

/** Lead formasi: bitta IP dan 10 daqiqada 5 ta soʻrov */
export const LEAD_RATE_LIMIT = { limit: 5, windowMs: 10 * 60 * 1000 } as const;

const globalStore = globalThis as unknown as { __lorLeadLimiter?: RateLimiter };

/** Modul qayta yuklansa ham (dev HMR) bitta limiter */
export function getLeadLimiter(): RateLimiter {
  if (!globalStore.__lorLeadLimiter) globalStore.__lorLeadLimiter = createRateLimiter(LEAD_RATE_LIMIT);
  return globalStore.__lorLeadLimiter;
}
