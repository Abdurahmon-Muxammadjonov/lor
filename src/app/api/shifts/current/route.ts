import { withAuth, ok } from '@/lib/api';
import { getCurrentShift } from '@/lib/cashier/service';
import { cashierCtx } from '@/lib/cashier/context';

export const dynamic = 'force-dynamic';

/**
 * GET /api/shifts/current — foydalanuvchining ochiq smenasi (boʻlmasa klinikadagi istalgan ochiq smena),
 * usullar boʻyicha jonli jamlar; {shift|null, isMine, canOperate}
 */
export const GET = withAuth({ permission: 'payments.view' }, async (ctx) =>
  ok(await getCurrentShift(cashierCtx(ctx))),
);
