import { createServer, type AddressInfo, type Server } from 'node:net';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// zustand persist (usePrinterStore) — Node da localStorage yoʻq; modul yuklanishidan OLDIN xotira shimi
vi.hoisted(() => {
  const mem = new Map<string, string>();
  const shim = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, String(v)),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
    key: (i: number) => Array.from(mem.keys())[i] ?? null,
    get length() {
      return mem.size;
    },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: shim, configurable: true, writable: true });
});

import { PrinterSettingsSchema, type PrinterSettings } from '@/lib/settings/types';
import { base64ToBytes, bytesToBase64 } from '@/lib/printer/base64';
import {
  CODEPAGE_NUMBERS,
  codepageCommand,
  decodeBytes,
  encodeText,
  isEncodable,
  prepareText,
} from '@/lib/printer/encode';
import { EscPos, PAPER_COLUMNS, fitText, padText, wrapText } from '@/lib/printer/escpos';
import { PrinterError, isPrinterError, toPrinterError } from '@/lib/printer/errors';
import { fill, pm, printerErrorText, printerMessages } from '@/lib/printer/messages';
import { isValidPrinterHost, sendToNetworkPrinter } from '@/lib/printer/network-server';
import { buildTestTicket, isRawTransport, printBytes, printReceipt, printTicket, testPrint } from '@/lib/printer/print';
import { PrintRawBodySchema } from '@/lib/printer/schemas';
import { buildReceipt, lineDetail, qtyText, receiptMoney } from '@/lib/printer/templates/receipt';
import { buildTicket } from '@/lib/printer/templates/ticket';
import { networkErrorFromApi } from '@/lib/printer/transports/network';
import { ApiClientError } from '@/lib/api/client';
import { findBulkOutEndpoint } from '@/lib/printer/transports/webusb';
import type { ReceiptData, TicketData } from '@/lib/printer/types';
import { hydratePrinterStore, usePrinterStore } from '@/stores/use-printer-store';

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

const settings58: PrinterSettings = PrinterSettingsSchema.parse({ transport: 'WEBUSB', paperWidth: 58, codepage: 'CP866' });
const settings80: PrinterSettings = PrinterSettingsSchema.parse({ transport: 'NETWORK', paperWidth: 80, codepage: 'CP1251', host: '10.0.0.5' });

const ticket: TicketData = {
  clinicName: 'LOR Klinika',
  phone: '+998 71 200 00 00',
  number: 'A-012',
  service: 'Shifokor qabuli',
  date: '15.09.2026',
  time: '14:32',
  ahead: 3,
  waitMin: 24,
  footer: 'Tashrifingiz uchun rahmat!',
  room: '101',
};

const receipt: ReceiptData = {
  clinicName: 'LOR Klinika',
  phone: '+998 71 200 00 00',
  address: 'Toshkent, Chilonzor 5',
  receiptNo: '20260915-0007',
  patientName: 'Aliyev Vali Gʻanievich',
  cardNumber: 'P-000123',
  doctor: 'Dr. Karimova N.',
  lines: [
    { name: 'Quloq yuvish (dori bilan)', qty: 1.5, unit: 'seans', unitPrice: 120_000, total: 180_000, side: 'LEFT', organ: 'EAR' },
    { name: 'Konsultatsiya', qty: 1, unit: 'ta', unitPrice: 100_000, total: 90_000 },
  ],
  subtotal: 280_000,
  discount: 10_000,
  total: 270_000,
  paid: 200_000,
  balance: 70_000,
  cashier: 'Kassir Dilnoza',
  dateTime: '15.09.2026 14:40',
  qrText: 'https://lor.uz/p/P-000123',
  footer: 'Tashrifingiz uchun rahmat!',
  locale: 'uz',
};

/** Baytlar ichida ketma-ketlik bormi */
function contains(hay: Uint8Array, needle: Uint8Array | number[]): boolean {
  const n = needle instanceof Uint8Array ? needle : Uint8Array.from(needle);
  outer: for (let i = 0; i <= hay.length - n.length; i++) {
    for (let j = 0; j < n.length; j++) if (hay[i + j] !== n[j]) continue outer;
    return true;
  }
  return false;
}

