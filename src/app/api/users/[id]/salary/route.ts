import { z } from 'zod';
import { withAuth, ok, parseQuery, ApiError } from '@/lib/api';
import { can } from '@/lib/permissions';
import { SalaryQuerySchema } from '@/lib/staff/schemas';
import { salaryReport } from '@/lib/staff/service';

export const dynamic = 'force-dynamic';

type P = { id: string };

const Query = SalaryQuerySchema.pick({ month: true }).extend({ doctorId: z.never().optional() });

/** GET /api/users/[id]/salary?month=YYYY-MM — bitta shifokor ish haqi (ADMIN yoki oʻzi) */
export const GET = withAuth<P>({ permission: 'staff.view' }, async ({ user, clinicId, params, req }) => {
  if (!(can(user.role, 'reports.full') || user.id === params.id)) throw ApiError.forbidden();
  const q = parseQuery(req, Query);
  const report = await salaryReport(clinicId, q.month, params.id);
  const item = report.doctors[0];
  if (!item) throw ApiError.notFound('staff.errors.notFound');
  return ok({ month: report.month, from: report.from, to: report.to, item });
});
