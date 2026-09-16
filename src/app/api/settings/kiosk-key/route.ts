import { withAuth, ok } from '@/lib/api';
import { regenerateKioskKey } from '@/lib/settings/service';

export const dynamic = 'force-dynamic';

/** POST /api/settings/kiosk-key — yangi kiosk/tablo kaliti (eski havolalar ishlamay qoladi) */
export const POST = withAuth({ permission: 'settings.write' }, async ({ user, clinicId, req, ip }) => {
  const origin = (process.env.APP_URL ?? '').trim().replace(/\/+$/, '') || req.nextUrl.origin;
  return ok(await regenerateKioskKey(clinicId, { user, ip, userAgent: req.headers.get('user-agent') }, origin));
});
