import { withAuth, ok, created, parseBody, parseQuery } from '@/lib/api';
import { ServiceSchema, ServicesQuerySchema } from '@/lib/services/schemas';
import { createService, listServices } from '@/lib/services/service';

export const dynamic = 'force-dynamic';

/** GET /api/services?all=1&categoryId=&q= → { items: ServiceDTO[] } (narxlar butun number, kategoriya bilan) */
export const GET = withAuth({ permission: 'services.view' }, async ({ req, clinicId }) => {
  const query = parseQuery(req, ServicesQuerySchema);
  const items = await listServices(clinicId, query);
  return ok({ items });
});

/** POST /api/services → yangi xizmat (kod klinika ichida unikal) */
export const POST = withAuth({ permission: 'services.write' }, async ({ req, clinicId, user, ip }) => {
  const body = await parseBody(req, ServiceSchema);
  const row = await createService(
    { clinicId, userId: user.id, ip, userAgent: req.headers.get('user-agent') },
    body,
  );
  return created(row);
});
