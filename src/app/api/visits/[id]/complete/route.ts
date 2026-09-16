import { withAuth, ok } from '@/lib/api';
import { completeVisit, toVisitDetailDTO } from '@/lib/visits/service';

export const dynamic = 'force-dynamic';

/** POST /api/visits/[id]/complete — qabulni yakunlash (kamida 1 qator; navbat → DONE, yozilish → DONE) */
export const POST = withAuth<{ id: string }>(
  { permission: 'visits.write' },
  async ({ user, clinicId, params, req, ip }) => {
    const visit = await completeVisit(
      { clinicId, actor: { id: user.id, role: user.role }, ip, userAgent: req.headers.get('user-agent') },
      params.id,
    );
    return ok(toVisitDetailDTO(visit));
  },
);
