import type { PrinterSettings, PrinterTransport } from '@/lib/settings/types';
import { hydratePrinterStore, usePrinterStore } from '@/stores/use-printer-store';
import { PrinterError, errorMessage, toPrinterError } from './errors';
import { EscPos, PAPER_COLUMNS } from './escpos';
import { pm } from './messages';
import { buildReceipt } from './templates/receipt';
import { buildTicket } from './templates/ticket';
import { BrowserPrintTransport } from './transports/browser';
import { NetworkTransport } from './transports/network';
import { QzTransport } from './transports/qz';
import { WebUsbTransport } from './transports/webusb';
import type { PrintResult, ReceiptData, TicketData } from './types';

/**
 * Chop etish orkestratori (faqat brauzerda chaqiriladi).
 *
 *  printBytes(bytes, settings)                 — sozlangan transport (WEBUSB | QZ | NETWORK) orqali xom baytlar
 *  printTicket(data, settings, fallbackUrl)    — talon; xato boʻlsa yoki transport=BROWSER → iframe + window.print()
 *  printReceipt(data, settings, fallbackUrl)   — chek; xuddi shunday
 *  testPrint(settings)                         — qisqa oʻz-oʻzini tekshirish taloni (BROWSER da maʼnosiz → NO_RAW_TRANSPORT)
 *
 * Hech qachon tashlamaydi (throw) — natija `PrintResult` da: { ok, transport, error?, errorCode?, fallback? }.
 * Muvaffaqiyatli xom chop etishdan soʻng `usePrinterStore.lastTransportOk` yangilanadi.
 */

const RAW_TRANSPORTS: ReadonlyArray<PrinterTransport> = ['WEBUSB', 'QZ', 'NETWORK'];

export function isRawTransport(t: PrinterTransport): boolean {
  return RAW_TRANSPORTS.includes(t);
}

/** Xom baytlarni bitta transport orqali yuboradi (xatoni tashlaydi — `printBytes` uni ushlaydi) */
export async function sendRaw(bytes: Uint8Array, settings: PrinterSettings): Promise<void> {
  if (typeof window === 'undefined') throw new PrinterError('NOT_IN_BROWSER');
  switch (settings.transport) {
    case 'WEBUSB':
      await WebUsbTransport.shared().print(bytes);
      return;
    case 'QZ':
      await QzTransport.shared().print(bytes, settings.qzPrinterName);
      return;
    case 'NETWORK':
      if (!settings.host.trim()) throw new PrinterError('NETWORK_NOT_CONFIGURED');
      await new NetworkTransport().print(bytes);
      return;
    case 'BROWSER':
      throw new PrinterError('NO_RAW_TRANSPORT');
    default: {
      const never: never = settings.transport;
      throw new PrinterError('UNKNOWN', `unknown transport ${String(never)}`);
    }
  }
}

/** Sozlangan transport orqali xom baytlar; natija PrintResult (tashlamaydi) */
export async function printBytes(bytes: Uint8Array, settings: PrinterSettings): Promise<PrintResult> {
  const transport = settings.transport;
  hydratePrinterStore();
  try {
    await sendRaw(bytes, settings);
    usePrinterStore.getState().setLastTransportOk(transport);
    return { ok: true, transport };
  } catch (e) {
    const err = toPrinterError(e, 'UNKNOWN');
    usePrinterStore.getState().setLastError(`${err.code}: ${err.message}`);
    return { ok: false, transport, error: err.message, errorCode: err.code };
  }
}

/** Brauzer (iframe) orqali chop etish; natija PrintResult (tashlamaydi) */
export async function printViaBrowser(fallbackUrl: string): Promise<PrintResult> {
  try {
    await new BrowserPrintTransport().openPrintWindow(fallbackUrl);
    usePrinterStore.getState().setLastTransportOk('BROWSER');
    return { ok: true, transport: 'BROWSER' };
  } catch (e) {
    const err = toPrinterError(e, 'BROWSER_FAILED');
    usePrinterStore.getState().setLastError(`${err.code}: ${err.message}`);
    return { ok: false, transport: 'BROWSER', error: err.message, errorCode: err.code };
  }
}

