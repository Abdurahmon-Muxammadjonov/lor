import { withAuth, ok } from '@/lib/api';
import { VisitFromTicketSchema } from '@/lib/queue/schemas';
import { createVisitFromTicket, toRowDTO } from '@/lib/queue/service';
import type { VisitFromTicketResultDTO } from '@/lib/queue/types';
import { actorFrom, parseOptionalBody } from '../../_lib';

export const dynamic = 'force-dynamic';

/** POST /api/queue/[id]/visit {doctorId?} — talon boʻyicha qabul ochish (bemor shart), talon → SERVING */
export const POST = withAuth<{ id: string }>({ permission: 'visits.create' }, async ({ user, clinicId, req, ip, params }) => {
  const body = await parseOptionalBody(req, VisitFromTicketSchema);
  const result = await createVisitFromTicket(clinicId, params.id, actorFrom(user, ip, req), body.doctorId);
  const data: VisitFromTicketResultDTO = { visitId: result.visitId, ticket: toRowDTO(result.row), existing: result.existing };
  return ok(data, { status: result.existing ? 200 : 201 });
});
