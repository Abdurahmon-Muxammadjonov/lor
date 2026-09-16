import { withAuth, ok, parseBody, ApiError } from '@/lib/api';
import { PatientPatchSchema } from '@/lib/patients/schemas';
import { deletePatient, getClinicChildAgeLimit, getPatient, updatePatient } from '@/lib/patients/service';

export const dynamic = 'force-dynamic';

/** GET /api/patients/[id] — bemor kartasi + agregatlar */
export const GET = withAuth<{ id: string }>({ permission: 'patients.view' }, async ({ clinicId, params }) => {
  const childAgeLimit = await getClinicChildAgeLimit(clinicId);
  const patient = await getPatient(clinicId, params.id, childAgeLimit);
  if (!patient) throw ApiError.notFound('Bemor topilmadi');
  return ok(patient);
});

/** PATCH /api/patients/[id] — tahrirlash (audit UPDATE before/after) */
export const PATCH = withAuth<{ id: string }>(
  { permission: 'patients.write' },
  async ({ user, clinicId, req, ip, params }) => {
    const body = await parseBody(req, PatientPatchSchema);
    const row = await updatePatient({ clinicId, userId: user.id, ip }, params.id, body);
    return ok(row);
  },
);

/** DELETE /api/patients/[id] — faqat ADMIN; tashriflari boʻlsa 409 */
export const DELETE = withAuth<{ id: string }>(
  { permission: 'patients.delete' },
  async ({ user, clinicId, ip, params }) => {
    const result = await deletePatient({ clinicId, userId: user.id, ip }, params.id);
    return ok(result);
  },
);
