import { withAuth, ok, parseBody } from '@/lib/api';
import { QueuePatchSchema } from '@/lib/settings/schemas';
import { getSection, updateSection } from '@/lib/settings/service';

export const dynamic = 'force-dynamic';

/** GET /api/settings/queue — navbat/kiosk boʻlimi */
export const GET = withAuth({ permission: 'settings.view' }, async ({ clinicId }) => ok(await getSection(clinicId, 'queue')));

/** PATCH /api/settings/queue */
export const PATCH = withAuth({ permission: 'settings.write' }, async ({ user, clinicId, req, ip }) => {
  const body = await parseBody(req, QueuePatchSchema);
  return ok(await updateSection(clinicId, 'queue', body, { user, ip, userAgent: req.headers.get('user-agent') }));
});
