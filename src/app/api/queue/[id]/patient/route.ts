import { withAuth, ok, parseBody } from '@/lib/api';
import { LinkPatientSchema } from '@/lib/queue/schemas';
import { linkPatient, toRowDTO } from '@/lib/queue/service';

export const dynamic = 'force-dynamic';

/** POST /api/queue/[id]/patient {patientId} — talonga bemorni biriktirish (qabulxona/admin) */
export const POST = withAuth<{ id: string }>({ permission: 'queue.manage' }, async ({ clinicId, req, params }) => {
  const body = await parseBody(req, LinkPatientSchema);
  const row = await linkPatient(clinicId, params.id, body.patientId);
  return ok(toRowDTO(row));
});
