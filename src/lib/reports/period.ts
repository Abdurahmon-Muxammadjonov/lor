import { format } from 'date-fns';
import { ru as dfRu, uz as dfUz } from 'date-fns/locale';
import type { Locale } from '@/i18n/config';
import { todayKey } from '@/lib/date';
import type { DateKey, GroupBy, PeriodDTO, ReportRange } from './types';

/**
 * Davrlar bilan ishlash — sof funksiyalar (client va server uchun).
 * Barcha hisoblar "YYYY-MM-DD" kalitlar ustida UTC arifmetikasi bilan bajariladi,
 * shuning uchun brauzer/server vaqt zonasi natijaga taʼsir qilmaydi.
 * SQL tomonda xuddi shu kalitlar hosil qilinadi (queries.ts → bucketExpr).
 */

export const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
/** Bir soʻrovda ruxsat etilgan eng uzun davr (kun) */
export const MAX_RANGE_DAYS = 731;

const DAY_MS = 86_400_000;

export function isDateKey(v: unknown): v is DateKey {
  if (typeof v !== 'string' || !DATE_KEY_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** "YYYY-MM-DD" → UTC yarim tun */
export function parseDateKey(key: DateKey): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

/** UTC komponentlardan kalit */
export function dateKeyUtc(d: Date): DateKey {
  return d.toISOString().slice(0, 10);
}

/** Lokal komponentlardan kalit (Calendar tanlovi — lokal yarim tun) */
export function dateKeyLocal(d: Date): DateKey {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Kalit → lokal yarim tun (Calendar `value` uchun) */
export function dateKeyToLocalDate(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function addDaysKey(key: DateKey, days: number): DateKey {
  return dateKeyUtc(new Date(parseDateKey(key).getTime() + days * DAY_MS));
}

/** `to` − `from` (kunlarda), shu kunlar ham kiradi: daysInRange('2026-09-01','2026-09-01') = 1 */
export function daysInRange(from: DateKey, to: DateKey): number {
  return Math.round((parseDateKey(to).getTime() - parseDateKey(from).getTime()) / DAY_MS) + 1;
}

/** Dushanba (ISO hafta boshi) kaliti */
export function weekStartKey(key: DateKey): DateKey {
  const d = parseDateKey(key);
  const offset = (d.getUTCDay() + 6) % 7; // 0 = dushanba
  return dateKeyUtc(new Date(d.getTime() - offset * DAY_MS));
}

export function monthStartKey(key: DateKey): DateKey {
  return `${key.slice(0, 7)}-01`;
}

export function monthEndKey(key: DateKey): DateKey {
  const d = parseDateKey(key);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return dateKeyUtc(last);
}

/** Kun kaliti → bucket kaliti (SQL bilan bir xil: kun/hafta → "YYYY-MM-DD", oy → "YYYY-MM") */
export function periodKey(dateKey: DateKey, groupBy: GroupBy): string {
  switch (groupBy) {
    case 'day':
      return dateKey;
    case 'week':
      return weekStartKey(dateKey);
    case 'month':
      return dateKey.slice(0, 7);
  }
}

/** Bucket kaliti → toʻliq chegaralar (qisqartirilmagan) */
export function periodBounds(key: string, groupBy: GroupBy): { start: DateKey; end: DateKey } {
  switch (groupBy) {
    case 'day':
      return { start: key, end: key };
    case 'week':
      return { start: key, end: addDaysKey(key, 6) };
    case 'month': {
      const start = `${key}-01`;
      return { start, end: monthEndKey(start) };
    }
  }
}

/** [from,to] oraligʻidagi barcha bucketlar (boʻsh davrlar ham), chegaralar oraliqqa qisqartirilgan */
export function buildPeriods(from: DateKey, to: DateKey, groupBy: GroupBy): PeriodDTO[] {
  const out: PeriodDTO[] = [];
  if (from > to) return out;
  let cursor = from;
  let guard = 0;
  while (cursor <= to && guard < 5000) {
    const key = periodKey(cursor, groupBy);
    const bounds = periodBounds(key, groupBy);
    const end = bounds.end < to ? bounds.end : to;
    out.push({ period: key, start: cursor, end });
    cursor = addDaysKey(end, 1);
    guard += 1;
  }
  return out;
}

/** from ≤ to boʻlishini taʼminlash va maksimal uzunlikka qisqartirish */
export function normalizeRange(from: DateKey, to: DateKey, maxDays = MAX_RANGE_DAYS): ReportRange {
  let a = from;
  let b = to;
  if (a > b) [a, b] = [b, a];
  if (daysInRange(a, b) > maxDays) a = addDaysKey(b, -(maxDays - 1));
  return { from: a, to: b };
}

/** Xuddi shu uzunlikdagi oldingi davr */
export function previousRange(range: ReportRange): ReportRange {
  const len = daysInRange(range.from, range.to);
  const to = addDaysKey(range.from, -1);
  return { from: addDaysKey(to, -(len - 1)), to };
}

export const RANGE_PRESETS = ['today', 'yesterday', 'week', 'month', 'lastMonth'] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

/** Tayyor davrlar (Asia/Tashkent bugungi kun boʻyicha) */
export function presetRange(preset: RangePreset, now: Date = new Date()): ReportRange {
  const today = todayKey(now);
  switch (preset) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const y = addDaysKey(today, -1);
      return { from: y, to: y };
    }
    case 'week':
      return { from: weekStartKey(today), to: today };
    case 'month':
      return { from: monthStartKey(today), to: today };
    case 'lastMonth': {
      const prevEnd = addDaysKey(monthStartKey(today), -1);
      return { from: monthStartKey(prevEnd), to: prevEnd };
    }
  }
}

/** Tanlangan davr qaysi presetga mos kelishini aniqlash (tugmani belgilash uchun) */
export function detectPreset(range: ReportRange, now: Date = new Date()): RangePreset | null {
  for (const p of RANGE_PRESETS) {
    const r = presetRange(p, now);
    if (r.from === range.from && r.to === range.to) return p;
  }
  return null;
}

/** Davr uchun mos guruhlash: ≤ 31 kun — kun, ≤ 120 kun — hafta, aks holda oy */
export function suggestGroupBy(range: ReportRange): GroupBy {
  const days = daysInRange(range.from, range.to);
  if (days <= 31) return 'day';
  if (days <= 120) return 'week';
  return 'month';
}

const dfLocale = (l: Locale) => (l === 'ru' ? dfRu : dfUz);

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "2026-09-15" → "15.09.2026" */
export function formatDateKey(key: DateKey): string {
  const [y, m, d] = key.split('-');
  return `${d}.${m}.${y}`;
}

/** Davr belgisi: kun — "15.09", hafta — "15.09 – 21.09", oy — "Sentabr 2026" */
export function formatPeriodLabel(p: PeriodDTO, groupBy: GroupBy, locale: Locale, opts: { long?: boolean } = {}): string {
  const l = dfLocale(locale);
  const start = parseDateKey(p.start);
  const end = parseDateKey(p.end);
  const dayFmt = opts.long ? 'd MMM yyyy' : 'dd.MM';
  switch (groupBy) {
    case 'day':
      return opts.long ? format(start, 'd MMMM yyyy, EEEE', { locale: l }) : format(start, dayFmt, { locale: l });
    case 'week':
      return `${format(start, dayFmt, { locale: l })} – ${format(end, dayFmt, { locale: l })}`;
    case 'month':
      return capitalize(format(start, opts.long ? 'LLLL yyyy' : 'LLL yyyy', { locale: l }));
  }
}

/** Davr sarlavhasi: "01.09.2026 – 15.09.2026" yoki bitta kun */
export function formatRangeLabel(range: ReportRange): string {
  return range.from === range.to ? formatDateKey(range.from) : `${formatDateKey(range.from)} – ${formatDateKey(range.to)}`;
}

/** "{name}" koʻrinishidagi joy tutuvchilarni almashtirish (SMS shablonlari) */
export function renderTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export const DEBT_REMINDER_TEMPLATES: Record<Locale, string> = {
  uz: '{clinic}: Hurmatli {name}, klinikamiz oldida {amount} soʻm qarzingiz mavjud. Iltimos, toʻlovni amalga oshiring. Tel: {phone}',
  ru: '{clinic}: Уважаемый(ая) {name}, у вас имеется задолженность перед клиникой на сумму {amount} сум. Просим погасить её. Тел: {phone}',
};

export interface DebtReminderVars {
  clinic: string;
  name: string;
  amount: string;
  phone: string;
}

export function debtReminderText(locale: Locale, vars: DebtReminderVars): string {
  return renderTemplate(DEBT_REMINDER_TEMPLATES[locale], { ...vars });
}
