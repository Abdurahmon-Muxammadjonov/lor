import { withAuth, ok, parseBody } from '@/lib/api';
import { ServiceUpdateSchema } from '@/lib/services/schemas';
import { deleteService, getService, updateService } from '@/lib/services/service';

export const dynamic = 'force-dynamic';

type P = { id: string };

/** GET /api/services/[id] → ServiceDTO */
export const GET = withAuth<P>({ permission: 'services.view' }, async ({ params, clinicId }) => {
  const row = await getService(clinicId, params.id);
  return ok(row);
});

/** PATCH /api/services/[id] → yangilangan xizmat; narx oʻzgarsa PRICE_CHANGE auditi */
export const PATCH = withAuth<P>({ permission: 'services.write' }, async ({ req, params, clinicId, user, ip }) => {
  const body = await parseBody(req, ServiceUpdateSchema);
  const row = await updateService(
    { clinicId, userId: user.id, ip, userAgent: req.headers.get('user-agent') },
    params.id,
    body,
  );
  return ok(row);
});

/** DELETE /api/services/[id] → faqat qabullarda ishlatilmagan boʻlsa (aks holda 409) */
export const DELETE = withAuth<P>({ permission: 'services.write' }, async ({ req, params, clinicId, user, ip }) => {
  await deleteService({ clinicId, userId: user.id, ip, userAgent: req.headers.get('user-agent') }, params.id);
  return ok({ deleted: true as const, id: params.id });
});
