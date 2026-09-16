import Decimal from 'decimal.js';
import { D, maxZero, roundMoney, roundToStep } from './money';

/**
 * ⭐ Muolaja hisoblash — tizimning yuragi.
 * Har bir qator alohida hisoblanadi, keyin jamlanadi. Barcha arifmetika Decimal.
 */

export type PatientType = 'ADULT' | 'CHILD';
export type DiscountType = 'NONE' | 'PERCENT' | 'FIXED';

export interface ServicePricing {
  priceAdultNoMed: Decimal | number | string;
  priceAdultMed: Decimal | number | string;
  priceChildNoMed: Decimal | number | string;
  priceChildMed: Decimal | number | string;
  allowHalf: boolean;
  medicineOptional: boolean;
}

export interface LineInput {
  patientType: PatientType;
  withMedicine: boolean;
  /** 0.5 qadam (allowHalf=true) yoki butun son */
  quantity: number | string | Decimal;
  discountType: DiscountType;
  discountValue: number | string | Decimal;
}

export interface LineResult {
  unitPrice: Decimal;
  gross: Decimal;
  discount: Decimal;
  net: Decimal;
  quantity: Decimal;
}

export interface VisitTotals {
  subtotal: Decimal;
  globalDiscount: Decimal;
  /** Yaxlitlashdan oldingi jami */
  totalRaw: Decimal;
  /** Yaxlitlangan yakuniy jami (roundTo) */
  total: Decimal;
  paid: Decimal;
  /** musbat = qarz, manfiy = ortiqcha toʻlov */
  balance: Decimal;
}

export type CalcErrorCode =
  | 'INVALID_QUANTITY'
  | 'HALF_NOT_ALLOWED'
  | 'INVALID_DISCOUNT'
  | 'MEDICINE_REQUIRED'
  | 'NEGATIVE_PRICE';

export class CalcError extends Error {
  constructor(
    public code: CalcErrorCode,
    message?: string,
  ) {
    super(message ?? code);
    this.name = 'CalcError';
  }
}

export const QUANTITY_STEP_HALF = 0.5;
export const QUANTITY_STEP_WHOLE = 1;
export const QUANTITY_MAX = 99;

export function quantityStep(allowHalf: boolean): number {
  return allowHalf ? QUANTITY_STEP_HALF : QUANTITY_STEP_WHOLE;
}

/** Miqdor qoidaga mosligini tekshiradi (0.5 ga karrali / butun, > 0, <= 99) */
export function isValidQuantity(quantity: number | string | Decimal, allowHalf: boolean): boolean {
  let q: Decimal;
  try {
    q = D(quantity);
  } catch {
    return false;
  }
  if (!q.isFinite() || q.lte(0) || q.gt(QUANTITY_MAX)) return false;
  const step = new Decimal(quantityStep(allowHalf));
  return q.mod(step).isZero();
}

export function validateQuantity(quantity: number | string | Decimal, allowHalf: boolean): Decimal {
  const q = D(quantity);
  if (!q.isFinite() || q.lte(0) || q.gt(QUANTITY_MAX)) throw new CalcError('INVALID_QUANTITY');
  if (!q.mod(new Decimal(QUANTITY_STEP_HALF)).isZero()) throw new CalcError('INVALID_QUANTITY');
  if (!allowHalf && !q.mod(1).isZero()) throw new CalcError('HALF_NOT_ALLOWED');
  return q;
}

/** Yaqin toʻgʻri qiymatga keltiradi: 1.3 → 1.5 (half) / 1 (whole); minimal = step */
export function snapQuantity(quantity: number, allowHalf: boolean): number {
  const step = quantityStep(allowHalf);
  if (!Number.isFinite(quantity)) return step;
  const snapped = Math.round(quantity / step) * step;
  const clamped = Math.min(QUANTITY_MAX, Math.max(step, snapped));
  return Number(clamped.toFixed(1));
}

export function formatQuantity(q: number | string | Decimal): string {
  const d = D(q);
  return d.mod(1).isZero() ? d.toFixed(0) : d.toFixed(1);
}

/** Bazaviy birlik narx: bemor turi × dori */
export function pickUnitPrice(service: ServicePricing, patientType: PatientType, withMedicine: boolean): Decimal {
  const med = service.medicineOptional ? withMedicine : true;
  const price =
    patientType === 'CHILD'
      ? med
        ? service.priceChildMed
        : service.priceChildNoMed
      : med
        ? service.priceAdultMed
        : service.priceAdultNoMed;
  const d = D(price);
  if (d.isNegative()) throw new CalcError('NEGATIVE_PRICE');
  return d;
}