/**
 * Umumiy oqim: xom transport → xato boʻlsa BROWSER zaxira.
 * `build` faqat xom transportda chaqiriladi (BROWSER rejimida baytlar kerak emas).
 */
async function printWithFallback(
  build: () => Uint8Array,
  settings: PrinterSettings,
  fallbackUrl: string,
): Promise<PrintResult> {
  if (isRawTransport(settings.transport)) {
    let bytes: Uint8Array;
    try {
      bytes = build();
    } catch (e) {
      return { ok: false, transport: settings.transport, error: errorMessage(e), errorCode: 'UNKNOWN' };
    }
    const raw = await printBytes(bytes, settings);
    if (raw.ok) return raw;
    if (!fallbackUrl) return raw;
    const fb = await printViaBrowser(fallbackUrl);
    return {
      ...fb,
      fallback: true,
      // Asl (xom) transport xatosi saqlanadi — foydalanuvchiga nima uchun zaxira ishlatilgani koʻrsatiladi
      error: fb.ok ? raw.error : `${raw.error ?? ''}; ${fb.error ?? ''}`.replace(/^; /, ''),
      errorCode: fb.ok ? raw.errorCode : fb.errorCode,
    };
  }
  if (!fallbackUrl) {
    return { ok: false, transport: 'BROWSER', error: 'NO_FALLBACK_URL', errorCode: 'NO_FALLBACK_URL' };
  }
  return printViaBrowser(fallbackUrl);
}

/** Navbat taloni */
export function printTicket(data: TicketData, settings: PrinterSettings, fallbackUrl: string): Promise<PrintResult> {
  return printWithFallback(() => buildTicket(data, settings), settings, fallbackUrl);
}

/** Kassa cheki */
export function printReceipt(data: ReceiptData, settings: PrinterSettings, fallbackUrl: string): Promise<PrintResult> {
  return printWithFallback(() => buildReceipt(data, settings), settings, fallbackUrl);
}

export interface TestPrintOptions {
  locale?: 'uz' | 'ru';
  /** Klinika nomi (sarlavha) */
  clinicName?: string;
  /** Sana/vaqt matni (default — hozir, "15.09.2026 14:32") */
  dateTime?: string;
}

/** "15.09.2026 14:32" — ikkala tilda bir xil format (date-fns kerak emas) */
function defaultDateTime(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Qisqa oʻz-oʻzini tekshirish taloni: sarlavha, sozlamalar, ikki tilli namuna, ustunlar, chiziq, kesish */
export function buildTestTicket(settings: PrinterSettings, opts: TestPrintOptions = {}): Uint8Array {
  const locale = opts.locale ?? 'uz';
  const L = pm(locale).test;
  const p = new EscPos({ paperWidth: settings.paperWidth, codepage: settings.codepage });
  p.init().align('center');
  if (opts.clinicName?.trim()) p.bold(true).paragraph(opts.clinicName.trim()).bold(false);
  p.bold(true).size(2, 2).line(L.title).size(1, 1).bold(false);
  p.hr('=');
  p.align('left');
  p.row(`${L.transport}:`, settings.transport);
  p.row(`${L.paper}:`, `${settings.paperWidth} mm / ${PAPER_COLUMNS[settings.paperWidth]} col`);
  p.row(`${L.codepage}:`, settings.codepage);
  p.hr();
  p.paragraph(L.sampleUz);
  p.paragraph(L.sampleRu);
  p.hr();
  p.row(L.rowLeft, L.rowRight);
  p.row('1234567890', '0987654321');
  p.hr();
  p.align('center');
  p.line(opts.dateTime ?? defaultDateTime());
  p.bold(true).line(L.ok).bold(false);
  p.feed(3);
  if (settings.cut) p.cut(true);
  return p.build();
}

/** Oʻz-oʻzini tekshirish taloni (faqat xom transportlar; BROWSER → NO_RAW_TRANSPORT) */
export async function testPrint(settings: PrinterSettings, opts: TestPrintOptions = {}): Promise<PrintResult> {
  if (!isRawTransport(settings.transport)) {
    return { ok: false, transport: settings.transport, error: 'NO_RAW_TRANSPORT', errorCode: 'NO_RAW_TRANSPORT' };
  }
  return printBytes(buildTestTicket(settings, opts), settings);
}
