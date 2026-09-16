import { ok, withAuth } from '@/lib/api';
import { getTodaySummary } from '@/lib/dashboard/stats';

export const dynamic = 'force-dynamic';

/** GET /api/dashboard/today → { revenue, visits, waiting, appointments: keyingi 8 ta } (DOCTOR — faqat oʻziniki) */
export const GET = withAuth({ permission: 'dashboard.view' }, async ({ user, clinicId }) => {
  const doctorId = user.role === 'DOCTOR' ? user.id : null;
  const data = await getTodaySummary(clinicId, doctorId);
  return ok(data, { headers: { 'Cache-Control': 'no-store' } });
});
