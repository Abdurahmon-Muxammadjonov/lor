import { withAuth, created, parseBody } from '@/lib/api';
import { AddLineSchema } from '@/lib/visits/schemas';
import { addLine, toVisitDetailDTO } from '@/lib/visits/service';

export const dynamic = 'force-dynamic';

/** POST /api/visits/[id]/lines — muolaja qatori qoʻshish (narx serverda snapshot qilinadi) */
export const POST = withAuth<{ id: string }>(
  { permission: 'visits.write' },
  async ({ user, clinicId, params, req, ip }) => {
    const body = await parseBody(req, AddLineSchema);
    const visit = await addLine(
      { clinicId, actor: { id: user.id, role: user.role }, ip, userAgent: req.headers.get('user-agent') },
      params.id,
      body,
    );
    return created(toVisitDetailDTO(visit));
  },
);
