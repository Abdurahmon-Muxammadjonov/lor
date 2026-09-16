import { withAuth, ok, parseBody } from '@/lib/api';
import { CloseShiftSchema } from '@/lib/cashier/schemas';
import { closeShift } from '@/lib/cashier/service';
import { cashierCtx } from '@/lib/cashier/context';

export const dynamic = 'force-dynamic';

/**
 * POST /api/shifts/[id]/close {closingCash, note?} — usullar boʻyicha jamlar toʻlovlardan hisoblanib saqlanadi,
 * audit SHIFT_CLOSE; javob {shift, expectedCash = openingCash + naqd, difference = closingCash − expectedCash}.
 * Faqat smena egasi yoki ADMIN (403).
 */
export const POST = withAuth<{ id: string }>({ permission: 'shifts.manage' }, async (ctx) => {
  const body = await parseBody(ctx.req, CloseShiftSchema);
  return ok(await closeShift(cashierCtx(ctx), ctx.params.id, body));
});
