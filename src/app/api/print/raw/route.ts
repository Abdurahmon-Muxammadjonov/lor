import { withAuth, ok, parseBody } from '@/lib/api';
import { PrintRawBodySchema } from '@/lib/printer/schemas';
import { printerErrorToApiError, sendRawToClinicPrinter } from '@/lib/printer/print-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/print/raw {bytesBase64} — xom ESC/POS baytlarni klinikaning tarmoq printeriga (settings.printer.host:port).
 * Manzil faqat klinika sozlamalaridan olinadi (mijoz host/port yubora olmaydi). Javob: {sent, elapsedMs}.
 */
export const POST = withAuth({ permission: 'queue.view' }, async ({ clinicId, req }) => {
  const body = await parseBody(req, PrintRawBodySchema);
  try {
    return ok(await sendRawToClinicPrinter(clinicId, body.bytesBase64));
  } catch (e) {
    throw printerErrorToApiError(e);
  }
});
