import { withAuth, ok, parseBody } from '@/lib/api';
import { UpdateLineSchema } from '@/lib/visits/schemas';
import { deleteLine, toVisitDetailDTO, updateLine } from '@/lib/visits/service';

export const dynamic = 'force-dynamic';

type P = { id: string; lineId: string };

/** PATCH /api/visits/[id]/lines/[lineId] — qatorni qayta hisoblash (qisman maydonlar) */
export const PATCH = withAuth<P>(
  { permission: 'visits.write' },
  async ({ user, clinicId, params, req, ip }) => {
    const body = await parseBody(req, UpdateLineSchema);
    const visit = await updateLine(
      { clinicId, actor: { id: user.id, role: user.role }, ip, userAgent: req.headers.get('user-agent') },
      params.id,
      params.lineId,
      body,
    );
    return ok(toVisitDetailDTO(visit));
  },
);

/** DELETE /api/visits/[id]/lines/[lineId] */
export const DELETE = withAuth<P>(
  { permission: 'visits.write' },
  async ({ user, clinicId, params, req, ip }) => {
    const visit = await deleteLine(
      { clinicId, actor: { id: user.id, role: user.role }, ip, userAgent: req.headers.get('user-agent') },
      params.id,
      params.lineId,
    );
    return ok(toVisitDetailDTO(visit));
  },
);
