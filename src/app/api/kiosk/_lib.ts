import { ApiError } from '@/lib/api/errors';
import { checkRateLimit } from '@/lib/queue/rate-limit';

/** Kiosk endpointlari: IP boʻyicha 30 soʻrov/daqiqa (xotirada) */
export const KIOSK_RATE_LIMIT = 30;

export function enforceKioskRateLimit(ip: string, scope: 'ticket' | 'print' = 'ticket'): void {
  const r = checkRateLimit(`kiosk:${scope}|${ip}`, KIOSK_RATE_LIMIT, 60_000);
  if (!r.ok) {
    throw new ApiError(429, 'RATE_LIMITED', 'Juda koʻp soʻrov — bir daqiqadan soʻng urinib koʻring', { retryAfterSec: r.retryAfterSec });
  }
}
