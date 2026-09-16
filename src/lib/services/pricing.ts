import type Decimal from 'decimal.js';
import { D, maxZero, roundToStep, toMoneyNumber, type MoneyInput } from '@/lib/money';
import { PRICE_FIELDS, type BulkMode, type PriceField } from './schemas';

/**
 * Ommaviy narx oʻzgartirish matematikasi — faqat Decimal (float ISHLATILMAYDI).
 *
 *   PERCENT +10  : 120 000 → 132 000 (roundTo 100)
 *   FIXED  −5000 : 120 000 → 115 000
 *   SET   99 000 : 120 000 →  99 000
 */

export interface BulkRule {
  mode: BulkMode;
  /** PERCENT: foiz (ishorali), FIXED: soʻm (ishorali), SET: yangi narx (≥ 0) */
  value: MoneyInput;
  /** Yaxlitlash qadami (100 yoki 1000) */
  roundTo: number;
}

/** Bitta narxni qoidaga koʻra hisoblaydi: natija hech qachon manfiy emas, `roundTo` ga yaxlitlangan */
export function computeBulkPrice(current: MoneyInput, rule: BulkRule): Decimal {
  const cur = D(current);
  const val = D(rule.value);
  let next: Decimal;
  switch (rule.mode) {
    case 'PERCENT':
      next = cur.mul(D(100).plus(val)).div(100);
      break;
    case 'FIXED':
      next = cur.plus(val);
      break;
    case 'SET':
      next = val;
      break;
  }
  return roundToStep(maxZero(next), rule.roundTo);
}

export type PriceRecord = Record<PriceField, MoneyInput>;

export interface PriceChange {
  field: PriceField;
  from: number;
  to: number;
}

/**
 * Xizmatning tanlangan narx maydonlarini qoidaga koʻra qayta hisoblaydi.
 * Faqat haqiqatan oʻzgargan maydonlar `changes` ga tushadi; `next` — toʻliq yangi narxlar (butun number).
 */
export function applyBulkRule(
  prices: PriceRecord,
  fields: readonly PriceField[],
  rule: BulkRule,
): { next: Record<PriceField, number>; changes: PriceChange[] } {
  const next = {} as Record<PriceField, number>;
  const changes: PriceChange[] = [];
  const selected = new Set<PriceField>(fields);
  for (const field of PRICE_FIELDS) {
    const from = toMoneyNumber(prices[field]);
    if (!selected.has(field)) {
      next[field] = from;
      continue;
    }
    const to = toMoneyNumber(computeBulkPrice(prices[field], rule));
    next[field] = to;
    if (to !== from) changes.push({ field, from, to });
  }
  return { next, changes };
}

/** Narxlar obyektini butun number koʻrinishiga keltiradi (audit / DTO uchun) */
export function pricesToNumbers(prices: PriceRecord): Record<PriceField, number> {
  const out = {} as Record<PriceField, number>;
  for (const f of PRICE_FIELDS) out[f] = toMoneyNumber(prices[f]);
  return out;
}

/** Ikki narx toʻplami farq qiladimi */
export function pricesDiffer(a: PriceRecord, b: PriceRecord): boolean {
  return PRICE_FIELDS.some((f) => !D(a[f]).eq(D(b[f])));
}
