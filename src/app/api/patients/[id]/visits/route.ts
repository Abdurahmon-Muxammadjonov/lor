import { withAuth, ok, parseQuery } from '@/lib/api';
import { PatientVisitsQuery } from '@/lib/patients/schemas';
import { getPatientVisits } from '@/lib/patients/service';

export const dynamic = 'force-dynamic';

/** GET /api/patients/[id]/visits?page=&pageSize= — tashriflar (qatorlar snapshot bilan) + toʻlovlar xulosasi */
export const GET = withAuth<{ id: string }>(
  { permission: 'patients.view' },
  async ({ clinicId, req, params }) => {
    const { page, pageSize } = parseQuery(req, PatientVisitsQuery);
    const result = await getPatientVisits(clinicId, params.id, page, pageSize);
    return ok(result);
  },
);
