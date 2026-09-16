import { withAuth, ok } from '@/lib/api';
import { getPatientPayments } from '@/lib/patients/service';

export const dynamic = 'force-dynamic';

/** GET /api/patients/[id]/payments — toʻlovlar tarixi, balans, qabullar boʻyicha qarz */
export const GET = withAuth<{ id: string }>({ permission: 'patients.view' }, async ({ clinicId, params }) => {
  const result = await getPatientPayments(clinicId, params.id);
  return ok(result);
});