export function validateDiscount(type: DiscountType, value: number | string | Decimal): Decimal {
  const v = D(value);
  if (type === 'NONE') return new Decimal(0);
  if (!v.isFinite() || v.isNegative()) throw new CalcError('INVALID_DISCOUNT');
  if (type === 'PERCENT' && v.gt(100)) throw new CalcError('INVALID_DISCOUNT');
  return v;
}

/** Bitta qator hisobi */
export function calcLine(line: LineInput, service: ServicePricing): LineResult {
  // 1) Bazaviy birlik narx
  const unitPrice = pickUnitPrice(service, line.patientType, line.withMedicine);

  // 2) Miqdor validatsiyasi (0.5 qadam yoki butun)
  const quantity = validateQuantity(line.quantity, service.allowHalf);

  // 3) Xom summa
  const gross = roundMoney(unitPrice.mul(quantity));

  // 4) Chegirma (foiz YOKI qatʼiy summa)
  const dv = validateDiscount(line.discountType, line.discountValue);
  const discountRaw = line.discountType === 'PERCENT' ? gross.mul(dv).div(100) : line.discountType === 'FIXED' ? dv : new Decimal(0);
  const discount = Decimal.min(roundMoney(discountRaw), gross);

  // 5) Yakuniy
  const net = maxZero(gross.minus(discount));

  return { unitPrice, gross, discount, net, quantity };
}

export interface GlobalDiscountInput {
  type: DiscountType;
  value: number | string | Decimal;
}

/** Butun qabul hisobi: qatorlar → umumiy chegirma → yaxlitlash → toʻlovlar → qoldiq */
export function calcVisit(
  lineNets: Array<Decimal | number | string>,
  globalDiscount: GlobalDiscountInput = { type: 'NONE', value: 0 },
  payments: Array<Decimal | number | string> = [],
  roundTo = 100,
): VisitTotals {
  const subtotal = lineNets.reduce<Decimal>((s, n) => s.plus(D(n)), new Decimal(0));
  const gv = validateDiscount(globalDiscount.type, globalDiscount.value);
  const gdRaw =
    globalDiscount.type === 'PERCENT' ? subtotal.mul(gv).div(100) : globalDiscount.type === 'FIXED' ? gv : new Decimal(0);
  const globalDiscountAmt = Decimal.min(roundMoney(gdRaw), subtotal);
  const totalRaw = maxZero(subtotal.minus(globalDiscountAmt));
  const total = roundToStep(totalRaw, roundTo);
  const paid = payments.reduce<Decimal>((s, p) => s.plus(D(p)), new Decimal(0));
  const balance = total.minus(paid);
  return { subtotal, globalDiscount: globalDiscountAmt, totalRaw, total, paid, balance };
}

/** Bemor yoshi (toʻliq yillar) */
export function ageAt(birthDate: Date | string, at: Date = new Date()): number {
  const b = typeof birthDate === 'string' ? new Date(birthDate) : birthDate;
  let age = at.getFullYear() - b.getFullYear();
  const m = at.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < b.getDate())) age--;
  return Math.max(0, age);
}

/** Yosh chegarasi boʻyicha bemor turi (default 14: 14 yoshgacha — bola) */
export function determinePatientType(birthDate: Date | string, childAgeLimit = 14, at: Date = new Date()): PatientType {
  return ageAt(birthDate, at) < childAgeLimit ? 'CHILD' : 'ADULT';
}

/** UI uchun: qatorlar natijasini JSON-ga tayyorlash */
export function lineResultToJson(r: LineResult) {
  return {
    unitPrice: r.unitPrice.toNumber(),
    gross: r.gross.toNumber(),
    discount: r.discount.toNumber(),
    net: r.net.toNumber(),
    quantity: r.quantity.toNumber(),
  };
}

export function visitTotalsToJson(t: VisitTotals) {
  return {
    subtotal: t.subtotal.toNumber(),
    globalDiscount: t.globalDiscount.toNumber(),
    totalRaw: t.totalRaw.toNumber(),
    total: t.total.toNumber(),
    paid: t.paid.toNumber(),
    balance: t.balance.toNumber(),
  };
}