/** ESC/POS buyruqlarini tashlab, faqat matn qatorlarini qaytaradi (QR maʼlumoti ham tashlanadi) */
function lines(bytes: Uint8Array, cp: 'CP866' | 'CP1251' | 'ASCII'): string[] {
  const text: number[] = [];
  for (let i = 0; i < bytes.length; ) {
    const b = bytes[i] ?? 0;
    if (b === ESC) {
      const cmd = bytes[i + 1];
      i += cmd === 0x40 ? 2 : cmd === 0x42 ? 4 : 3; // ESC @ | ESC B n t | ESC x n
      continue;
    }
    if (b === GS) {
      const cmd = bytes[i + 1];
      if (cmd === 0x28) {
        const len = (bytes[i + 3] ?? 0) + ((bytes[i + 4] ?? 0) << 8);
        i += 5 + len; // GS ( k pL pH ...
      } else if (cmd === 0x56) i += 4; // GS V m n
      else i += 3; // GS ! n
      continue;
    }
    text.push(b);
    i++;
  }
  return decodeBytes(Uint8Array.from(text), cp)
    .split('\n')
    .filter(Boolean);
}

// ───────────────────────── encode.ts ─────────────────────────
describe('encode: CP866 / CP1251 / ASCII', () => {
  it('encodes "Навбат" in CP866', () => {
    expect(Array.from(encodeText('Навбат', 'CP866'))).toEqual([0x8d, 0xa0, 0xa2, 0xa1, 0xa0, 0xe2]);
  });

  it('encodes "Навбат" in CP1251', () => {
    expect(Array.from(encodeText('Навбат', 'CP1251'))).toEqual([0xcd, 0xe0, 0xe2, 0xe1, 0xe0, 0xf2]);
  });

  it('maps Ё/ё, Ў/ў and CP1251-only letters', () => {
    expect(Array.from(encodeText('Ёё', 'CP866'))).toEqual([0xf0, 0xf1]);
    expect(Array.from(encodeText('Ёё', 'CP1251'))).toEqual([0xa8, 0xb8]);
    expect(Array.from(encodeText('Ўў', 'CP866'))).toEqual([0xf6, 0xf7]);
    expect(Array.from(encodeText('Ўў', 'CP1251'))).toEqual([0xa1, 0xa2]);
    expect(Array.from(encodeText('№', 'CP1251'))).toEqual([0xb9]);
    expect(Array.from(encodeText('№', 'CP866'))).toEqual([0xfc]);
  });

  it('substitutes Uzbek Cyrillic letters missing from the table (Қ→К, Ғ→Г, Ҳ→Х)', () => {
    expect(Array.from(encodeText('Қ', 'CP1251'))).toEqual([0xca]); // К
    expect(Array.from(encodeText('ғ', 'CP866'))).toEqual([0xa3]); // г
    expect(Array.from(encodeText('Ҳ', 'CP866'))).toEqual([0x95]); // Х
    expect(isEncodable('Қ', 'CP1251')).toBe(false);
    expect(isEncodable('Ў', 'CP1251')).toBe(true);
  });

  it('unmappable characters become "?" and emoji are dropped', () => {
    expect(decodeBytes(encodeText('中文', 'CP866'), 'CP866')).toBe('??');
    expect(decodeBytes(encodeText('a😀b', 'CP1251'), 'CP1251')).toBe('ab');
  });

  it("ASCII fallback: ʻ/ʼ → apostrophe, Oʻ → O', typographic dashes → '-', NBSP → space", () => {
    expect(decodeBytes(encodeText('Oʻzbekiston maʼlumot', 'ASCII'), 'ASCII')).toBe("O'zbekiston ma'lumot");
    expect(prepareText('a b c', 'CP866')).toBe('a b c');
    expect(prepareText('x — y – z − w', 'CP866')).toBe('x - y - z - w');
    expect(prepareText('“quote” «cyr»', 'CP866')).toBe('"quote" "cyr"');
    for (const b of encodeText('Oʻzbek — gʻisht', 'ASCII')) expect(b).toBeLessThan(0x80);
  });

  it('ASCII transliterates Cyrillic', () => {
    expect(decodeBytes(encodeText('Навбат', 'ASCII'), 'ASCII')).toBe('Navbat');
    expect(decodeBytes(encodeText('Чек ЧЕК щука', 'ASCII'), 'ASCII')).toBe('Chek CHEK schuka');
  });

  it('keeps every byte single-width (1 char = 1 byte)', () => {
    const s = 'Kassa cheki №1 — Toʻlov 1 250 000 soʻm';
    expect(encodeText(s, 'CP866').length).toBe(prepareText(s, 'CP866').length);
  });

  it('codepageCommand → ESC t n', () => {
    expect(Array.from(codepageCommand('CP866'))).toEqual([ESC, 0x74, 17]);
    expect(Array.from(codepageCommand('CP1251'))).toEqual([ESC, 0x74, 73]);
    expect(Array.from(codepageCommand('ASCII'))).toEqual([ESC, 0x74, 0]);
    expect(Array.from(codepageCommand('CP1251', 46))).toEqual([ESC, 0x74, 46]);
    expect(CODEPAGE_NUMBERS.CP866).toBe(17);
  });
});

