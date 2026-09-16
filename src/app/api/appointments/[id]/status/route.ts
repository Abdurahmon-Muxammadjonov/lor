import { withAuth, ok, parseBody } from '@/lib/api';
import { AppointmentStatusSchema } from '@/lib/appointments/schemas';
import { setAppointmentStatus } from '@/lib/appointments/service';

export const dynamic = 'force-dynamic';

type Params = { id: string };

/**
 * POST /api/appointments/[id]/status { status } → appointment
 * Ruxsat etilgan oʻtishlar: STATUS_TRANSITIONS (src/lib/appointments/availability.ts);
 * 409 CONFLICT { reason: 'TRANSITION', from, to }. Bekor qilingan yozilishni tiklashda kesishuv tekshiriladi.
 *
 * ARRIVED: server faqat holatni saqlaydi. Navbat talonini client yaratadi —
 * `POST /api/queue { type: 'DOCTOR', patientId, doctorId }` ([queue] moduli) va raqamni koʻrsatadi.
 */
export const POST = withAuth<Params>(
  { permission: 'appointments.write' },
  async ({ user, clinicId, req, params, ip }) => {
    const { status } = await parseBody(req, AppointmentStatusSchema);
    return ok(await setAppointmentStatus({ clinicId, userId: user.id, ip }, params.id, status));
  },
);
