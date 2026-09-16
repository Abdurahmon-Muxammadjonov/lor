import { withAuth, ok, ApiError } from '@/lib/api';
import { getShift } from '@/lib/cashier/service';

export const dynamic = 'force-dynamic';

/** GET /api/shifts/[id] — smena tafsiloti: jamlar, farq va barcha toʻlovlar (bemor bilan) */
export const GET = withAuth<{ id: string }>({ permission: 'payments.view' }, async ({ clinicId, params }) => {
  const shift = await getShift(clinicId, params.id);
  if (!shift) throw ApiError.notFound('Smena topilmadi');
  return ok(shift);
});
