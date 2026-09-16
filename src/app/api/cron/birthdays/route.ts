import { withPublic, ok } from '@/lib/api';
import { requireCron } from '@/lib/integrations/cron-auth';
import { queueBirthdaySms } from '@/lib/integrations/notifications';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** GET /api/cron/birthdays — bugun tugʻilgan bemorlarga tabrik SMS (kuniga bir marta) */
export const GET = withPublic(async ({ req }) => {
  requireCron(req);
  const started = Date.now();
  const result = await queueBirthdaySms();
  return ok({ ...result, elapsedMs: Date.now() - started });
});
