import { ApiError, audit, ok, parseBody, withPublic } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/password';
import { consumeResetToken, findValidResetToken, revokeResetTokens } from '@/lib/auth/reset-token';
import { ResetSchema } from '@/lib/auth/schemas';

export const dynamic = 'force-dynamic';

const INVALID_TOKEN_MSG = 'Havola yaroqsiz yoki muddati oʻtgan';

/**
 * POST /api/auth/reset — token bilan yangi parol oʻrnatish.
 * - Token sha256 hash orqali tekshiriladi (muddat + usedAt), tranzaksiyada ishlatilgan deb belgilanadi
 * - Parol bcrypt bilan yangilanadi, `sessionVersion` +1 → barcha faol sessiyalar bekor boʻladi
 * - Login rate-limit yozuvlari tozalanadi (bloklangan foydalanuvchi darhol kira oladi)
 */
export const POST = withPublic(async ({ req, ip }) => {
  const body = await parseBody(req, ResetSchema);

  // Arzon tekshiruv: yaroqsiz token uchun bcrypt ishlatilmaydi (DoS oldini olish)
  const valid = await findValidResetToken(body.token);
  if (!valid) throw ApiError.notFound(INVALID_TOKEN_MSG);

  const password = await hashPassword(body.password);

  const user = await prisma.$transaction(async (tx) => {
    const u = await consumeResetToken(body.token, tx);
    if (!u || !u.isActive) return null;

    await tx.user.update({
      where: { id: u.id },
      data: { password, sessionVersion: { increment: 1 } },
    });
    await revokeResetTokens(u.id, tx);
    await audit(
      {
        clinicId: u.clinicId,
        userId: u.id,
        action: 'PASSWORD_RESET',
        entity: 'User',
        entityId: u.id,
        after: { step: 'completed', sessionVersion: u.sessionVersion + 1 },
        ip,
        userAgent: req.headers.get('user-agent'),
      },
      tx,
    );
    return u;
  });

  if (!user) throw ApiError.notFound(INVALID_TOKEN_MSG);

  // Bloklangan urinishlarni tozalash — yangi parol bilan darhol kirish mumkin
  await prisma.loginAttempt.deleteMany({ where: { key: { startsWith: `${user.login}|` }, success: false } });

  return ok({ done: true });
});
