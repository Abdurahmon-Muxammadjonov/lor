import { withAuth, created, parseBody } from '@/lib/api';
import { RefundBodySchema } from '@/lib/cashier/schemas';
import { refundPayment } from '@/lib/cashier/service';
import { cashierCtx } from '@/lib/cashier/context';

export const dynamic = 'force-dynamic';

/**
 * POST /api/payments/[id]/refund {amount, note} — qaytarish: manfiy Payment qatori (asl chek raqami note da),
 * recalcVisit, audit REFUND. Summa asl toʻlovdan va qabul boʻyicha toʻlangan summadan oshmaydi (400 REFUND_EXCEEDS).
 */
export const POST = withAuth<{ id: string }>({ permission: 'payments.refund' }, async (ctx) => {
  const body = await parseBody(ctx.req, RefundBodySchema);
  return created(await refundPayment(cashierCtx(ctx), ctx.params.id, body));
});
