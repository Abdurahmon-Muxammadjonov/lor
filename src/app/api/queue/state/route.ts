import { withAuth, ok } from '@/lib/api';
import { todayKey } from '@/lib/date';
import { getBoard } from '@/lib/queue/service';

export const dynamic = 'force-dynamic';

/** GET /api/queue/state — bugungi taxta (SSE ishlamasa 3 s polling uchun; /api/queue/stream bilan bir xil snapshot) */
export const GET = withAuth({ permission: 'queue.view' }, async ({ clinicId }) => {
  return ok(await getBoard(clinicId, todayKey()), { headers: { 'Cache-Control': 'no-store' } });
});