// ───────────────────────── escpos.ts ─────────────────────────
describe('escpos: wrapText / hr / row / table', () => {
  it('wrapText wraps by words and splits long words', () => {
    expect(wrapText('Quloq yuvish dori bilan', 12)).toEqual(['Quloq yuvish', 'dori bilan']);
    expect(wrapText('abcdefghijklmnop', 5)).toEqual(['abcde', 'fghij', 'klmno', 'p']);
    expect(wrapText('a\n\nb', 10)).toEqual(['a', '', 'b']);
    expect(wrapText('', 10)).toEqual(['']);
    expect(wrapText('x', 0)).toEqual(['x']);
    for (const l of wrapText('Lorem ipsum dolor sit amet consectetur adipiscing elit', 7)) expect(l.length).toBeLessThanOrEqual(7);
  });

  it('fitText / padText', () => {
    expect(fitText('abcdef', 4)).toBe('abc.');
    expect(padText('ab', 5, 'right')).toBe('   ab');
    expect(padText('ab', 5, 'center')).toBe(' ab  ');
    expect(padText('ab', 5)).toBe('ab   ');
  });

  it('hr is 32 columns @58mm and 48 @80mm', () => {
    const b58 = new EscPos({ paperWidth: 58, codepage: 'CP866' }).hr().build();
    const b80 = new EscPos({ paperWidth: 80, codepage: 'CP866' }).hr('=').build();
    expect(b58.length).toBe(33); // 32 × '-' + LF
    expect(Array.from(b58.subarray(0, 32)).every((b) => b === 0x2d)).toBe(true);
    expect(b58[32]).toBe(LF);
    expect(b80.length).toBe(49);
    expect(Array.from(b80.subarray(0, 48)).every((b) => b === 0x3d)).toBe(true);
    expect(PAPER_COLUMNS[58]).toBe(32);
    expect(PAPER_COLUMNS[80]).toBe(48);
  });

  it('row justifies two columns to the full width', () => {
    for (const w of [58, 80] as const) {
      const cols = PAPER_COLUMNS[w];
      const out = decodeBytes(new EscPos({ paperWidth: w, codepage: 'CP866' }).row('Jami', '1 250 000').build(), 'CP866');
      expect(out.endsWith('\n')).toBe(true);
      const line = out.slice(0, -1);
      expect(line.length).toBe(cols);
      expect(line.startsWith('Jami')).toBe(true);
      expect(line.endsWith('1 250 000')).toBe(true);
    }
  });

  it('row wraps a long left column and keeps the right column aligned', () => {
    const out = decodeBytes(
      new EscPos({ paperWidth: 58, codepage: 'CP866' }).row('Burun boʻshligʻini yuvish (dori bilan, 2 tomon)', '180 000').build(),
      'CP866',
    ).split('\n');
    const printed = out.filter(Boolean);
    expect(printed.length).toBeGreaterThan(1);
    for (const l of printed) expect(l.length).toBeLessThanOrEqual(32);
    expect(printed[printed.length - 1]?.endsWith('180 000')).toBe(true);
  });

  it('size(2,…) halves the available columns', () => {
    const p = new EscPos({ paperWidth: 58, codepage: 'CP866' });
    expect(p.cols).toBe(32);
    p.size(2, 2);
    expect(p.cols).toBe(16);
    p.size(1, 1);
    expect(p.cols).toBe(32);
  });

  it('table wraps within columns and right-aligns numbers', () => {
    const out = decodeBytes(
      new EscPos({ paperWidth: 80, codepage: 'CP866' })
        .table([
          { text: 'Quloq yuvish dori bilan', width: 10 },
          { text: '1.5 seans', width: 9, align: 'right' },
          { text: '120 000', width: 9, align: 'right' },
        ])
        .build(),
      'CP866',
    )
      .split('\n')
      .filter(Boolean);
    expect(out.length).toBe(3); // "Quloq" / "yuvish" / "dori bilan"
    expect(out[0]).toBe('Quloq      1.5 seans   120 000');
    expect(out[1]?.trimStart()).toBe('yuvish');
  });

  it('emits ESC @ + ESC t on init, GS ! for size, GS V for cut, GS ( k for QR', () => {
    const b = new EscPos({ paperWidth: 58, codepage: 'CP1251' })
      .init()
      .size(3, 3)
      .qr('https://lor.uz')
      .cut(true)
      .beep()
      .build();
    expect(contains(b, [ESC, 0x40, ESC, 0x74, 73])).toBe(true);
    expect(contains(b, [GS, 0x21, 0x22])).toBe(true);
    expect(contains(b, [GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00])).toBe(true);
    expect(contains(b, [GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30])).toBe(true);
    expect(contains(b, [GS, 0x56, 0x42, 0x00])).toBe(true);
    expect(contains(b, [ESC, 0x42])).toBe(true);
  });
});

