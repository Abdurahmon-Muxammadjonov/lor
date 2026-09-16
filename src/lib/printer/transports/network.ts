import { ApiClientError, api } from '@/lib/api/client';
import { bytesToBase64 } from '../base64';
import { PrinterError, errorMessage } from '../errors';
import type { PrintRawBody } from '../schemas';

/**
 * NETWORK transport (brauzer tomoni): xom ESC/POS baytlarni `POST /api/print/raw { bytesBase64 }` ga yuboradi,
 * server (navbat modulining route-i) ularni `sendToNetworkPrinter(host, port, bytes)` (`network-server.ts`)
 * orqali klinika sozlamalaridagi IP:port (odatda 9100) ga TCP bilan uzatadi.
 *
 * Printer IP/port serverdagi klinika sozlamalaridan olinadi — mijoz ularni yubormaydi (xavfsizlik: ixtiyoriy
 * hostga ulanishga yoʻl qoʻymaslik). Route javobi: `{ ok: true, data: { sent: number } }`.
 */

export const PRINT_RAW_ENDPOINT = '/api/print/raw';

export interface NetworkPrintResponse {
  /** Yuborilgan baytlar soni */
  sent?: number;
}

export class NetworkTransport {
  constructor(private readonly endpoint: string = PRINT_RAW_ENDPOINT) {}

  /** Bayt massivini serverga yuboradi; server xatolarini `PrinterError` ga oʻgiradi */
  async print(bytes: Uint8Array): Promise<NetworkPrintResponse> {
    if (typeof fetch === 'undefined') throw new PrinterError('NOT_IN_BROWSER');
    if (bytes.length === 0) return { sent: 0 };
    const body: PrintRawBody = { bytesBase64: bytesToBase64(bytes) };
    try {
      const data = await api.post<NetworkPrintResponse | null>(this.endpoint, body);
      return data ?? { sent: bytes.length };
    } catch (e) {
      throw networkErrorFromApi(e);
    }
  }
}

/** Server xato kodlari → PrinterError (route `ApiError(code)` bilan javob beradi) */
export function networkErrorFromApi(e: unknown): PrinterError {
  if (e instanceof PrinterError) return e;
  if (e instanceof ApiClientError) {
    // Server (`printerErrorToApiError`) → { code: 'PRINTER_ERROR', details: { code: PrinterErrorCode } }
    const detail = e.details && typeof e.details === 'object' ? (e.details as { code?: unknown }).code : undefined;
    const code = String(detail ?? e.code).toUpperCase();
    if (code === 'NETWORK_NOT_CONFIGURED' || code.includes('NOT_CONFIGURED')) {
      return new PrinterError('NETWORK_NOT_CONFIGURED', e.message, e);
    }
    if (code === 'NETWORK_TIMEOUT' || code.includes('TIMEOUT') || e.status === 504) {
      return new PrinterError('NETWORK_TIMEOUT', e.message, e);
    }
    return new PrinterError('NETWORK_FAILED', `${e.code}: ${e.message}`, e);
  }
  if (e instanceof TypeError) {
    // fetch tarmoq xatosi (server yoʻq / oflayn)
    return new PrinterError('NETWORK_FAILED', errorMessage(e), e);
  }
  return new PrinterError('NETWORK_FAILED', errorMessage(e), e);
}
