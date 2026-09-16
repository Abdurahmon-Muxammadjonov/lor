import { ApiError, audit, created, ok, parseBody, withPublic } from '@/lib/api';
import { LeadSchema } from '@/components/landing/lead-schema';
import { getLeadLimiter } from '../_lib/rate-limit';
import { formatLeadMessage, notifyTelegramAdmin } from '../_lib/telegram';

export const dynamic = 'force-dynamic';

/**
 * POST /api/public/lead — landing sahifasidagi soʻrov formasi (sessiyasiz).
 * - IP boʻyicha rate-limit (5 / 10 daqiqa)
 * - zod validatsiya (LeadSchema), honeypot (`website`)
 * - AuditLog {action:'CREATE', entity:'Lead', after: form}
 * - TELEGRAM_BOT_TOKEN + TELEGRAM_ADMIN_CHAT_ID boʻlsa Telegram ga yuboradi
 */
export const POST = withPublic(async ({ req, ip }) => {
  const limiter = getLeadLimiter();
  const rl = limiter.check(`lead|${ip}`);
  if (!rl.allowed) {
    throw new ApiError(429, 'RATE_LIMITED', 'Juda koʻp soʻrov. Birozdan soʻng qayta urinib koʻring', {
      retryAfterSec: rl.retryAfterSec,
    });
  }

  const body = await parseBody(req, LeadSchema);

  // Honeypot toʻldirilgan — bot. Muvaffaqiyat koʻrinishida javob beramiz, hech narsa saqlamaymiz.
  if (body.website) return ok({ received: true, forwarded: false });

  const receivedAt = new Date();
  const lead = {
    name: body.name,
    phone: body.phone,
    clinic: body.clinic,
    message: body.message,
    locale: body.locale,
    source: body.source,
    receivedAt: receivedAt.toISOString(),
  };

  await audit({
    clinicId: null,
    userId: null,
    action: 'CREATE',
    entity: 'Lead',
    entityId: null,
    after: lead,
    ip,
    userAgent: req.headers.get('user-agent')?.slice(0, 255) ?? null,
  });

  const forwarded = await notifyTelegramAdmin(formatLeadMessage(body, { ip, receivedAt }));

  return created({ received: true, forwarded });
});
