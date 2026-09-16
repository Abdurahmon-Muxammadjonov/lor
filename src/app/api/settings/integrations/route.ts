import { withAuth, ok } from '@/lib/api';
import { getIntegrationStatus } from '@/lib/integrations/status';

export const dynamic = 'force-dynamic';

/** GET /api/settings/integrations — Eskiz/Telegram/Click/Payme/Cron env orqali sozlanganmi (sirlarsiz) */
export const GET = withAuth({ permission: 'settings.view' }, async () => ok(getIntegrationStatus()));
