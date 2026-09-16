import { prisma } from '@/lib/prisma';
import { ApiError } from '@/lib/api/errors';
import { parseClinicSettings, type PrinterSettings } from '@/lib/settings/types';
import { base64ToBytes } from './base64';
import { PrinterError, toPrinterError } from './errors';
import { sendToNetworkPrinter, type SendToNetworkPrinterResult } from './network-server';

/**
 * FAQAT SERVER (API route ichida). `POST /api/print/raw` ([queue] moduli) uchun tayyor yordamchilar:
 *
 *   const body = await parseBody(req, PrintRawBodySchema);
 *   try { return ok(await sendRawToClinicPrinter(clinicId, body.bytesBase64)); }
 *   catch (e) { throw printerErrorToApiError(e); }
 *
 * Printer manzili faqat klinika sozlamalaridan olinadi (mijoz host/port yubora olmaydi).
 */

/** Klinika printer sozlamalari (DB dan, defaultlar bilan) */
export async function loadClinicPrinterSettings(clinicId: string): Promise<PrinterSettings> {
  const clinic = await prisma.clinic.findFirst({ where: { id: clinicId }, select: { settings: true } });
  if (!clinic) throw ApiError.notFound('Klinika topilmadi');
  return parseClinicSettings(clinic.settings).printer;
}

/** base64 ESC/POS baytlarni klinikaning tarmoq printeriga (settings.printer.host:port) yuboradi */
export async function sendRawToClinicPrinter(
  clinicId: string,
  bytesBase64: string,
  timeoutMs = 5000,
): Promise<SendToNetworkPrinterResult> {
  const printer = await loadClinicPrinterSettings(clinicId);
  if (!printer.host.trim()) throw new PrinterError('NETWORK_NOT_CONFIGURED', 'printer host is empty');
  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(bytesBase64);
  } catch (e) {
    throw new PrinterError('NETWORK_FAILED', 'invalid base64 payload', e);
  }
  return sendToNetworkPrinter(printer.host, printer.port, bytes, timeoutMs);
}

const STATUS_BY_CODE: Partial<Record<PrinterError['code'], number>> = {
  NETWORK_NOT_CONFIGURED: 400,
  NETWORK_TIMEOUT: 504,
  NETWORK_FAILED: 502,
};

/** PrinterError → ApiError(PRINTER_ERROR, details: { code }) ; boshqa xatolar oʻzgarishsiz (ApiError) yoki 502 */
export function printerErrorToApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  const err = toPrinterError(e, 'NETWORK_FAILED');
  return new ApiError(STATUS_BY_CODE[err.code] ?? 502, 'PRINTER_ERROR', err.message, { code: err.code });
}
