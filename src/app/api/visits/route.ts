import { withAuth, ok, created, parseBody, parseQuery } from '@/lib/api';
import { CreateVisitSchema, ListVisitsQuerySchema } from '@/lib/visits/schemas';
import { createVisit, listVisits, toVisitDetailDTO } from '@/lib/visits/service';

export const dynamic = 'force-dynamic';

/** GET /api/visits?from=&to=&doctorId=&patientId=&status=&page=&pageSize= */
export const GET = withAuth({ permission: 'visits.view' }, async ({ clinicId, req }) => {
  const q = parseQuery(req, ListVisitsQuerySchema);
  return ok(await listVisits(clinicId, q));
});

/** POST /api/visits {patientId, doctorId?, queueId?, appointmentId?} */
export const POST = withAuth({ permission: 'visits.create' }, async ({ user, clinicId, req, ip }) => {
  const body = await parseBody(req, CreateVisitSchema);
  const visit = await createVisit(
    { clinicId, actor: { id: user.id, role: user.role }, ip, userAgent: req.headers.get('user-agent') },
    body,
  );
  return created(toVisitDetailDTO(visit));
});
