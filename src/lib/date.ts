import { format, formatDistanceToNowStrict, isToday, isYesterday, startOfDay, endOfDay, addDays, subDays } from 'date-fns';
import { uz, ru } from 'date-fns/locale';
import type { Locale } from '@/i18n/config';

export const CLINIC_TZ = 'Asia/Tashkent';

const dfLocale = (l: Locale) => (l === 'ru' ? ru : uz);

/** 15.09.2026 */
export const fmtDate = (d: Date | string, l: Locale = 'uz') => format(new Date(d), 'dd.MM.yyyy', { locale: dfLocale(l) });
/** 14:32 */
export const fmtTime = (d: Date | string, l: Locale = 'uz') => format(new Date(d), 'HH:mm', { locale: dfLocale(l) });
/** 15.09.2026 14:32 */
export const fmtDateTime = (d: Date | string, l: Locale = 'uz') =>
  format(new Date(d), 'dd.MM.yyyy HH:mm', { locale: dfLocale(l) });
/** 15 sentabr 2026 */
export const fmtDateLong = (d: Date | string, l: Locale = 'uz') => format(new Date(d), 'd MMMM yyyy', { locale: dfLocale(l) });
/** Dushanba, 15 sentabr */
export const fmtWeekday = (d: Date | string, l: Locale = 'uz') => format(new Date(d), 'EEEE, d MMMM', { locale: dfLocale(l) });

export const fmtRelative = (d: Date | string, l: Locale = 'uz') =>
  formatDistanceToNowStrict(new Date(d), { locale: dfLocale(l), addSuffix: true });

export function fmtSmartDate(d: Date | string, l: Locale = 'uz'): string {
  const date = new Date(d);
  if (isToday(date)) return (l === 'ru' ? 'Сегодня, ' : 'Bugun, ') + fmtTime(date, l);
  if (isYesterday(date)) return (l === 'ru' ? 'Вчера, ' : 'Kecha, ') + fmtTime(date, l);
  return fmtDateTime(date, l);
}

/** Toshkent vaqti boʻyicha bugungi kun (YYYY-MM-DD) — navbat raqamlari uchun */
export function todayKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: CLINIC_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** "YYYY-MM-DD" → Date (UTC yarim tun) — Prisma @db.Date uchun */
export function dateKeyToDate(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

/** Toshkent vaqti boʻyicha kun boshlanishi/oxiri (UTC Date sifatida, DB filtrlash uchun) */
export function dayRangeTz(dateKey: string): { start: Date; end: Date } {
  // Asia/Tashkent = UTC+5, DST yoʻq
  const start = new Date(`${dateKey}T00:00:00+05:00`);
  const end = new Date(`${dateKey}T23:59:59.999+05:00`);
  return { start, end };
}

export function todayRange(now: Date = new Date()) {
  return dayRangeTz(todayKey(now));
}

export function yesterdayRange(now: Date = new Date()) {
  const y = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return dayRangeTz(todayKey(y));
}

export { startOfDay, endOfDay, addDays, subDays };

/** "HH:mm" → daqiqalar */
export function hmToMinutes(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function minutesToHm(min: number): string {
  const h = Math.floor(min / 60)
    .toString()
    .padStart(2, '0');
  const m = (min % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}