// ───────────────────────── templates ─────────────────────────
describe('templates: buildTicket / buildReceipt', () => {
  it('ticket contains the ESC t codepage, the number in 3×3 bold and the info rows (uz)', () => {
    const b = buildTicket(ticket, settings58);
    expect(Array.from(b.subarray(0, 5))).toEqual([ESC, 0x40, ESC, 0x74, 17]);
    expect(contains(b, [GS, 0x21, 0x22])).toBe(true); // 3×3
    expect(contains(b, [ESC, 0x45, 0x01])).toBe(true); // bold on
    expect(contains(b, encodeText('A-012', 'CP866'))).toBe(true);
    const txt = lines(b, 'CP866');
    expect(txt).toContain('NAVBAT RAQAMI');
    expect(txt.some((l) => l.startsWith('Xizmat:') && l.endsWith('Shifokor qabuli'))).toBe(true);
    expect(txt.some((l) => l.startsWith('Xona:') && l.endsWith('101'))).toBe(true);
    expect(txt.some((l) => l.startsWith('Sana:') && l.endsWith('15.09.2026'))).toBe(true);
    expect(txt.some((l) => l.startsWith('Vaqt:') && l.endsWith('14:32'))).toBe(true);
    expect(txt.some((l) => l.startsWith('Oldingizda:') && l.endsWith('3 kishi'))).toBe(true);
    expect(txt.some((l) => l.startsWith('Taxminiy kutish:') && l.endsWith('~24 daqiqa'))).toBe(true);
    expect(txt).toContain('Tel: +998 71 200 00 00');
    expect(txt).toContain('Tashrifingiz uchun rahmat!');
    expect(contains(b, [GS, 0x56, 0x42, 0x00])).toBe(true); // cut
  });

  it('ticket in Russian on 80 mm / CP1251, no cut when disabled', () => {
    const b = buildTicket({ ...ticket, locale: 'ru' }, { ...settings80, cut: false });
    expect(Array.from(b.subarray(0, 5))).toEqual([ESC, 0x40, ESC, 0x74, 73]);
    const txt = lines(b, 'CP1251');
    expect(txt).toContain('НОМЕР ОЧЕРЕДИ');
    expect(txt.some((l) => l.startsWith('Перед вами:') && l.endsWith('3 чел.'))).toBe(true);
    expect(txt.some((l) => l.startsWith('Ожидание:') && l.endsWith('~24 мин'))).toBe(true);
    expect(contains(b, [GS, 0x56, 0x42, 0x00])).toBe(false);
    // 80 mm: hr 48 ta
    expect(txt).toContain('-'.repeat(48));
  });

  it('receipt has totals rows, bold total, patient/card/doctor and QR (58 mm)', () => {
    const b = buildReceipt(receipt, settings58);
    const txt = lines(b, 'CP866');
    expect(txt).toContain('KASSA CHEKI');
    expect(txt.some((l) => l.startsWith('Chek №:') && l.endsWith('20260915-0007'))).toBe(true);
    expect(txt.some((l) => l.startsWith('Bemor:') && l.endsWith("Aliyev Vali G'anievich"))).toBe(true);
    expect(txt.some((l) => l.startsWith('Karta:') && l.endsWith('P-000123'))).toBe(true);
    expect(txt.some((l) => l.startsWith('Shifokor:') && l.endsWith('Dr. Karimova N.'))).toBe(true);
    expect(txt).toContain('Quloq yuvish (dori bilan)');
    expect(txt).toContain('  (quloq, chap)');
    expect(txt.some((l) => l.includes('1.5 seans x 120 000') && l.endsWith('180 000'))).toBe(true);
    expect(txt.some((l) => l.startsWith('Jami') && l.endsWith('280 000'))).toBe(true);
    expect(txt.some((l) => l.startsWith('Chegirma') && l.endsWith('-10 000'))).toBe(true);
    expect(txt.some((l) => l.startsWith('JAMI') && l.endsWith("270 000 so'm"))).toBe(true);
    expect(txt.some((l) => l.startsWith("To'langan") && l.endsWith('200 000'))).toBe(true);
    expect(txt.some((l) => l.startsWith('Qarz') && l.endsWith('70 000'))).toBe(true);
    expect(txt.some((l) => l.startsWith('Kassir:') && l.endsWith('Kassir Dilnoza'))).toBe(true);
    expect(txt.some((l) => l.startsWith('Sana:') && l.endsWith('15.09.2026 14:40'))).toBe(true);
    // QR: saqlash buyrugʻi + UTF-8 maʼlumot
    expect(contains(b, [GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30])).toBe(true);
    expect(contains(b, new TextEncoder().encode('https://lor.uz/p/P-000123'))).toBe(true);
    // Qalin JAMI: bold on … bold off atrofida
    expect(contains(b, [ESC, 0x45, 0x01, GS, 0x21, 0x01])).toBe(true);
    for (const l of txt) expect(l.length).toBeLessThanOrEqual(32);
  });

  it('receipt on 80 mm uses a 4-column table, Russian labels, no QR when disabled, overpaid/zero balance', () => {
    const data: ReceiptData = { ...receipt, locale: 'ru', balance: -5_000, paid: 275_000 };
    const b = buildReceipt(data, { ...settings80, receiptQr: false });
    const txt = lines(b, 'CP1251');
    expect(txt).toContain('КАССОВЫЙ ЧЕК');
    expect(txt[txt.indexOf('КАССОВЫЙ ЧЕК') + 1]).toBe('-'.repeat(48));
    expect(txt.some((l) => l.startsWith('Услуга') && l.includes('Кол.') && l.includes('Цена') && l.endsWith('Сумма'))).toBe(true);
    expect(txt.some((l) => l.startsWith('Quloq yuvish (dori') && l.endsWith('180 000'))).toBe(true);
    expect(txt).toContain('  (ухо, слева)');
    expect(txt.some((l) => l.startsWith('ИТОГО') && l.endsWith('270 000 сум'))).toBe(true);
    expect(txt.some((l) => l.startsWith('Переплата') && l.endsWith('5 000'))).toBe(true);
    expect(contains(b, [GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30])).toBe(false);
    for (const l of txt) expect(l.length).toBeLessThanOrEqual(48);

    const zero = lines(buildReceipt({ ...receipt, paid: 270_000, balance: 0, discount: 0 }, settings58), 'CP866');
    expect(zero.some((l) => l.startsWith('Qoldiq') && l.endsWith('0'))).toBe(true);
    expect(zero.some((l) => l.startsWith('Chegirma'))).toBe(false);
  });

  it('receipt helpers', () => {
    expect(receiptMoney(1_250_000)).toBe('1 250 000');
    expect(qtyText({ name: '', qty: 1.5, unit: 'seans', unitPrice: 0, total: 0 })).toBe('1.5 seans');
    expect(qtyText({ name: '', qty: 2, unit: '', unitPrice: 0, total: 0 })).toBe('2');
    expect(lineDetail(pm('ru').receipt, { name: '', qty: 1, unit: '', unitPrice: 0, total: 0, side: 'BOTH', organ: 'NOSE' })).toBe('нос, с обеих сторон');
    expect(lineDetail(pm('uz').receipt, { name: '', qty: 1, unit: '', unitPrice: 0, total: 0, side: 'oʻng', organ: null })).toBe('oʻng');
  });

  it('test ticket lists transport/paper/codepage and both samples', () => {
    const txt = lines(buildTestTicket(settings80, { locale: 'ru', clinicName: 'LOR', dateTime: '15.09.2026 10:00' }), 'CP1251');
    expect(txt).toContain('ТЕСТ ПРИНТЕРА');
    expect(txt.some((l) => l.startsWith('Транспорт:') && l.endsWith('NETWORK'))).toBe(true);
    expect(txt.some((l) => l.startsWith('Бумага:') && l.endsWith('80 mm / 48 col'))).toBe(true);
    expect(txt.some((l) => l.startsWith('Кодировка:') && l.endsWith('CP1251'))).toBe(true);
    expect(txt.some((l) => l.includes('Съешь ещё'))).toBe(true);
    expect(txt).toContain('15.09.2026 10:00');
    expect(txt).toContain('Принтер работает!');
  });
});

