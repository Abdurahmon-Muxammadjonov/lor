import Decimal from 'decimal.js';

/**
 * Pul bilan ishlash qoidalari:
 *  - DB: Decimal(14,2), butun soʻm (tiyin ishlatilmaydi)
 *  - Hisob-kitob: faqat Decimal (float ISHLATILMAYDI)
 *  - API: string ("125000") yoki number (butun) — ikkalasi ham qabul qilinadi
 *  - Koʻrsatish: "1 250 000 soʻm"
 */

Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export type MoneyInput = Decimal | number | string | bigint | { toString(): string };

export const D = (v: MoneyInput | null | undefined): Decimal => {
  if (v === null || v === undefined || v === '') return new Decimal(0);
  if (v instanceof Decimal) return v;
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new MoneyError('INVALID_MONEY', `Not finite: ${v}`);
    return new Decimal(v);
  }
  if (typeof v === 'bigint') return new Decimal(v.toString());
  const s = String(v).replace(/\s/g, '').replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(s)) throw new MoneyError('INVALID_MONEY', `Cannot parse money: ${String(v)}`);
  return new Decimal(s);
};

export class MoneyError extends Error {
  constructor(
    public code: 'INVALID_MONEY' | 'NEGATIVE_MONEY',
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'MoneyError';
  }
}

/** Butun soʻmgacha yaxlitlash (0.5 → yuqoriga) */
export const roundMoney = (v: MoneyInput): Decimal => D(v).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

/** `step` soʻmgacha yaxlitlash (masalan 100 → 162 350 → 162 400). step<=1 boʻlsa butun soʻm. */
export function roundToStep(v: MoneyInput, step: number): Decimal {
  const d = D(v);
  if (!step || step <= 1) return roundMoney(d);
  const s = new Decimal(step);
  return d.div(s).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).mul(s);
}

export const sumMoney = (values: MoneyInput[]): Decimal => values.reduce<Decimal>((acc, v) => acc.plus(D(v)), new Decimal(0));

export const maxZero = (v: MoneyInput): Decimal => {
  const d = D(v);
  return d.isNegative() ? new Decimal(0) : d;
};

/** DB/API ga uzatish uchun: "125000" (2 kasrsiz, butun) */
export const toMoneyString = (v: MoneyInput): string => roundMoney(v).toFixed(0);

/** UI/state uchun butun number (14 xonagacha xavfsiz) */
export const toMoneyNumber = (v: MoneyInput): number => roundMoney(v).toNumber();

/** Prisma Decimal → butun number (JSON serialization uchun) */
export const moneyToJson = (v: MoneyInput | null | undefined): number => (v === null || v === undefined ? 0 : toMoneyNumber(v));

const NBSP = ' ';

export interface FormatMoneyOptions {
  /** "soʻm" / "сум" / "" */
  suffix?: string;
  /** Minglar ajratgichi (default: oddiy probel) */
  separator?: string;
  /** Musbat qiymat oldiga "+" qoʻyish */
  signed?: boolean;
}

/** 1250000 → "1 250 000 soʻm" */
export function formatMoney(v: MoneyInput | null | undefined, opts: FormatMoneyOptions = {}): string {
  const { suffix = 'soʻm', separator = ' ', signed = false } = opts;
  const d = roundMoney(v ?? 0);
  const neg = d.isNegative();
  const abs = d.abs().toFixed(0);
  const grouped = abs.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
  const sign = neg ? '−' : signed && !d.isZero() ? '+' : '';
  return suffix ? `${sign}${grouped}${NBSP}${suffix}` : `${sign}${grouped}`;
}

/** "1 250 000" → "1250000" (input maydonlari uchun) */
export function parseMoneyInput(raw: string): string {
  return raw.replace(/[^\d]/g, '');
}

/** Input ichida yozayotganda guruhlash: "1250000" → "1 250 000" */
export function groupDigits(raw: string, separator = ' '): string {
  const digits = raw.replace(/\D/g, '');
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
}
