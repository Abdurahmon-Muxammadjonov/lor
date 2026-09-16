import { withAuth, ok, ApiError } from '@/lib/api';
import { getPaymentReceipt } from '@/lib/cashier/service';
import { cashierCtx } from '@/lib/cashier/context';

export const dynamic = 'force-dynamic';

/** GET /api/payments/[id]/receipt — chekni qayta chop etish uchun ReceiptData (til: cookie/Accept-Language) */
export const GET = withAuth<{ id: string }>({ permission: 'payments.view' }, async (ctx) => {
  const receipt = await getPaymentReceipt(cashierCtx(ctx), ctx.params.id);
  if (!receipt) throw ApiError.notFound('Toʻlov topilmadi');
  return ok(receipt);
});
