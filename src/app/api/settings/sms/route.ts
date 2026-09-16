import { withAuth, ok, parseBody } from '@/lib/api';
import { SmsPatchSchema, type SmsSettingsDTO } from '@/lib/settings/schemas';
import { getSection, updateSection } from '@/lib/settings/service';
import { isEskizConfigured } from '@/lib/integrations/eskiz';

export const dynamic = 'force-dynamic';

/** GET /api/settings/sms — SMS boʻlimi + Eskiz sozlanganligi (env) */
export const GET = withAuth({ permission: 'settings.view' }, async ({ clinicId }) => {
  const sms = await getSection(clinicId, 'sms');
  const dto: SmsSettingsDTO = { sms, configured: isEskizConfigured() };
  return ok(dto);
});

/** PATCH /api/settings/sms */
export const PATCH = withAuth({ permission: 'settings.write' }, async ({ user, clinicId, req, ip }) => {
  const body = await parseBody(req, SmsPatchSchema);
  const sms = await updateSection(clinicId, 'sms', body, { user, ip, userAgent: req.headers.get('user-agent') });
  const dto: SmsSettingsDTO = { sms, configured: isEskizConfigured() };
  return ok(dto);
});
