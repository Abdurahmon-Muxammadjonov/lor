import { withAuth, ok, created, parseBody, parseQuery } from '@/lib/api';
import { PatientListQuery, PatientSchema } from '@/lib/patients/schemas';
import { createPatient, getClinicChildAgeLimit, listPatients } from '@/lib/patients/service';

export const dynamic = 'force-dynamic';

/** GET /api/patients — roʻyxat (qidiruv, filtrlar, saralash, sahifalash) */
export const GET = withAuth({ permission: 'patients.view' }, async ({ clinicId, req }) => {
  const query = parseQuery(req, PatientListQuery);
  const childAgeLimit = await getClinicChildAgeLimit(clinicId);
  const result = await listPatients(clinicId, query, childAgeLimit);
  return ok(result);
});

/** POST /api/patients — yangi bemor (karta raqami avtomatik; takroriy telefon → 409, force=true bilan oʻtadi) */
export const POST = withAuth({ permission: 'patients.write' }, async ({ user, clinicId, req, ip }) => {
  const body = await parseBody(req, PatientSchema);
  const row = await createPatient({ clinicId, userId: user.id, ip }, body);
  return created(row);
});
