import { withAuth, ok, parseQuery } from '@/lib/api';
import { ReportQuerySchema } from '@/lib/reports/schemas';
import { services } from '@/lib/reports/queries';
import { assertReportAccess } from '@/lib/reports/api';

export const dynamic = 'force-dynamic';

/** GET /api/reports/services?from&to&doctorId — muolajalar boʻyicha (reports.view, CASHIER emas) */
export const GET = withAuth({ permission: 'reports.view' }, async ({ user, clinicId, req }) => {
  assertReportAccess(user.role, 'services');
  const q = parseQuery(req, ReportQuerySchema);
  return ok(await services(clinicId, q));
});
