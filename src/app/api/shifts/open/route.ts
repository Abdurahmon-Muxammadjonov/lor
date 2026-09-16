import { withAuth, created, parseBody } from '@/lib/api';
import { OpenShiftSchema } from '@/lib/cashier/schemas';
import { openShift } from '@/lib/cashier/service';
import { cashierCtx } from '@/lib/cashier/context';

export const dynamic = 'force-dynamic';

/** POST /api/shifts/open {openingCash} — smena ochish (foydalanuvchida ochiq smena boʻlsa 409 SHIFT_ALREADY_OPEN); audit SHIFT_OPEN */
export const POST = withAuth({ permission: 'shifts.manage' }, async (ctx) => {
  const body = await parseBody(ctx.req, OpenShiftSchema);
  return created(await openShift(cashierCtx(ctx), body));
});
