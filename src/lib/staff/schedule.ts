import { hmToMinutes, minutesToHm } from '@/lib/date';
import { parseWeeklySchedule, type DaySchedule, type WeeklySchedule } from '@/lib/settings/types';
import type { WeeklyScheduleInput } from './schemas';

/**
 * Haftalik ish jadvali yordamchilari (sof, client/server).
 * Kalitlar JS `Date.getDay()` bilan bir xil: 0 — yakshanba … 6 — shanba.
 */

export type DayKey = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** Dushanbadan boshlab koʻrsatish tartibi */
export const DAY_ORDER: readonly DayKey[] = [1, 2, 3, 4, 5, 6, 0];

/** Ish kunlari (Du–Ju) */
export const WEEKDAYS: readonly DayKey[] = [1, 2, 3, 4, 5];

export function isDayKey(v: number): v is DayKey {
  return Number.isInteger(v) && v >= 0 && v <= 6;
}

/** Kunlik ish daqiqalari (tanaffus ayirilgan); oʻchirilgan kun → 0 */
export function dayMinutes(day: DaySchedule): number {
  if (!day.enabled) return 0;
  const total = hmToMinutes(day.end) - hmToMinutes(day.start);
  if (total <= 0) return 0;
  const brk =
    day.breakStart && day.breakEnd ? Math.max(0, hmToMinutes(day.breakEnd) - hmToMinutes(day.breakStart)) : 0;
  return Math.max(0, total - brk);
}

/** Haftalik soatlar (0.5 aniqlikda) */
export function weeklyHours(schedule: WeeklySchedule): number {
  const minutes = DAY_ORDER.reduce<number>((sum, k) => sum + dayMinutes(schedule[k]), 0);
  return Math.round((minutes / 60) * 2) / 2;
}

/** "09:00–18:00" */
export function formatDayRange(day: DaySchedule, dash = '–'): string {
  return `${day.start}${dash}${day.end}`;
}

/** "13:00–14:00" yoki null */
export function formatBreak(day: DaySchedule, dash = '–'): string | null {
  return day.breakStart && day.breakEnd ? `${day.breakStart}${dash}${day.breakEnd}` : null;
}

/** Shu daqiqada ishlayaptimi (tanaffus hisobga olinadi) */
export function isWorkingAt(schedule: WeeklySchedule, at: Date): boolean {
  const key = at.getDay();
  if (!isDayKey(key)) return false;
  const day = schedule[key];
  if (!day.enabled) return false;
  const m = at.getHours() * 60 + at.getMinutes();
  if (m < hmToMinutes(day.start) || m >= hmToMinutes(day.end)) return false;
  if (day.breakStart && day.breakEnd && m >= hmToMinutes(day.breakStart) && m < hmToMinutes(day.breakEnd)) return false;
  return true;
}

/** Barcha jadvallar boʻyicha vaqt oʻqi chegarasi (soatlarga yaxlitlangan, kamida 08:00–20:00) */
export function timelineBounds(schedules: WeeklySchedule[]): { startMin: number; endMin: number } {
  let startMin = 8 * 60;
  let endMin = 20 * 60;
  for (const s of schedules) {
    for (const k of DAY_ORDER) {
      const d = s[k];
      if (!d.enabled) continue;
      startMin = Math.min(startMin, hmToMinutes(d.start));
      endMin = Math.max(endMin, hmToMinutes(d.end));
    }
  }
  startMin = Math.floor(startMin / 60) * 60;
  endMin = Math.ceil(endMin / 60) * 60;
  if (endMin <= startMin) endMin = startMin + 60;
  return { startMin, endMin };
}

/** Kunlik bar segmentlari (foizda) — tanaffus boʻlsa ikkiga boʻlinadi */
export function daySegments(day: DaySchedule, bounds: { startMin: number; endMin: number }): { left: number; width: number }[] {
  if (!day.enabled) return [];
  const span = bounds.endMin - bounds.startMin;
  const pct = (m: number) => Math.min(100, Math.max(0, ((m - bounds.startMin) / span) * 100));
  const s = hmToMinutes(day.start);
  const e = hmToMinutes(day.end);
  if (e <= s) return [];
  const seg = (a: number, b: number) => ({ left: pct(a), width: Math.max(0, pct(b) - pct(a)) });
  if (day.breakStart && day.breakEnd) {
    const bs = hmToMinutes(day.breakStart);
    const be = hmToMinutes(day.breakEnd);
    if (bs > s && be < e && be > bs) return [seg(s, bs), seg(be, e)];
  }
  return [seg(s, e)];
}

/** Soat belgilari (vaqt oʻqi uchun): 08:00, 10:00, … */
export function timelineTicks(bounds: { startMin: number; endMin: number }, stepMin = 120): string[] {
  const ticks: string[] = [];
  for (let m = bounds.startMin; m <= bounds.endMin; m += stepMin) ticks.push(minutesToHm(m));
  return ticks;
}

/** DB jadvali → forma qiymatlari (tanaffus boʻsh satr sifatida) */
export function scheduleToForm(schedule: WeeklySchedule): WeeklyScheduleInput {
  const day = (d: DaySchedule) => ({
    enabled: d.enabled,
    start: d.start,
    end: d.end,
    breakStart: d.breakStart ?? '',
    breakEnd: d.breakEnd ?? '',
  });
  return {
    0: day(schedule[0]),
    1: day(schedule[1]),
    2: day(schedule[2]),
    3: day(schedule[3]),
    4: day(schedule[4]),
    5: day(schedule[5]),
    6: day(schedule[6]),
  };
}

/** Yangi xodim uchun standart jadval (Du–Ju 09–18, tanaffus 13–14; Sh 09–14; Ya dam) */
export function defaultScheduleForm(): WeeklyScheduleInput {
  const base = parseWeeklySchedule({});
  const withBreak: WeeklySchedule = { ...base };
  for (const k of WEEKDAYS) withBreak[k] = { ...base[k], breakStart: '13:00', breakEnd: '14:00' };
  return scheduleToForm(withBreak);
}

/** Haftaning dushanbasi (mahalliy vaqt) */
export function startOfWeekMonday(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = x.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  x.setDate(x.getDate() + diff);
  return x;
}
