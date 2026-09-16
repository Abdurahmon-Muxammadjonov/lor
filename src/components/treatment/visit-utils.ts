import type { Locale } from '@/i18n/config';
import { ageAt, determinePatientType, type PatientType } from '@/lib/calc';
import { D, sumMoney } from '@/lib/money';
import { normalizeSearch } from '@/lib/utils';
import type { TreatmentLineDTO, VisitRowDTO } from '@/lib/visits/types';

/**
 * Qabul UI uchun kichik sof yordamchilar (server importlarisiz).
 */

/** Snapshot nomi (qator) yoki xizmat nomi — joriy tilda */
export function nameByLocale(obj: { name: string; nameRu?: string | null }, locale: Locale): string {
  return locale === 'ru' && obj.nameRu ? obj.nameRu : obj.name;
}

export function lineName(
  line: Pick<TreatmentLineDTO, 'serviceName' | 'serviceNameRu'>,
  locale: Locale,
): string {
  return nameByLocale({ name: line.serviceName, nameRu: line.serviceNameRu }, locale);
}

export interface PatientAgeInfo {
  age: number;
  type: PatientType;
}

/** Bemor yoshi va avtomatik bemor turi (klinika chegarasi boʻyicha) */
export function patientAgeInfo(
  birthDate: string | Date,
  childAgeLimit: number,
  at: Date = new Date(),
): PatientAgeInfo {
  return { age: ageAt(birthDate, at), type: determinePatientType(birthDate, childAgeLimit, at) };
}

const EMPTY_MARKERS = new Set(['', 'yoq', 'нет', 'no', '-', '—', 'none', 'aniqlanmagan', 'не выявлено']);

/** "Yoʻq"/"Нет"/"-" kabi qiymatlar — haqiqiy allergiya emas */
export function isMeaningfulText(s: string | null | undefined): boolean {
  if (!s) return false;
  return !EMPTY_MARKERS.has(normalizeSearch(s));
}

export type PaymentState = 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERPAID';

/** Toʻlov holati (StatusBadge kind="payment" uchun) */
export function paymentStateOf(v: Pick<VisitRowDTO, 'totalNet' | 'paidAmount'>): PaymentState {
  const total = D(v.totalNet);
  const paid = D(v.paidAmount);
  if (paid.lte(0) && total.gt(0)) return 'UNPAID';
  if (paid.gt(total)) return 'OVERPAID';
  if (paid.lt(total)) return 'PARTIAL';
  return 'PAID';
}

export interface LineSums {
  gross: number;
  discount: number;
  net: number;
}

/** Qatorlar boʻyicha jamlar (Decimal orqali, butun soʻm) */
export function sumLines(
  lines: ReadonlyArray<Pick<TreatmentLineDTO, 'grossTotal' | 'discountTotal' | 'lineTotal'>>,
): LineSums {
  return {
    gross: sumMoney(lines.map((l) => l.grossTotal)).toNumber(),
    discount: sumMoney(lines.map((l) => l.discountTotal)).toNumber(),
    net: sumMoney(lines.map((l) => l.lineTotal)).toNumber(),
  };
}

/** Umumiy chegirma summasi = Visit.discount − Σ qator chegirmalari */
export function globalDiscountAmount(
  v: Pick<VisitRowDTO, 'discount'>,
  lines: ReadonlyArray<Pick<TreatmentLineDTO, 'discountTotal'>>,
): number {
  const lineDiscount = sumMoney(lines.map((l) => l.discountTotal));
  const g = D(v.discount).minus(lineDiscount);
  return g.isNegative() ? 0 : g.toNumber();
}

/** Yaxlitlashdan oldingi jami = Σ lineTotal − umumiy chegirma */
export function totalBeforeRounding(
  v: Pick<VisitRowDTO, 'discount'>,
  lines: ReadonlyArray<Pick<TreatmentLineDTO, 'discountTotal' | 'lineTotal'>>,
): number {
  const net = sumMoney(lines.map((l) => l.lineTotal));
  const raw = net.minus(globalDiscountAmount(v, lines));
  return raw.isNegative() ? 0 : raw.toNumber();
}

/** Sana matnidan `YYYY-MM-DD` (input[type=date] uchun) */
export function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isDateKey(s: string | null | undefined): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
