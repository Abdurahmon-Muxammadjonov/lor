import { withAuth, ok, parseQuery } from '@/lib/api';
import { GroupedQuerySchema } from '@/lib/reports/schemas';
import { revenue } from '@/lib/reports/queries';
import { assertReportAccess } from '@/lib/reports/api';

export const dynamic = 'force-dynamic';

/** GET /api/reports/revenue?from&to&groupBy&doctorId — davrlar boʻyicha tushum (reports.view) */
export const GET = withAuth({ permission: 'reports.view' }, async ({ user, clinicId, req }) => {
  assertReportAccess(user.role, 'revenue');
  const q = parseQuery(req, GroupedQuerySchema);
  return ok(await revenue(clinicId, q, q.groupBy));
});
