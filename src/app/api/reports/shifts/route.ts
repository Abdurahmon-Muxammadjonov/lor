import { withAuth, ok, parseQuery } from '@/lib/api';
import { ReportQuerySchema } from '@/lib/reports/schemas';
import { shifts } from '@/lib/reports/queries';
import { assertReportAccess } from '@/lib/reports/api';

export const dynamic = 'force-dynamic';

/** GET /api/reports/shifts?from&to — kassa smenalari (reports.view) */
export const GET = withAuth({ permission: 'reports.view' }, async ({ user, clinicId, req }) => {
  assertReportAccess(user.role, 'shifts');
  const q = parseQuery(req, ReportQuerySchema);
  return ok(await shifts(clinicId, q));
});
