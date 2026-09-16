import { prisma } from '@/lib/prisma';

/**
 * Login rate limiting: 5 urinish / 15 daqiqa (login+IP boʻyicha).
 * DB-ga asoslangan — serverless (Vercel) instansiyalar oʻrtasida ham ishlaydi.
 */
export const LOGIN_MAX_ATTEMPTS = 5;
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export function rateLimitKey(login: string, ip: string): string {
  return `${login.trim().toLowerCase()}|${ip}`;
}

export interface RateLimitState {
  blocked: boolean;
  remaining: number;
  retryAfterSec: number;
}

export async function checkLoginRateLimit(key: string): Promise<RateLimitState> {
  const since = new Date(Date.now() - LOGIN_WINDOW_MS);
  const failed = await prisma.loginAttempt.findMany({
    where: { key, success: false, createdAt: { gt: since } },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  });
  const count = failed.length;
  if (count >= LOGIN_MAX_ATTEMPTS) {
    const oldest = failed[0]?.createdAt ?? new Date();
    const retryAfterMs = oldest.getTime() + LOGIN_WINDOW_MS - Date.now();
    return { blocked: true, remaining: 0, retryAfterSec: Math.max(1, Math.ceil(retryAfterMs / 1000)) };
  }
  return { blocked: false, remaining: LOGIN_MAX_ATTEMPTS - count, retryAfterSec: 0 };
}

export async function recordLoginAttempt(key: string, success: boolean): Promise<void> {
  await prisma.loginAttempt.create({ data: { key, success } });
  if (success) {
    // Muvaffaqiyatli kirishdan soʻng eski urinishlarni tozalaymiz
    await prisma.loginAttempt.deleteMany({ where: { key, success: false } });
  }
  // Fon tozalash: 1 kundan eski yozuvlar
  if (Math.random() < 0.05) {
    await prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });
  }
}
