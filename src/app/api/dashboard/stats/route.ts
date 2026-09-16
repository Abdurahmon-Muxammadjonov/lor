import { ok, parseQuery, withAuth } from '@/lib/api';
import { getDashboardStats } from '@/lib/dashboard/stats';
import { StatsQuerySchema } from '@/lib/dashboard/schemas';

export const dynamic = 'force-dynamic';

/**
 * GET /api/dashboard/stats?range=7|30|90&doctorId=
 * DOCTOR roli uchun doctorId doim oʻzi (soʻrovdagi qiymat eʼtiborga olinmaydi).
 */
export const GET = withAuth({ permission: 'dashboard.view' }, async ({ user, clinicId, req }) => {
  const q = parseQuery(req, StatsQuerySchema);
  const doctorId = user.role === 'DOCTOR' ? user.id : (q.doctorId ?? null);
  const data = await getDashboardStats(clinicId, { range: q.range, doctorId });
  return ok(data);
});
