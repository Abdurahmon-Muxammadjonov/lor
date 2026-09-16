import { withAuth, ok, parseQuery } from '@/lib/api';
import { ReportQuerySchema } from '@/lib/reports/schemas';
import { medicine } from '@/lib/reports/queries';
import { assertReportAccess } from '@/lib/reports/api';

export const dynamic = 'force-dynamic';

/** GET /api/reports/medicine?from&to&doctorId — dori bilan / dorisiz (reports.view, CASHIER emas) */
export const GET = withAuth({ permission: 'reports.view' }, async ({ user, clinicId, req }) => {
  assertReportAccess(user.role, 'medicine');
  const q = parseQuery(req, ReportQuerySchema);
  return ok(await medicine(clinicId, q));
});
