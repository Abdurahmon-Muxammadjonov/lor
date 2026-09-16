import { codepageCommand, encodeText, prepareText } from './encode';
import type { Codepage, PaperWidthMm, TextAlign } from './types';

/**
 * ESC/POS buyruqlar quruvchisi (58 mm = 32 ustun, 80 mm = 48 ustun, Font A 12×24).
 * Matnlar `encode.ts` orqali kodlanadi; kenglik hisoblari tayyorlangan (1 belgi = 1 bayt) matnda bajariladi.
 * Sinf usullari zanjir (chaining) qilib chaqiriladi: `p.init().align('center').bold(true).line('Salom').build()`.
 */

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

export const PAPER_COLUMNS: Record<PaperWidthMm, number> = { 58: 32, 80: 48 };

export interface EscPosOptions {
  paperWidth: PaperWidthMm;
  codepage: Codepage;
  /** ESC t uchun jadval raqami (modelga qarab; default `CODEPAGE_NUMBERS`) */
  codepageNumber?: number;
}

export interface TableColumn {
  text: string;
  /** Belgilar soni */
  width: number;
  align?: TextAlign;
}

export interface TableOptions {
  /** Ustunlar orasidagi boʻshliq (default 1) */
  gap?: number;
}

/**
 * Soʻz boʻyicha oʻrash. Uzun soʻzlar belgilab boʻlinadi. Bir nechta qator (\n) hurmat qilinadi.
 * cols <= 0 boʻlsa matn oʻzgarishsiz bitta qator sifatida qaytadi.
 */
export function wrapText(text: string, cols: number): string[] {
  if (cols <= 0) return [text];
  const out: string[] = [];
  for (const para of text.split(/\r?\n/)) {
    const words = para.split(/[ \t]+/).filter(Boolean);
    if (words.length === 0) {
      out.push('');
      continue;
    }
    let line = '';
    for (let word of words) {
      while (word.length > cols) {
        if (line) {
          const room = cols - line.length - 1;
          if (room >= 3) {
            line += ' ' + word.slice(0, room);
            word = word.slice(room);
          }
          out.push(line);
          line = '';
          continue;
        }
        out.push(word.slice(0, cols));
        word = word.slice(cols);
      }
      if (!word) continue;
      if (!line) line = word;
      else if (line.length + 1 + word.length <= cols) line += ' ' + word;
      else {
        out.push(line);
        line = word;
      }
    }
    if (line) out.push(line);
  }
  return out.length ? out : [''];
}

/** Matnni kenglikka moslab kesish (oxiriga '…' oʻrniga '.' — ASCII) */
export function fitText(text: string, width: number): string {
  if (width <= 0) return '';
  if (text.length <= width) return text;
  if (width <= 1) return text.slice(0, width);
  return text.slice(0, width - 1) + '.';
}

export function padText(text: string, width: number, align: TextAlign = 'left'): string {
  const t = fitText(text, width);
  const space = width - t.length;
  if (space <= 0) return t;
  if (align === 'right') return ' '.repeat(space) + t;
  if (align === 'center') {
    const left = Math.floor(space / 2);
    return ' '.repeat(left) + t + ' '.repeat(space - left);
  }
  return t + ' '.repeat(space);
}

export function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return out;
}

export class EscPos {
  private readonly chunks: Uint8Array[] = [];
  private readonly baseCols: number;
  private sizeW: 1 | 2 | 3 = 1;
  readonly paperWidth: PaperWidthMm;
  readonly codepage: Codepage;
  private readonly codepageNumber: number | undefined;

  constructor(opts: EscPosOptions) {
    this.paperWidth = opts.paperWidth;
    this.codepage = opts.codepage;
    this.codepageNumber = opts.codepageNumber;
    this.baseCols = PAPER_COLUMNS[opts.paperWidth];
  }

  /** Joriy shrift kengligidagi ustunlar soni (size(2,…) → yarmi) */
  get cols(): number {
    return Math.max(1, Math.floor(this.baseCols / this.sizeW));
  }

  /** Bazaviy (size 1) ustunlar soni: 32 yoki 48 */
  get baseColumns(): number {
    return this.baseCols;
  }

