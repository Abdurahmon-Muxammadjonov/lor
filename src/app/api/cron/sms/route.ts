import { withPublic, ok } from '@/lib/api';
import { requireCron } from '@/lib/integrations/cron-auth';
import { deliverPendingSms } from '@/lib/integrations/eskiz';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** GET /api/cron/sms — SmsLog PENDING (barcha klinikalar, 50 tagacha) → Eskiz. Authorization: Bearer CRON_SECRET */
export const GET = withPublic(async ({ req }) => {
  requireCron(req);
  const started = Date.now();
  const result = await deliverPendingSms(undefined, { limit: 50 });
  return ok({ ...result, elapsedMs: Date.now() - started });
});
