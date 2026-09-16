import { withAuth, ok } from '@/lib/api';
import { setStatus, toRowDTO } from '@/lib/queue/service';
import { actorFrom } from '../../_lib';

export const dynamic = 'force-dynamic';

/** POST /api/queue/[id]/serve */
export const POST = withAuth<{ id: string }>({ permission: 'queue.call' }, async ({ user, clinicId, req, ip, params }) => {
  const row = await setStatus(clinicId, params.id, 'serve', actorFrom(user, ip, req));
  return ok(toRowDTO(row));
});
