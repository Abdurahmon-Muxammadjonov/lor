import { ok, withAuth } from '@/lib/api';
import { getQueueWaiting } from '@/lib/dashboard/stats';
import type { QueueCountDTO } from '@/lib/dashboard/types';

export const dynamic = 'force-dynamic';

/** GET /api/dashboard/queue-count → { waiting } — topbar jonli belgisi (15 s polling) */
export const GET = withAuth({ permission: 'dashboard.view' }, async ({ clinicId }) => {
  const waiting = await getQueueWaiting(clinicId);
  const data: QueueCountDTO = { waiting };
  return ok(data, { headers: { 'Cache-Control': 'no-store' } });
});
