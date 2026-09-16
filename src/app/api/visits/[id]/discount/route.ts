import { withAuth, ok, parseBody } from '@/lib/api';
import { GlobalDiscountSchema } from '@/lib/visits/schemas';
import { setGlobalDiscount, toVisitDetailDTO } from '@/lib/visits/service';

export const dynamic = 'force-dynamic';

/** PATCH /api/visits/[id]/discount {type, value} — umumiy chegirma */
export const PATCH = withAuth<{ id: string }>(
  { permission: 'visits.write' },
  async ({ user, clinicId, params, req, ip }) => {
    const body = await parseBody(req, GlobalDiscountSchema);
    const visit = await setGlobalDiscount(
      { clinicId, actor: { id: user.id, role: user.role }, ip, userAgent: req.headers.get('user-agent') },
      params.id,
      body,
    );
    return ok(toVisitDetailDTO(visit));
  },
);
