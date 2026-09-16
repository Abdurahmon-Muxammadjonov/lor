import { withAuth, ok } from '@/lib/api';
import { getPatientAppointments } from '@/lib/patients/service';

export const dynamic = 'force-dynamic';

/** GET /api/patients/[id]/appointments — kelgusi va oʻtgan yozilishlar */
export const GET = withAuth<{ id: string }>({ permission: 'patients.view' }, async ({ clinicId, params }) => {
  const result = await getPatientAppointments(clinicId, params.id);
  return ok(result);
});
