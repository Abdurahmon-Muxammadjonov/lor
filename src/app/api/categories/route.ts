import { withAuth, ok, created, parseBody } from '@/lib/api';
import { CategorySchema } from '@/lib/services/schemas';
import { createCategory, listCategories } from '@/lib/services/service';

export const dynamic = 'force-dynamic';

/** GET /api/categories → { items: CategoryDTO[] } (xizmatlar soni bilan, tartib boʻyicha) */
export const GET = withAuth({ permission: 'services.view' }, async ({ clinicId }) => {
  const items = await listCategories(clinicId);
  return ok({ items });
});

/** POST /api/categories → yangi kategoriya (nom klinika ichida unikal) */
export const POST = withAuth({ permission: 'services.write' }, async ({ req, clinicId, user, ip }) => {
  const body = await parseBody(req, CategorySchema);
  const row = await createCategory({ clinicId, userId: user.id, ip, userAgent: req.headers.get('user-agent') }, body);
  return created(row);
});
