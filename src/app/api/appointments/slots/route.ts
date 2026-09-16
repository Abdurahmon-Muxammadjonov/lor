import { withAuth, ok, parseQuery } from '@/lib/api';
import { SlotsQuerySchema } from '@/lib/appointments/schemas';
import { getFreeSlots } from '@/lib/appointments/service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/appointments/slots?doctorId&date=YYYY-MM-DD&durationMin?&excludeId?
 * → { doctorId, date, slotMinutes, durationMin, day, slots: [{ time, startAt, endAt, available, reason? }] }
 */
export const GET = withAuth({ permission: 'appointments.view' }, async ({ clinicId, req }) => {
  const q = parseQuery(req, SlotsQuerySchema);
  return ok(await getFreeSlots(clinicId, q));
});
