import { withAuth, ok, parseQuery } from '@/lib/api';
import { ListShiftsQuerySchema } from '@/lib/cashier/schemas';
import { listShifts } from '@/lib/cashier/service';

export const dynamic = 'force-dynamic';

/** GET /api/shifts?page=&pageSize= — smenalar tarixi (kassir, usullar boʻyicha jamlar, farq) */
export const GET = withAuth({ permission: 'payments.view' }, async ({ clinicId, req }) => {
  const q = parseQuery(req, ListShiftsQuerySchema);
  return ok(await listShifts(clinicId, q));
});
