import { withAuth, ok, created, parseBody, parseQuery } from '@/lib/api';
import { CreateAppointmentSchema, RangeQuerySchema } from '@/lib/appointments/schemas';
import { createAppointment, listAppointments } from '@/lib/appointments/service';

export const dynamic = 'force-dynamic';

/** GET /api/appointments?from&to&doctorId&patientId&status → { items, from, to } */
export const GET = withAuth({ permission: 'appointments.view' }, async ({ clinicId, req }) => {
  const q = parseQuery(req, RangeQuerySchema);
  const items = await listAppointments(clinicId, q);
  return ok({ items, from: q.from, to: q.to });
});

/**
 * POST /api/appointments { patientId, doctorId, startAt, durationMin?, note? } → appointment (201)
 * 400 VALIDATION details.reason: PAST | DAY_OFF | OUTSIDE_HOURS | BREAK | DOCTOR | PATIENT
 * 409 CONFLICT  details: { reason: 'OVERLAP', conflictId, conflictStartAt, conflictEndAt }
 * SMS yoqilgan va bemor rozi boʻlsa SmsLog(PENDING, APPOINTMENT_CONFIRM) yoziladi (`smsQueued`).
 */
export const POST = withAuth({ permission: 'appointments.write' }, async ({ user, clinicId, req, ip }) => {
  const body = await parseBody(req, CreateAppointmentSchema);
  const { appointment, smsQueued } = await createAppointment({ clinicId, userId: user.id, ip }, body);
  return created({ ...appointment, smsQueued });
});
