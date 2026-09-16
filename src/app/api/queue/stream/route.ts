import { withAuth } from '@/lib/api';
import { todayKey } from '@/lib/date';
import { getBoard, pollQueueEvents } from '@/lib/queue/service';
import { makeSse } from '@/lib/realtime/stream';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** GET /api/queue/stream — SSE: `snapshot` (bugungi taxta) + `queue` hodisalari (2 s DB polling, 15 s ping) */
export const GET = withAuth({ permission: 'queue.view' }, async ({ clinicId, req }) => {
  return makeSse(req, {
    clinicId,
    snapshot: () => getBoard(clinicId, todayKey()),
    poll: (since) => pollQueueEvents(clinicId, since),
  });
});
