import { withAuth, ok, parseBody } from '@/lib/api';
import { ReorderSchema } from '@/lib/services/schemas';
import { reorderServices } from '@/lib/services/service';

export const dynamic = 'force-dynamic';

/** POST /api/services/reorder { ids } → { updated } (tartib = massivdagi oʻrin) */
export const POST = withAuth({ permission: 'services.write' }, async ({ req, clinicId, user, ip }) => {
  const { ids } = await parseBody(req, ReorderSchema);
  const updated = await reorderServices({ clinicId, userId: user.id, ip }, ids);
  return ok({ updated });
});
