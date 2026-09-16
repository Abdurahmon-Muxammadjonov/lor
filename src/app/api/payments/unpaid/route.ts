import { withAuth, ok, parseQuery } from '@/lib/api';
import { UnpaidQuerySchema } from '@/lib/cashier/schemas';
import { listUnpaid } from '@/lib/cashier/service';

export const dynamic = 'force-dynamic';

/** GET /api/payments/unpaid?scope=today|all&q=&limit= — qoldigʻi > 0 boʻlgan qabullar (bemor, shifokor, jamlar bilan) */
export const GET = withAuth({ permission: 'payments.view' }, async ({ clinicId, req }) => {
  const q = parseQuery(req, UnpaidQuerySchema);
  return ok(await listUnpaid(clinicId, q));
});
