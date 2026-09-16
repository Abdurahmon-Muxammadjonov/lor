import type { PrinterTransport } from '@/lib/settings/types';
import type { Locale } from '@/i18n/config';

/**
 * Termal printer kutubxonasi tiplari.
 * Pul maydonlari — butun soʻm (API JSON bilan bir xil), matnlar — tayyor (lokalizatsiya qilingan) satrlar.
 */

/** Navbat taloni */
export interface TicketData {
  clinicName: string;
  phone: string;
  /** "A-012" */
  number: string;
  /** Xizmat turi nomi (masalan "Shifokor qabuli") */
  service: string;
  /** 15.09.2026 */
  date: string;
  /** 14:32 */
  time: string;
  /** Oldinda kutayotganlar soni */
  ahead: number;
  /** Taxminiy kutish (daqiqa) */
  waitMin: number;
  footer: string;
  /** Katta harflar bilan logotip oʻrnida chiqadigan qisqa matn (masalan "LOR") */
  logoText?: string;
  room?: string;
  /** Talon tili (default: uz) */
  locale?: Locale;
}

export interface ReceiptLine {
  name: string;
  /** 0.5 qadam */
  qty: number;
  /** "ta", "seans", "kun" … */
  unit: string;
  /** Butun soʻm */
  unitPrice: number;
  /** Butun soʻm (chegirmadan keyingi qator jami) */
  total: number;
  /** 'LEFT' | 'RIGHT' | 'BOTH' yoki tayyor matn */
  side?: string | null;
  /** 'EAR' | 'NOSE' | 'THROAT' | 'LARYNX' | 'OTHER' yoki tayyor matn */
  organ?: string | null;
}

/** Kassa cheki */
export interface ReceiptData {
  clinicName: string;
  phone: string;
  address?: string;
  receiptNo: string;
  patientName: string;
  cardNumber: string;
  doctor: string;
  lines: ReceiptLine[];
  /** Butun soʻm */
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  /** total − paid (musbat = qarz) */
  balance: number;
  cashier: string;
  /** 15.09.2026 14:32 */
  dateTime: string;
  /** QR ichidagi matn (havola); settings.receiptQr=true boʻlsa chiqadi */
  qrText?: string;
  footer: string;
  locale: Locale;
}

export type PrinterErrorCode =
  | 'NOT_IN_BROWSER'
  | 'WEBUSB_UNSUPPORTED'
  | 'NO_DEVICE'
  | 'DEVICE_OPEN_FAILED'
  | 'NO_ENDPOINT'
  | 'WRITE_FAILED'
  | 'QZ_LOAD_FAILED'
  | 'QZ_CONNECT_FAILED'
  | 'QZ_PRINTER_NOT_FOUND'
  | 'QZ_PRINT_FAILED'
  | 'NETWORK_NOT_CONFIGURED'
  | 'NETWORK_TIMEOUT'
  | 'NETWORK_FAILED'
  | 'BROWSER_FAILED'
  | 'BROWSER_TIMEOUT'
  | 'NO_RAW_TRANSPORT'
  | 'NO_FALLBACK_URL'
  | 'UNKNOWN';

export interface PrintResult {
  ok: boolean;
  /** Natijani bergan transport (fallback boʻlsa — BROWSER) */
  transport: PrinterTransport;
  /** Xato tafsiloti (texnik matn). fallback=true va ok=true boʻlsa — asl transport xatosi */
  error?: string;
  /** Lokalizatsiya uchun xato kodi */
  errorCode?: PrinterErrorCode;
  /** Brauzer (iframe + window.print) orqali chop etildi */
  fallback?: boolean;
}

export type PrinterStatus = 'idle' | 'printing' | 'ok' | 'fallback' | 'error';

export type Codepage = 'CP866' | 'CP1251' | 'ASCII';
export type PaperWidthMm = 58 | 80;
export type TextAlign = 'left' | 'center' | 'right';
