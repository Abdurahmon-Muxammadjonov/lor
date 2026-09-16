import { api } from '@/lib/api/client';
import { toPrinterError } from '@/lib/printer/errors';
import { bytesToBase64 } from '@/lib/printer/base64';
import { printTicket, printViaBrowser } from '@/lib/printer/print';
import { buildTicket } from '@/lib/printer/templates/ticket';
import type { PrintResult, TicketData } from '@/lib/printer/types';
import type { PrinterSettings } from '@/lib/settings/types';

/**
 * Kiosk chop etish (client, sessiyasiz).
 * NETWORK transport: baytlar `POST /api/kiosk/print {key, bytesBase64}` orqali (ochiq endpoint, kalit bilan) —
 * `/api/print/raw` sessiya talab qiladi, kioskda esa sessiya yoʻq. Xato boʻlsa brauzer (iframe) zaxirasi.
 * Boshqa transportlar — printer kutubxonasining oddiy oqimi.
 */
export const KIOSK_PRINT_ENDPOINT = '/api/kiosk/print';

export async function kioskPrintTicket(data: TicketData, settings: PrinterSettings, key: string, fallbackUrl: string): Promise<PrintResult> {
  if (settings.transport !== 'NETWORK') return printTicket(data, settings, fallbackUrl);

  let bytes: Uint8Array;
  try {
    bytes = buildTicket(data, settings);
  } catch (e) {
    const err = toPrinterError(e, 'UNKNOWN');
    return { ok: false, transport: 'NETWORK', error: err.message, errorCode: err.code };
  }
  try {
    await api.post<{ sent: number; elapsedMs: number }>(KIOSK_PRINT_ENDPOINT, { key, bytesBase64: bytesToBase64(bytes) });
    return { ok: true, transport: 'NETWORK' };
  } catch (e) {
    const err = toPrinterError(e, 'NETWORK_FAILED');
    if (!fallbackUrl) return { ok: false, transport: 'NETWORK', error: err.message, errorCode: err.code };
    const fb = await printViaBrowser(fallbackUrl);
    return {
      ...fb,
      fallback: true,
      error: fb.ok ? err.message : `${err.message}; ${fb.error ?? ''}`,
      errorCode: fb.ok ? err.code : fb.errorCode,
    };
  }
}
