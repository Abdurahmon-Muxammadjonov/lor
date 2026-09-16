import type { PrinterErrorCode } from './types';

/** Printer transportlari tashlaydigan yagona xato turi. `code` — lokalizatsiya uchun. */
export class PrinterError extends Error {
  constructor(
    public readonly code: PrinterErrorCode,
    message?: string,
    cause?: unknown,
  ) {
    super(message ?? code, cause !== undefined ? { cause } : undefined);
    this.name = 'PrinterError';
  }
}

export function isPrinterError(e: unknown): e is PrinterError {
  return e instanceof PrinterError || (!!e && typeof e === 'object' && (e as { name?: unknown }).name === 'PrinterError');
}

/** Ixtiyoriy xatoni PrinterError ga oʻgiradi (kodi yoʻq boʻlsa `fallbackCode`). */
export function toPrinterError(e: unknown, fallbackCode: PrinterErrorCode): PrinterError {
  if (e instanceof PrinterError) return e;
  if (e instanceof Error) return new PrinterError(fallbackCode, e.message, e);
  if (typeof e === 'string') return new PrinterError(fallbackCode, e);
  return new PrinterError(fallbackCode, undefined, e);
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return String(e);
}
