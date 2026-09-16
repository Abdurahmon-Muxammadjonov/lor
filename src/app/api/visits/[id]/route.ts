import { withAuth, ok, parseBody, ApiError } from '@/lib/api';
import { UpdateVisitSchema } from '@/lib/visits/schemas';
import { getVisit, toVisitDetailDTO, updateVisit } from '@/lib/visits/service';

export const dynamic = 'force-dynamic';

/** GET /api/visits/[id] */
export const GET = withAuth<{ id: string }>({ permission: 'visits.view' }, async ({ clinicId, params }) => {
  const visit = await getVisit(clinicId, params.id);
  if (!visit) throw ApiError.notFound('Qabul topilmadi');
  return ok(toVisitDetailDTO(visit));
});

/** PATCH /api/visits/[id] — klinik maydonlar (shikoyat, anamnez, koʻrik, tashxis, ICD-10, reja, tavsiyalar) */
export const PATCH = withAuth<{ id: string }>(
  { permission: 'visits.write' },
  async ({ user, clinicId, params, req, ip }) => {
    const body = await parseBody(req, UpdateVisitSchema);
    const visit = await updateVisit(
      { clinicId, actor: { id: user.id, role: user.role }, ip, userAgent: req.headers.get('user-agent') },
      params.id,
      body,
    );
    return ok(toVisitDetailDTO(visit));
  },
);
