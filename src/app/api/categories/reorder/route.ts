import { withAuth, ok, parseBody } from '@/lib/api';
import { ReorderSchema } from '@/lib/services/schemas';
import { reorderCategories } from '@/lib/services/service';

export const dynamic = 'force-dynamic';

/** POST /api/categories/reorder { ids } → { updated } */
export const POST = withAuth({ permission: 'services.write' }, async ({ req, clinicId, user, ip }) => {
  const { ids } = await parseBody(req, ReorderSchema);
  const updated = await reorderCategories({ clinicId, userId: user.id, ip }, ids);
  return ok({ updated });
});
