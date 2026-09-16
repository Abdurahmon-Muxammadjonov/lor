import { withAuth, ok, parseQuery } from '@/lib/api';
import { PatientSearchQuery } from '@/lib/patients/schemas';
import { searchPatients } from '@/lib/patients/service';

export const dynamic = 'force-dynamic';

/** GET /api/patients/search?q=&limit=8 — tez qidiruv (paletka, pickerlar) */
export const GET = withAuth({ permission: 'patients.view' }, async ({ clinicId, req }) => {
  const { q, limit } = parseQuery(req, PatientSearchQuery);
  const items = await searchPatients(clinicId, q, limit);
  return ok({ items });
});