  private push(bytes: Uint8Array | number[]): this {
    this.chunks.push(bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes));
    return this;
  }

  /** ESC @ (printerni tiklash) + ESC t n (kod jadvali) */
  init(): this {
    this.sizeW = 1;
    this.push([ESC, 0x40]);
    this.push(codepageCommand(this.codepage, this.codepageNumber));
    return this;
  }

  /** ESC a n */
  align(a: TextAlign): this {
    return this.push([ESC, 0x61, a === 'center' ? 1 : a === 'right' ? 2 : 0]);
  }

  /** ESC E n */
  bold(on: boolean): this {
    return this.push([ESC, 0x45, on ? 1 : 0]);
  }

  /** GS ! n — kenglik/balandlik koʻpaytmasi (1..3) */
  size(w: 1 | 2 | 3, h: 1 | 2 | 3): this {
    this.sizeW = w;
    return this.push([GS, 0x21, ((w - 1) << 4) | (h - 1)]);
  }

  /** ESC - n */
  underline(on: boolean): this {
    return this.push([ESC, 0x2d, on ? 1 : 0]);
  }

  /** Matn (LF siz) */
  text(s: string): this {
    if (!s) return this;
    return this.push(encodeText(s, this.codepage));
  }

  /** Matn + LF */
  line(s = ''): this {
    this.text(s);
    return this.push([LF]);
  }

  /** Soʻz boʻyicha oʻralgan bir necha qator */
  paragraph(s: string): this {
    for (const l of wrapText(this.prepare(s), this.cols)) this.line(l);
    return this;
  }

  /** ESC d n — n qator surish (n=0 boʻlsa hech narsa) */
  feed(n = 1): this {
    if (n <= 0) return this;
    return this.push([ESC, 0x64, Math.min(255, n)]);
  }

  /** Toʻliq kenglikdagi chiziq */
  hr(char = '-'): this {
    const ch = this.prepare(char).charAt(0) || '-';
    return this.line(ch.repeat(this.cols));
  }

  /** Ikki ustun: chap matn + oʻng matn (oʻng chetga tekislangan). Chap sigʻmasa oʻraladi. */
  row(left: string, right: string): this {
    const cols = this.cols;
    const l = this.prepare(left);
    const r = this.prepare(right);
    if (r.length >= cols) {
      if (l) this.paragraph(l);
      for (const rl of wrapText(r, cols)) this.line(padText(rl, cols, 'right'));
      return this;
    }
    const leftWidth = cols - r.length - 1;
    if (l.length <= leftWidth) return this.line(padText(l, leftWidth) + ' ' + r);
    const wrapWidth = leftWidth >= 8 ? leftWidth : cols;
    const lines = wrapText(l, wrapWidth);
    const last = lines.pop() ?? '';
    for (const ll of lines) this.line(ll);
    if (last.length <= leftWidth) return this.line(padText(last, leftWidth) + ' ' + r);
    this.line(last);
    return this.line(padText(r, cols, 'right'));
  }

  /** Jadval qatori: har bir ustun oʻz kengligida soʻz boʻyicha oʻraladi. */
  table(columns: TableColumn[], opts: TableOptions = {}): this {
    if (columns.length === 0) return this;
    const gap = Math.max(0, opts.gap ?? 1);
    const cells = columns.map((c) => ({
      width: Math.max(1, Math.floor(c.width)),
      align: c.align ?? 'left',
      lines: wrapText(this.prepare(c.text), Math.max(1, Math.floor(c.width))),
    }));
    const rows = Math.max(...cells.map((c) => c.lines.length));
    for (let i = 0; i < rows; i++) {
      const parts = cells.map((c) => padText(c.lines[i] ?? '', c.width, c.align));
      this.line(parts.join(' '.repeat(gap)).replace(/\s+$/, ''));
    }
    return this;
  }

  /**
   * QR kod (GS ( k, model 2). size 1..16 (nuqta/modul), default 6. Maʼlumot UTF-8.
   * Printer QR ni qoʻllamasa buyruqlar eʼtiborsiz qoladi — shuning uchun URL ni matn bilan ham chiqarish tavsiya etiladi.
   */
  qr(data: string, size = 6, ecc: 'L' | 'M' | 'Q' | 'H' = 'M'): this {
    if (!data) return this;
    const payload = new TextEncoder().encode(data);
    const len = payload.length + 3;
    const pL = len & 0xff;
    const pH = (len >> 8) & 0xff;
    const eccByte = { L: 48, M: 49, Q: 50, H: 51 }[ecc];
    this.push([GS, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00]); // model 2
    this.push([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, Math.min(16, Math.max(1, size))]); // module size
    this.push([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, eccByte]); // error correction
    this.push([GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30]); // store
    this.push(payload);
    this.push([GS, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30]); // print
    return this;
  }

  /** GS V — qogʻozni kesish (partial = qisman, default). Avval kesish joyigacha suradi. */
  cut(partial = true): this {
    return this.push([GS, 0x56, partial ? 0x42 : 0x41, 0x00]);
  }

  /** ESC B n t — signal (n marta, t×100 ms) */
  beep(times = 2, duration = 3): this {
    return this.push([ESC, 0x42, Math.min(9, Math.max(1, times)), Math.min(9, Math.max(1, duration))]);
  }

  /** Xom baytlar */
  raw(bytes: Uint8Array | number[]): this {
    return this.push(bytes);
  }

  build(): Uint8Array {
    return concatBytes(this.chunks);
  }

  /** Kodlashga tayyorlangan matn (kenglik hisoblari uchun) */
  prepare(s: string): string {
    return prepareText(s, this.codepage);
  }
}
