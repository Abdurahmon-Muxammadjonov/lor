import { withAuth, ok, parseQuery } from '@/lib/api';
import { DebtorsQuerySchema } from '@/lib/reports/schemas';
import { debtors } from '@/lib/reports/queries';
import { assertReportAccess } from '@/lib/reports/api';

export const dynamic = 'force-dynamic';

/** GET /api/reports/debtors?from&to&doctorId&all=1 — qarzdorlar (reports.view) */
export const GET = withAuth({ permission: 'reports.view' }, async ({ user, clinicId, req }) => {
  assertReportAccess(user.role, 'debtors');
  const q = parseQuery(req, DebtorsQuerySchema);
  return ok(await debtors(clinicId, q, q.all));
});
