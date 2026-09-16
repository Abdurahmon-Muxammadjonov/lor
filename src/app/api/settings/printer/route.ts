import type { NextRequest } from 'next/server';
import { withAuth, withPublic, ok, parseBody, ApiError } from '@/lib/api';
import { PrinterPatchSchema } from '@/lib/settings/schemas';
import { findClinicByKioskKey, getSection, updateSection } from '@/lib/settings/service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/settings/printer — faqat printer boʻlimi.
 *  - sessiya bilan: queue.view (RECEPTION/CASHIER/DOCTOR ham oʻqiy oladi)
 *  - `?key=<kioskKey>` bilan: kiosk/tablo (sessiyasiz) — ochiq, faqat printer boʻlimi qaytadi
 */
const getWithSession = withAuth({ permission: 'queue.view' }, async ({ clinicId }) => ok(await getSection(clinicId, 'printer')));

const getWithKey = withPublic(async ({ req }) => {
  const key = req.nextUrl.searchParams.get('key') ?? '';
  const clinic = await findClinicByKioskKey(key);
  if (!clinic) throw ApiError.notFound('Kiosk kaliti notoʻgʻri');
  return ok(clinic.settings.printer);
});

export async function GET(req: NextRequest): Promise<Response> {
  if (req.nextUrl.searchParams.get('key')) return getWithKey(req);
  return getWithSession(req);
}

/** PATCH /api/settings/printer — settings.write, audit SETTINGS */
export const PATCH = withAuth({ permission: 'settings.write' }, async ({ user, clinicId, req, ip }) => {
  const body = await parseBody(req, PrinterPatchSchema);
  return ok(await updateSection(clinicId, 'printer', body, { user, ip, userAgent: req.headers.get('user-agent') }));
});
