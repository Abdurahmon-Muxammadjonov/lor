import { withAuth, ok, parseQuery } from '@/lib/api';
import { GroupedQuerySchema } from '@/lib/reports/schemas';
import { patientTypes } from '@/lib/reports/queries';
import { assertReportAccess } from '@/lib/reports/api';

export const dynamic = 'force-dynamic';

/** GET /api/reports/patient-types?from&to&groupBy&doctorId — kattalar / bolalar (reports.view, CASHIER emas) */
export const GET = withAuth({ permission: 'reports.view' }, async ({ user, clinicId, req }) => {
  assertReportAccess(user.role, 'patient-types');
  const q = parseQuery(req, GroupedQuerySchema);
  return ok(await patientTypes(clinicId, q, q.groupBy));
});
