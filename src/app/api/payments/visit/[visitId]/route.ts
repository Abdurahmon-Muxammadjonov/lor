import { withAuth, ok, ApiError } from '@/lib/api';
import { getCashierVisit } from '@/lib/cashier/service';

export const dynamic = 'force-dynamic';

/** GET /api/payments/visit/[visitId] — toʻlov oynasi uchun qabul xulosasi (qatorlar, toʻlovlar, jamlar, qoldiq) */
export const GET = withAuth<{ visitId: string }>(
  { permission: 'payments.view' },
  async ({ clinicId, params }) => {
    const visit = await getCashierVisit(clinicId, params.visitId);
    if (!visit) throw ApiError.notFound('Qabul topilmadi');
    return ok(visit);
  },
);
