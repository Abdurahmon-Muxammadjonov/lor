import type { PatientType } from '@/lib/calc';
import { todayKey } from '@/lib/date';

/**
 * Tugʻilgan sana bilan ishlash — kalendar sanasi darajasida (vaqt zonasiga bogʻliq emas).
 * Bemorning `birthDate` maydoni DB da `@db.Date` (UTC yarim tun), API da ISO string keladi.
 * Barcha hisoblar "YYYY-MM-DD" kalitlari ustida bajariladi, shuning uchun server (UTC)
 * va brauzer (Asia/Tashkent) bir xil natija beradi.
 */

export const MIN_BIRTH_YEAR = 1900;

export interface DateParts {
  year: number;
  month: number; // 1–12
  day: number; // 1–31
}

/** Kalendar sanasi haqiqiy ekanligini tekshiradi (30 fevral — yoʻq) */
export function isValidDateParts({ year, month, day }: DateParts): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

export function partsToKey({ year, month, day }: DateParts): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Har qanday sana koʻrinishidan kalendar qismlarini oladi:
 *   "1985-03-12", "1985-03-12T00:00:00.000Z", "12.03.1985", "12/03/1985", Date.
 * ISO satrlarda faqat birinchi 10 belgi (UTC sana) olinadi — API dan kelgan `@db.Date` uchun toʻgʻri.
 * Date obyekti uchun mahalliy qismlar olinadi (kalendar tanlovi — mahalliy yarim tun).
 */
export function parseDateParts(v: string | Date | null | undefined): DateParts | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return null;
    return { year: v.getFullYear(), month: v.getMonth() + 1, day: v.getDate() };
  }
  const s = v.trim();
  if (!s) return null;
  let m = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(s);
  if (m) return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
  m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(s);
  if (m) return { year: Number(m[3]), month: Number(m[2]), day: Number(m[1]) };
  return null;
}

/** Sana → "YYYY-MM-DD" (yaroqsiz boʻlsa null) */
export function toDateKey(v: string | Date | null | undefined): string | null {
  const p = parseDateParts(v);
  return p && isValidDateParts(p) ? partsToKey(p) : null;
}

/** "YYYY-MM-DD" → UTC yarim tun Date (Prisma `@db.Date` uchun) */
export function dateKeyToUtc(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

/** Forma maskasi: "12031985" → "12.03.1985" (yozish jarayonida nuqtalarni qoʻyadi, 8 raqamgacha) */
export function maskDateInput(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}.${d.slice(2)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 4)}.${d.slice(4)}`;
}

/** "YYYY-MM-DD" → "DD.MM.YYYY" (forma maydoni uchun) */
export function keyToDisplay(key: string | null | undefined): string {
  const p = key ? parseDateParts(key) : null;
  if (!p) return '';
  return `${String(p.day).padStart(2, '0')}.${String(p.month).padStart(2, '0')}.${String(p.year).padStart(4, '0')}`;
}

export type BirthDateProblem = 'invalid' | 'future' | 'tooOld';

/** Tugʻilgan sana qoidalari: haqiqiy sana, kelajakda emas, 1900 dan keyin */
export function checkBirthDate(
  v: string | Date | null | undefined,
  today: string = todayKey(),
): BirthDateProblem | null {
  const p = parseDateParts(v);
  if (!p || !isValidDateParts(p)) return 'invalid';
  if (p.year < MIN_BIRTH_YEAR) return 'tooOld';
  if (partsToKey(p) > today) return 'future';
  return null;
}

/** Toʻliq yillar (kalendar boʻyicha). Yaroqsiz sana → 0 */
export function ageFromKey(birthKey: string, today: string = todayKey()): number {
  const b = parseDateParts(birthKey);
  const t = parseDateParts(today);
  if (!b || !t) return 0;
  let age = t.year - b.year;
  if (t.month < b.month || (t.month === b.month && t.day < b.day)) age -= 1;
  return Math.max(0, age);
}

/** Toʻliq oylar (1 yoshgacha bolalar uchun "7 oy") */
export function monthsFromKey(birthKey: string, today: string = todayKey()): number {
  const b = parseDateParts(birthKey);
  const t = parseDateParts(today);
  if (!b || !t) return 0;
  let months = (t.year - b.year) * 12 + (t.month - b.month);
  if (t.day < b.day) months -= 1;
  return Math.max(0, months);
}

/**
 * Bola/katta chegara sanasi: shu sanadan KEYIN tugʻilganlar — bola (yoshi < childAgeLimit).
 * Masalan bugun 2026-09-15, limit 14 → "2012-09-15": 2012-09-15 da tugʻilgan 14 yoshda (katta),
 * 2012-09-16 da tugʻilgan 13 yoshda (bola).
 */
export function childCutoffKey(childAgeLimit: number, today: string = todayKey()): string {
  const t = parseDateParts(today) ?? { year: 2000, month: 1, day: 1 };
  const d = new Date(Date.UTC(t.year - childAgeLimit, t.month - 1, t.day));
  return d.toISOString().slice(0, 10);
}

/** Bemor turi — `determinePatientType` bilan bir xil natija, lekin kalendar kalitlari ustida */
export function patientTypeFor(
  birth: string | Date,
  childAgeLimit: number,
  today: string = todayKey(),
): PatientType {
  const key = toDateKey(birth);
  if (!key) return 'ADULT';
  return key > childCutoffKey(childAgeLimit, today) ? 'CHILD' : 'ADULT';
}

/** Yosh (yil) — API/UI uchun qulay: ISO/Date/kalit qabul qiladi */
export function patientAge(birth: string | Date, today: string = todayKey()): number {
  const key = toDateKey(birth);
  return key ? ageFromKey(key, today) : 0;
}

/** "34 yosh" / "7 oy" koʻrinishidagi matn uchun qismlar */
export function ageParts(
  birth: string | Date,
  today: string = todayKey(),
): { years: number; months: number } {
  const key = toDateKey(birth);
  if (!key) return { years: 0, months: 0 };
  return { years: ageFromKey(key, today), months: monthsFromKey(key, today) };
}
