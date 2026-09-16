import { ApiError, audit, ok, parseBody, withPublic } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { resetEmailTemplate, sendMail } from '@/lib/auth/email';
import { checkLoginRateLimit, rateLimitKey, recordLoginAttempt } from '@/lib/auth/rate-limit';
import { createResetToken } from '@/lib/auth/reset-token';
import { ForgotSchema } from '@/lib/auth/schemas';
import { getLocale } from '@/i18n/server';

export const dynamic = 'force-dynamic';

/** Havolalar uchun ilova manzili (oxirgi `/` siz) */
function appUrl(): string {
  const raw = process.env.APP_URL?.trim() || process.env.NEXTAUTH_URL?.trim() || 'http://localhost:3000';
  return raw.replace(/\/+$/, '');
}

/**
 * POST /api/auth/forgot — parolni tiklash havolasini soʻrash.
 * - IP boʻyicha rate limit: 5 soʻrov / 15 daqiqa (`forgot|<ip>` kaliti, LoginAttempt jadvali)
 * - Foydalanuvchi login YOKI email boʻyicha topiladi (faqat faol, klinikasi faol)
 * - Hisob mavjudligi sizib chiqmasligi uchun javob DOIM `{ sent: true }`
 */
export const POST = withPublic(async ({ req, ip }) => {
  const body = await parseBody(req, ForgotSchema);

  const key = rateLimitKey('forgot', ip);
  const rl = await checkLoginRateLimit(key);
  if (rl.blocked) {
    throw new ApiError(
      429,
      'RATE_LIMITED',
      'Urinishlar soni koʻpayib ketdi. Keyinroq qayta urinib koʻring.',
      {
        retryAfterSec: rl.retryAfterSec,
      },
    );
  }
  // Har bir soʻrov urinish sifatida hisoblanadi (muvaffaqiyatsiz = oynada sanaladi)
  await recordLoginAttempt(key, false);

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ login: body.login }, { email: { equals: body.login, mode: 'insensitive' } }],
      isActive: true,
      clinic: { isActive: true },
    },
    select: { id: true, clinicId: true, email: true, fullName: true, login: true },
  });

  if (user?.email) {
    const { token, expiresAt } = await createResetToken(user.id);
    const url = `${appUrl()}/reset-password?token=${encodeURIComponent(token)}`;
    const locale = getLocale();
    const tpl = resetEmailTemplate(locale, { name: user.fullName, url });
    const result = await sendMail({ to: user.email, subject: tpl.subject, html: tpl.html, text: tpl.text });

    await audit({
      clinicId: user.clinicId,
      userId: user.id,
      action: 'PASSWORD_RESET',
      entity: 'User',
      entityId: user.id,
      after: { step: 'requested', delivered: result.delivered, expiresAt: expiresAt.toISOString() },
      ip,
      userAgent: req.headers.get('user-agent'),
    });
  }

  return ok({ sent: true });
});
