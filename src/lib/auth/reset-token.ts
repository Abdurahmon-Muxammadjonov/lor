import { createHash, randomBytes } from 'node:crypto';
import type { User } from '@prisma/client';
import { prisma, type Tx } from '@/lib/prisma';

/**
 * Parolni tiklash tokenlari.
 * - Foydalanuvchiga xom token (32 bayt hex) yuboriladi, DB da faqat sha256 hash saqlanadi.
 * - Muddati: 1 soat. Yangi token yaratilganda eski ishlatilmagan tokenlar bekor qilinadi.
 * - Token faqat bir marta ishlatiladi (`usedAt`), tranzaksiya ichida belgilanadi.
 */
export const RESET_TOKEN_BYTES = 32;
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export interface ResetTokenResult {
  /** Xom token — faqat email havolasida ishlatiladi, DB ga yozilmaydi */
  token: string;
  expiresAt: Date;
}

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token.trim(), 'utf8').digest('hex');
}

export function generateResetToken(): string {
  return randomBytes(RESET_TOKEN_BYTES).toString('hex');
}

export async function createResetToken(
  userId: string,
  db: Tx | typeof prisma = prisma,
): Promise<ResetTokenResult> {
  const token = generateResetToken();
  const tokenHash = hashResetToken(token);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  const run = async (tx: Tx | typeof prisma) => {
    // Oldingi ishlatilmagan tokenlar bekor qilinadi — bir vaqtda faqat bitta faol havola
    await tx.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });
    await tx.passwordResetToken.create({ data: { userId, tokenHash, expiresAt } });
  };

  if (db === prisma) await prisma.$transaction((tx) => run(tx));
  else await run(db);

  return { token, expiresAt };
}

/** Tokenni ishlatmasdan tekshiradi (yaroqli boʻlsa userId qaytaradi) — bcrypt ishidan oldin arzon tekshiruv */
export async function findValidResetToken(token: string): Promise<{ id: string; userId: string } | null> {
  const tokenHash = hashResetToken(token);
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, usedAt: true, expiresAt: true },
  });
  if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) return null;
  return { id: row.id, userId: row.userId };
}

/**
 * Tokenni ishlatadi: muddati va `usedAt` tekshiriladi, tranzaksiya ichida `usedAt` belgilanadi.
 * Ikki parallel soʻrovdan faqat bittasi muvaffaqiyatli boʻladi (updateMany + count guard).
 * `db` berilsa tashqi tranzaksiya ichida ishlaydi (parolni yangilash bilan atomar).
 */
export async function consumeResetToken(token: string, db?: Tx): Promise<User | null> {
  const tokenHash = hashResetToken(token);

  const run = async (tx: Tx | typeof prisma): Promise<User | null> => {
    const row = await tx.passwordResetToken.findUnique({ where: { tokenHash }, include: { user: true } });
    if (!row || row.usedAt || row.expiresAt.getTime() <= Date.now()) return null;
    const marked = await tx.passwordResetToken.updateMany({
      where: { id: row.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (marked.count !== 1) return null;
    return row.user;
  };

  if (db) return run(db);
  return prisma.$transaction((tx) => run(tx));
}

/** Foydalanuvchining barcha ishlatilmagan tokenlarini bekor qiladi (parol oʻzgarganda) */
export async function revokeResetTokens(userId: string, db: Tx | typeof prisma = prisma): Promise<void> {
  await db.passwordResetToken.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } });
}

/** Eskirgan tokenlarni tozalash (cron / fon) — 7 kundan eski yozuvlar */
export async function purgeExpiredResetTokens(olderThanMs = 7 * 24 * 60 * 60 * 1000): Promise<number> {
  const r = await prisma.passwordResetToken.deleteMany({
    where: { expiresAt: { lt: new Date(Date.now() - olderThanMs) } },
  });
  return r.count;
}
