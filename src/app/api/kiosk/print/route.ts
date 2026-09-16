import { withPublic, ok, parseBody } from '@/lib/api';
import { KioskPrintSchema } from '@/lib/queue/schemas';
import { requireClinicByKioskKey } from '@/lib/queue/service';
import { printerErrorToApiError, sendRawToClinicPrinter } from '@/lib/printer/print-server';
import { enforceKioskRateLimit } from '../_lib';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** POST /api/kiosk/print {key, bytesBase64} — kioskdan klinikaning tarmoq printeriga (sessiyasiz, kalit bilan) */
export const POST = withPublic(async ({ req, ip }) => {
  enforceKioskRateLimit(ip, 'print');
  const body = await parseBody(req, KioskPrintSchema);
  const clinic = await requireClinicByKioskKey(body.key);
  try {
    return ok(await sendRawToClinicPrinter(clinic.id, body.bytesBase64));
  } catch (e) {
    throw printerErrorToApiError(e);
  }
});
