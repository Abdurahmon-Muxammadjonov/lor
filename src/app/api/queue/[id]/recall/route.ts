import { withAuth, ok } from '@/lib/api';
import { RecallSchema } from '@/lib/queue/schemas';
import { setStatus, toRowDTO } from '@/lib/queue/service';
import { actorFrom, parseOptionalBody } from '../../_lib';

export const dynamic = 'force-dynamic';

/** POST /api/queue/[id]/recall {requeue?} — qayta chaqirish (SKIPPED/CALLED → CALLED) yoki navbatga qaytarish (→ WAITING) */
export const POST = withAuth<{ id: string }>({ permission: 'queue.call' }, async ({ user, clinicId, req, ip, params }) => {
  const body = await parseOptionalBody(req, RecallSchema);
  const row = await setStatus(clinicId, params.id, 'recall', actorFrom(user, ip, req), { requeue: body.requeue ?? false });
  return ok(toRowDTO(row));
});