// ───────────────────────── messages ─────────────────────────
describe('messages', () => {
  it('uz and ru dictionaries have identical key shapes and no plain apostrophes in uz', () => {
    const keys = (o: unknown, prefix = ''): string[] =>
      o && typeof o === 'object'
        ? Object.entries(o as Record<string, unknown>).flatMap(([k, v]) => keys(v, `${prefix}${k}.`))
        : [prefix.slice(0, -1)];
    expect(keys(printerMessages.ru)).toEqual(keys(printerMessages.uz));
    expect(JSON.stringify(printerMessages.uz)).not.toMatch(/'/);
    expect(fill('{n} kishi', { n: 3 })).toBe('3 kishi');
    expect(fill('{a}-{b}', { a: 1 })).toBe('1-{b}');
    expect(printerErrorText('ru', 'NO_DEVICE')).toMatch(/USB/);
    expect(printerErrorText('uz', undefined)).toBe(printerMessages.uz.errors.UNKNOWN);
  });
});

// ───────────────────────── errors / base64 / schemas ─────────────────────────
describe('errors, base64, schemas', () => {
  it('PrinterError / toPrinterError', () => {
    const e = new PrinterError('NO_DEVICE');
    expect(isPrinterError(e)).toBe(true);
    expect(e.message).toBe('NO_DEVICE');
    expect(toPrinterError(new Error('boom'), 'WRITE_FAILED').code).toBe('WRITE_FAILED');
    expect(toPrinterError(e, 'UNKNOWN')).toBe(e);
    expect(toPrinterError('str', 'UNKNOWN').message).toBe('str');
  });

  it('base64 roundtrip and PrintRawBodySchema', () => {
    const bytes = new Uint8Array([0, 1, 2, 0x1b, 0x40, 250, 255]);
    const b64 = bytesToBase64(bytes);
    expect(Array.from(base64ToBytes(b64))).toEqual(Array.from(bytes));
    expect(PrintRawBodySchema.safeParse({ bytesBase64: b64 }).success).toBe(true);
    expect(PrintRawBodySchema.safeParse({ bytesBase64: 'not base64!' }).success).toBe(false);
    expect(PrintRawBodySchema.safeParse({}).success).toBe(false);
  });

  it('networkErrorFromApi maps server codes', () => {
    expect(networkErrorFromApi(new PrinterError('NETWORK_TIMEOUT')).code).toBe('NETWORK_TIMEOUT');
    expect(networkErrorFromApi(new ApiClientError(504, 'PRINTER_ERROR', 'timeout', { code: 'NETWORK_TIMEOUT' })).code).toBe('NETWORK_TIMEOUT');
    expect(networkErrorFromApi(new ApiClientError(400, 'PRINTER_ERROR', 'no host', { code: 'NETWORK_NOT_CONFIGURED' })).code).toBe('NETWORK_NOT_CONFIGURED');
    expect(networkErrorFromApi(new ApiClientError(403, 'FORBIDDEN', 'Ruxsat yoʻq')).code).toBe('NETWORK_FAILED');
    expect(networkErrorFromApi(new TypeError('Failed to fetch')).code).toBe('NETWORK_FAILED');
    expect(networkErrorFromApi('x').code).toBe('NETWORK_FAILED');
  });
});

// ───────────────────────── webusb helpers ─────────────────────────
describe('webusb: findBulkOutEndpoint', () => {
  it('prefers the printer-class interface with a bulk OUT endpoint', () => {
    const ep = (n: number, direction: 'in' | 'out', type: 'bulk' | 'interrupt') => ({ endpointNumber: n, direction, type, packetSize: 64 });
    const alt = (cls: number, endpoints: ReturnType<typeof ep>[]) => ({
      alternateSetting: 0,
      interfaceClass: cls,
      interfaceSubclass: 1,
      interfaceProtocol: 2,
      endpoints,
    });
    const device = {
      configuration: {
        configurationValue: 1,
        interfaces: [
          { interfaceNumber: 0, claimed: false, alternate: alt(255, [ep(2, 'out', 'bulk')]), alternates: [alt(255, [ep(2, 'out', 'bulk')])] },
          { interfaceNumber: 1, claimed: false, alternate: alt(7, [ep(1, 'in', 'bulk'), ep(3, 'out', 'bulk')]), alternates: [alt(7, [ep(1, 'in', 'bulk'), ep(3, 'out', 'bulk')])] },
        ],
      },
      configurations: [],
    } as unknown as USBDevice;
    expect(findBulkOutEndpoint(device)).toEqual({ interfaceNumber: 1, alternateSetting: 0, endpointNumber: 3, packetSize: 64 });
    expect(findBulkOutEndpoint({ configuration: null, configurations: [] } as unknown as USBDevice)).toBeNull();
  });
});

// ───────────────────────── print.ts (Node: brauzer yoʻq) ─────────────────────────
describe('print orchestration outside a browser', () => {
  it('isRawTransport', () => {
    expect(isRawTransport('WEBUSB')).toBe(true);
    expect(isRawTransport('QZ')).toBe(true);
    expect(isRawTransport('NETWORK')).toBe(true);
    expect(isRawTransport('BROWSER')).toBe(false);
  });

  it('printBytes never throws; reports NOT_IN_BROWSER and records lastError', async () => {
    const r = await printBytes(new Uint8Array([1, 2, 3]), settings58);
    expect(r).toMatchObject({ ok: false, transport: 'WEBUSB', errorCode: 'NOT_IN_BROWSER' });
    expect(usePrinterStore.getState().lastError).toContain('NOT_IN_BROWSER');
  });

  it('printTicket falls back to BROWSER and marks fallback', async () => {
    const r = await printTicket(ticket, settings58, '/print/ticket/demo-q-0001');
    expect(r.ok).toBe(false);
    expect(r.fallback).toBe(true);
    expect(r.transport).toBe('BROWSER');
    expect(r.error).toContain('NOT_IN_BROWSER');
  });

  it('printReceipt without a fallback URL returns the raw error; BROWSER transport needs a URL', async () => {
    const r = await printReceipt(receipt, settings80, '');
    expect(r).toMatchObject({ ok: false, transport: 'NETWORK', errorCode: 'NOT_IN_BROWSER' });
    expect(r.fallback).toBeUndefined();
    const browser = PrinterSettingsSchema.parse({ transport: 'BROWSER' });
    const r2 = await printReceipt(receipt, browser, '');
    expect(r2).toMatchObject({ ok: false, transport: 'BROWSER', errorCode: 'NO_FALLBACK_URL' });
    const r3 = await testPrint(browser);
    expect(r3.errorCode).toBe('NO_RAW_TRANSPORT');
  });

  it('NETWORK without host → NETWORK_NOT_CONFIGURED even in the browser-less path', async () => {
    const r = await printBytes(new Uint8Array([1]), { ...settings80, host: '  ' });
    expect(r.errorCode).toBe('NOT_IN_BROWSER');
  });

  it('store: hydrate is a no-op in Node and setters work', () => {
    hydratePrinterStore();
    usePrinterStore.getState().setWebUsbDevice({ vendorId: 0x0416, productId: 0x5011, name: 'Xprinter' });
    expect(usePrinterStore.getState().webUsbDeviceName).toBe('Xprinter');
    usePrinterStore.getState().setLastTransportOk('QZ');
    expect(usePrinterStore.getState().lastTransportOk).toBe('QZ');
    expect(usePrinterStore.getState().lastError).toBeNull();
    usePrinterStore.getState().reset();
    expect(usePrinterStore.getState().webUsbDevice).toBeNull();
  });
});

// ───────────────────────── network-server.ts (TCP) ─────────────────────────
describe('sendToNetworkPrinter (node:net)', () => {
  let server: Server;
  let port = 0;
  const received: Buffer[] = [];

  beforeAll(async () => {
    server = createServer((socket) => {
      socket.on('data', (chunk) => received.push(Buffer.from(chunk)));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('validates hosts', () => {
    expect(isValidPrinterHost('192.168.1.50')).toBe(true);
    expect(isValidPrinterHost('printer.local')).toBe(true);
    expect(isValidPrinterHost('')).toBe(false);
    expect(isValidPrinterHost('http://x')).toBe(false);
    expect(isValidPrinterHost('999.1.1.1')).toBe(false);
  });

  it('writes the bytes to the printer socket and closes', async () => {
    const bytes = buildTicket(ticket, settings58);
    const r = await sendToNetworkPrinter('127.0.0.1', port, bytes, 3000);
    expect(r.sent).toBe(bytes.length);
    await new Promise((resolve) => setTimeout(resolve, 50));
    const got = Buffer.concat(received);
    expect(Array.from(got)).toEqual(Array.from(bytes));
  });

  it('rejects with NETWORK_NOT_CONFIGURED / NETWORK_FAILED / NETWORK_TIMEOUT', async () => {
    await expect(sendToNetworkPrinter('', 9100, new Uint8Array([1]))).rejects.toMatchObject({ code: 'NETWORK_NOT_CONFIGURED' });
    await expect(sendToNetworkPrinter('127.0.0.1', 70000, new Uint8Array([1]))).rejects.toMatchObject({ code: 'NETWORK_NOT_CONFIGURED' });

    const closed = createServer();
    await new Promise<void>((resolve) => closed.listen(0, '127.0.0.1', resolve));
    const closedPort = (closed.address() as AddressInfo).port;
    await new Promise<void>((resolve) => closed.close(() => resolve()));
    await expect(sendToNetworkPrinter('127.0.0.1', closedPort, new Uint8Array([1]), 2000)).rejects.toMatchObject({ code: 'NETWORK_FAILED' });

    // Non-routable manzil (TEST-NET-1) — ulanish javobsiz qoladi → timeout
    const started = Date.now();
    await expect(sendToNetworkPrinter('192.0.2.1', 9100, new Uint8Array([1]), 600)).rejects.toMatchObject({ code: 'NETWORK_TIMEOUT' });
    expect(Date.now() - started).toBeLessThan(5000);
  }, 15_000);
});
