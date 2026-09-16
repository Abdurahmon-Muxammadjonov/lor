import { withAuth, ok, parseQuery } from '@/lib/api';
import { ReportQuerySchema } from '@/lib/reports/schemas';
import { doctors } from '@/lib/reports/queries';
import { assertReportAccess } from '@/lib/reports/api';

export const dynamic = 'force-dynamic';

/** GET /api/reports/doctors?from&to&doctorId — shifokorlar va maoshlar (reports.full) */
export const GET = withAuth({ permission: 'reports.view' }, async ({ user, clinicId, req }) => {
  assertReportAccess(user.role, 'doctors');
  const q = parseQuery(req, ReportQuerySchema);
  return ok(await doctors(clinicId, q));
});
