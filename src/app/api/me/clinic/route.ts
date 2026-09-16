import { ok, withAuth } from '@/lib/api';
import { getMeClinic } from '@/lib/dashboard/me';

export const dynamic = 'force-dynamic';

/** GET /api/me/clinic → { id, name, slug, plan, phone, kioskKey (ADMIN/RECEPTION), settings.queue } */
export const GET = withAuth({}, async ({ user, clinicId }) => {
  const clinic = await getMeClinic(clinicId, user.role);
  return ok(clinic, { headers: { 'Cache-Control': 'no-store' } });
});
