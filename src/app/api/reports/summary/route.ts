import { withAuth, ok, parseQuery } from '@/lib/api';
import { ReportQuerySchema } from '@/lib/reports/schemas';
import { summary } from '@/lib/reports/queries';

export const dynamic = 'force-dynamic';

/** GET /api/reports/summary?from&to&doctorId — KPI koʻrsatkichlari (reports.view) */
export const GET = withAuth({ permission: 'reports.view' }, async ({ clinicId, req }) => {
  const q = parseQuery(req, ReportQuerySchema);
  return ok(await summary(clinicId, q));
});
