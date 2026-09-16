import { withAuth, ok, created, parseBody, parseQuery } from '@/lib/api';
import { CreatePaymentSchema, ListPaymentsQuerySchema } from '@/lib/cashier/schemas';
import { createPayment, listPayments } from '@/lib/cashier/service';
import { cashierCtx } from '@/lib/cashier/context';

export const dynamic = 'force-dynamic';

/** GET /api/payments?date=YYYY-MM-DD&visitId=&method=&refunds=1&page=&pageSize= — toʻlovlar roʻyxati (kassir, bemor, qabul bilan) */
export const GET = withAuth({ permission: 'payments.view' }, async ({ clinicId, req }) => {
  const q = parseQuery(req, ListPaymentsQuerySchema);
  return ok(await listPayments(clinicId, q));
});

/**
 * POST /api/payments {visitId, amount, method, note?}
 * Tranzaksiya: qabul (shu klinika, bekor qilinmagan) → ochiq smena (409 NO_OPEN_SHIFT) → summa ≤ qoldiq (400 OVERPAY)
 * → toʻlov (chek raqami bilan) → recalcVisit → audit PAYMENT. Javob: {payment, totals, receipt, visit}.
 */
export const POST = withAuth({ permission: 'payments.write' }, async (ctx) => {
  const body = await parseBody(ctx.req, CreatePaymentSchema);
  return created(await createPayment(cashierCtx(ctx), body));
});
