import type { PayMethod } from '@prisma/client';
import { PAY_METHODS } from './schemas';
import type { CashierErrorDetails, MethodTotals, PaymentStatusCode } from './types';

/**
 * Kassa uchun kichik, server importlarisiz yordamchilar (client va server).
 */

export const EMPTY_METHOD_TOTALS: MethodTotals = { CASH: 0, CARD: 0, TRANSFER: 0, CLICK: 0, PAYME: 0 };

export function emptyMethodTotals(): MethodTotals {
  return { ...EMPTY_METHOD_TOTALS };
}

export function isPayMethod(v: unknown): v is PayMethod {
  return typeof v === 'string' && (PAY_METHODS as readonly string[]).includes(v);
}

/** Qabulning toʻlov holati: totalNet va paidAmount boʻyicha */
export function paymentStatusOf(v: { totalNet: number; paidAmount: number }): PaymentStatusCode {
  if (v.paidAmount <= 0) return v.totalNet <= 0 ? 'PAID' : 'UNPAID';
  if (v.paidAmount < v.totalNet) return 'PARTIAL';
  if (v.paidAmount > v.totalNet) return 'OVERPAID';
  return 'PAID';
}

/** Naqd toʻlovda qaytim: berilgan − summa (manfiy boʻlsa yetarli emas) */
export function changeFor(given: number, amount: number): number {
  return given - amount;
}

/** Badge variant: toʻlov usuli boʻyicha rang */
export function methodBadgeVariant(
  method: PayMethod,
): 'success' | 'accent' | 'secondary' | 'warning' | 'outline' {
  switch (method) {
    case 'CASH':
      return 'success';
    case 'CARD':
      return 'accent';
    case 'TRANSFER':
      return 'secondary';
    case 'CLICK':
      return 'warning';
    case 'PAYME':
      return 'outline';
  }
}

/** API `details` obyektidan kassa xato kodini ajratib olish */
export function cashierErrorCode(details: unknown): CashierErrorDetails['code'] | null {
  if (!details || typeof details !== 'object') return null;
  const code = (details as { code?: unknown }).code;
  return code === 'OVERPAY' || code === 'REFUND_EXCEEDS' || code === 'NOTHING_TO_PAY' ? code : null;
}

/** Foizli tez tugmalar uchun: summaning ulushi, `step` ga yaxlitlangan (default 100 soʻm) */
export function shareOf(amount: number, ratio: number, step = 100): number {
  if (amount <= 0) return 0;
  const raw = amount * ratio;
  const s = Math.max(1, step);
  const rounded = Math.round(raw / s) * s;
  return Math.min(amount, Math.max(s, rounded));
}

/** "1250000" | "1 250 000" → 1250000 (boʻsh → 0) */
export function parseAmount(raw: string): number {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return 0;
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : 0;
}
