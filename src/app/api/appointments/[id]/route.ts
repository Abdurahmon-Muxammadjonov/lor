import { withAuth, ok, parseBody } from '@/lib/api';
import { UpdateAppointmentSchema } from '@/lib/appointments/schemas';
import { deleteAppointment, getAppointment, updateAppointment } from '@/lib/appointments/service';

export const dynamic = 'force-dynamic';

type Params = { id: string };

/** GET /api/appointments/[id] → appointment (404 boshqa klinika) */
export const GET = withAuth<Params>({ permission: 'appointments.view' }, async ({ clinicId, params }) => {
  return ok(await getAppointment(clinicId, params.id));
});

/**
 * PATCH /api/appointments/[id] { startAt?, doctorId?, durationMin?, note? } → appointment
 * Vaqt/shifokor oʻzgarsa mavjudlik qayta tekshiriladi (400 VALIDATION reason / 409 CONFLICT OVERLAP).
 * 409 CONFLICT { reason: 'LOCKED' } — ARRIVED/DONE/CANCELLED/NO_SHOW holatida koʻchirib boʻlmaydi.
 */
export const PATCH = withAuth<Params>(
  { permission: 'appointments.write' },
  async ({ user, clinicId, req, params, ip }) => {
    const body = await parseBody(req, UpdateAppointmentSchema);
    const { appointment, smsQueued } = await updateAppointment(
      { clinicId, userId: user.id, ip },
      params.id,
      body,
    );
    return ok({ ...appointment, smsQueued });
  },
);

/** DELETE /api/appointments/[id] — faqat SCHEDULED (409 CONFLICT { reason: 'STATUS' | 'HAS_VISIT' }) */
export const DELETE = withAuth<Params>(
  { permission: 'appointments.write' },
  async ({ user, clinicId, params, ip }) => {
    await deleteAppointment({ clinicId, userId: user.id, ip }, params.id);
    return ok({ id: params.id, deleted: true });
  },
);
