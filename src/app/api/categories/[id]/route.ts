import { withAuth, ok, parseBody } from '@/lib/api';
import { CategoryUpdateSchema } from '@/lib/services/schemas';
import { deleteCategory, updateCategory } from '@/lib/services/service';

export const dynamic = 'force-dynamic';

type P = { id: string };

/** PATCH /api/categories/[id] → yangilangan kategoriya */
export const PATCH = withAuth<P>({ permission: 'services.write' }, async ({ req, params, clinicId, user, ip }) => {
  const body = await parseBody(req, CategoryUpdateSchema);
  const row = await updateCategory(
    { clinicId, userId: user.id, ip, userAgent: req.headers.get('user-agent') },
    params.id,
    body,
  );
  return ok(row);
});

/** DELETE /api/categories/[id] → faqat boʻsh kategoriya (aks holda 409) */
export const DELETE = withAuth<P>({ permission: 'services.write' }, async ({ req, params, clinicId, user, ip }) => {
  await deleteCategory({ clinicId, userId: user.id, ip, userAgent: req.headers.get('user-agent') }, params.id);
  return ok({ deleted: true as const, id: params.id });
});
