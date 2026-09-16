import { withAuth, ok, parseQuery } from '@/lib/api';
import { SalaryQuerySchema } from '@/lib/staff/schemas';
import { salaryReport } from '@/lib/staff/service';

export const dynamic = 'force-dynamic';

/** GET /api/users/salary?month=YYYY-MM&doctorId= — barcha shifokorlar boʻyicha ish haqi (ADMIN) */
export const GET = withAuth({ permission: 'reports.full' }, async ({ clinicId, req }) => {
  const q = parseQuery(req, SalaryQuerySchema);
  return ok(await salaryReport(clinicId, q.month, q.doctorId));
});
