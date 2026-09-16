import Decimal from 'decimal.js';
import { D, roundMoney, roundToStep, type MoneyInput } from '@/lib/money';
import { CLINIC_TZ } from '@/lib/date';
import type { SalaryTypeValue } from './types';

/**
 * Ish haqi hisobi — sof funksiyalar (DB siz), decimal.js bilan.
 *
 *  PERCENT: tushum × foiz / 100 → 100 soʻmgacha yaxlitlanadi (1 234 567 × 30 % = 370 370.1 → 370 400)
 *  FIXED:   salaryValue (oylik qatʼiy summa)
 */

export const SALARY_ROUND_STEP = 100;

export function calcSalary(salaryType: SalaryTypeValue, salaryValue: MoneyInput, revenue: MoneyInput): Decimal {
  if (salaryType === 'FIXED') return roundMoney(salaryValue);
  const pct = D(salaryValue);
  if (pct.lte(0)) return new Decimal(0);
  return roundToStep(D(revenue).mul(pct).div(100), SALARY_ROUND_STEP);
}

/** Toshkent vaqti boʻyicha "YYYY-MM" */
export function monthKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: CLINIC_TZ, year: 'numeric', month: '2-digit' })
    .format(now)
    .slice(0, 7);
}

export function isValidMonth(month: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}

/** "YYYY-MM" → {start, end} (end — keyingi oy boshi, exclusive), Asia/Tashkent (+05:00, DST yoʻq) */
export function monthRange(month: string): { start: Date; end: Date } {
  if (!isValidMonth(month)) throw new RangeError(`Invalid month: ${month}`);
  const [y, m] = month.split('-').map(Number) as [number, number];
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    start: new Date(`${y}-${pad(m)}-01T00:00:00+05:00`),
    end: new Date(`${nextY}-${pad(nextM)}-01T00:00:00+05:00`),
  };
}

/** "YYYY-MM" ± n oy */
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const idx = y * 12 + (m - 1) + delta;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

/** Oxirgi `n` oy (joriy oydan orqaga), joriy oy birinchi */
export function recentMonths(n: number, now: Date = new Date()): string[] {
  const current = monthKey(now);
  return Array.from({ length: n }, (_, i) => shiftMonth(current, -i));
}

/** Foiz matni: 30 → "30 %" */
export function formatPercent(v: MoneyInput): string {
  const d = D(v);
  return `${d.mod(1).isZero() ? d.toFixed(0) : d.toFixed(1)} %`;
}
