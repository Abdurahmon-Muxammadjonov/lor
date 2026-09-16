import { withPublic } from '@/lib/api';
import { getDisplayState, pollQueueEvents } from '@/lib/queue/service';
import { makeSse } from '@/lib/realtime/stream';
import { clinicFromKey } from '../_lib';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** GET /api/display/stream?key= — SSE: `snapshot` (tablo holati) + `queue` hodisalari */
export const GET = withPublic(async ({ req }) => {
  const clinic = await clinicFromKey(req);
  return makeSse(req, {
    clinicId: clinic.id,
    snapshot: () => getDisplayState(clinic),
    poll: (since) => pollQueueEvents(clinic.id, since),
  });
});
