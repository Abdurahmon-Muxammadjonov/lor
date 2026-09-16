import type { NextRequest } from 'next/server';
import { ApiError } from '@/lib/api/errors';

/**
 * Cron endpointlari himoyasi: `Authorization: Bearer <CRON_SECRET>` (Vercel Cron avtomatik yuboradi).
 * Maxfiy kalit boʻlmasa (env boʻsh) — hamma soʻrov rad etiladi (xavfsiz default).
 */
export function checkCronAuth(authorization: string | null | undefined, secret: string | undefined): boolean {
  if (!secret || secret.trim() === '' || secret === 'change-me') return false;
  if (!authorization) return false;
  const m = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  if (!m) return false;
  const token = (m[1] ?? '').trim();
  return timingSafeEqual(token, secret);
}

/** Uzunlik farqini ham yashiradigan solishtirish (Edge/Node uchun kutubxonasiz) */
export function timingSafeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length === b.length ? 0 : 1;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export function isCronAuthorized(req: NextRequest, secret: string | undefined = process.env.CRON_SECRET): boolean {
  return checkCronAuth(req.headers.get('authorization'), secret);
}

/** Ruxsat boʻlmasa 401 (withPublic ichida ishlatiladi) */
export function requireCron(req: NextRequest): void {
  if (!isCronAuthorized(req)) throw ApiError.unauthorized('Cron: Authorization: Bearer <CRON_SECRET> talab qilinadi');
}
