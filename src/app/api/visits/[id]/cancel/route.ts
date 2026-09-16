import { withAuth, ok } from '@/lib/api';
import { cancelVisit, toVisitDetailDTO } from '@/lib/visits/service';

export const dynamic = 'force-dynamic';

/** POST /api/visits/[id]/cancel — faqat toʻlovsiz qabul (aks holda 409) */
export const POST = withAuth<{ id: string }>(
  { permission: 'visits.write' },
  async ({ user, clinicId, params, req, ip }) => {
    const visit = await cancelVisit(
      { clinicId, actor: { id: user.id, role: user.role }, ip, userAgent: req.headers.get('user-agent') },
      params.id,
    );
    return ok(toVisitDetailDTO(visit));
  },
);
