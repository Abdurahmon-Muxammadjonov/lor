import { withAuth, ok, parseBody } from '@/lib/api';
import { ClinicProfilePatchSchema } from '@/lib/settings/schemas';
import { getClinicProfile, updateClinicProfile } from '@/lib/settings/service';

export const dynamic = 'force-dynamic';

/** GET /api/settings/clinic — klinika profili (settings.view) */
export const GET = withAuth({ permission: 'settings.view' }, async ({ clinicId }) => ok(await getClinicProfile(clinicId)));

/** PATCH /api/settings/clinic — qisman yangilash (settings.write), audit SETTINGS */
export const PATCH = withAuth({ permission: 'settings.write' }, async ({ user, clinicId, req, ip }) => {
  const body = await parseBody(req, ClinicProfilePatchSchema);
  const profile = await updateClinicProfile(clinicId, body, { user, ip, userAgent: req.headers.get('user-agent') });
  return ok(profile);
});
