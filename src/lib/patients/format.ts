import type { TFunction } from '@/i18n/t';
import type { Locale } from '@/i18n/config';
import { fmtDate, fmtDateTime, fmtSmartDate } from '@/lib/date';
import { normalizeSearch } from '@/lib/utils';
import { ageParts, toDateKey } from './age';

/**
 * Bemor maʼlumotlarini koʻrsatish uchun yordamchilar (client va server uchun xavfsiz).
 */

/** "34 yosh" / "7 oy" (1 yoshgacha) */
export function formatAge(birth: string | Date, t: TFunction, today?: string): string {
  const { years, months } = ageParts(birth, today);
  if (years >= 1) return `${years} ${t('patients.yearsShort')}`;
  return `${months} ${t('patients.monthsShort')}`;
}

/** Tugʻilgan sana: "20.05.1990" (ISO/Date dan, vaqt zonasiga bogʻliq emas) */
export function formatBirthDate(birth: string | Date, locale: Locale = 'uz'): string {
  const key = toDateKey(birth);
  if (!key) return '—';
  return fmtDate(`${key}T00:00:00`, locale);
}

/** Oxirgi tashrif: "Bugun, 14:32" / "Kecha, …" / "15.09.2026 14:32" */
export function formatLastVisit(at: string | null | undefined, locale: Locale, t: TFunction): string {
  if (!at) return t('patients.noVisits');
  return fmtSmartDate(at, locale);
}

export function formatDateTime(at: string | Date, locale: Locale): string {
  return fmtDateTime(at, locale);
}

const NONE_WORDS = new Set(['yoq', 'net', 'нет', 'no', 'none', '-', '—', 'yoʻq']);

/** "Yoʻq" / "Нет" / "-" kabi qiymatlar — maʼlumot yoʻq degani (allergiya/surunkali kasalliklar uchun) */
export function isNoneText(v: string | null | undefined): boolean {
  if (!v) return true;
  const n = normalizeSearch(v).replace(/[.!]/g, '');
  return n === '' || NONE_WORDS.has(n);
}

/** SMS shablonidagi {clinic},{name},… oʻrnini toʻldirish */
export function renderTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/** Xizmat nomi (snapshot) — joriy tilga mos */
export function lineName(line: { serviceName: string; serviceNameRu: string }, locale: Locale): string {
  return locale === 'ru' && line.serviceNameRu ? line.serviceNameRu : line.serviceName;
}
