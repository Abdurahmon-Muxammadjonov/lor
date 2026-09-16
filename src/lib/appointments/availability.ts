import { hmToMinutes, minutesToHm, todayKey } from '@/lib/date';
import type { DaySchedule, WeeklySchedule } from '@/lib/settings/types';
import type { AppointmentStatusCode } from './schemas';

/**
 * Yozilish kalendari uchun sof (server/client umumiy) yordamchilar:
 * Toshkent vaqti (UTC+5, DST yoʻq), shifokor jadvali, kesishuv (overlap), boʻsh slotlar,
 * SMS shablon, holat oʻtishlari. Hech qanday server-only import yoʻq — testlanadi.
 */

/** Asia/Tashkent = UTC+5, yozgi vaqt yoʻq (src/lib/date.ts dayRangeTz bilan bir xil faraz) */
export const CLINIC_UTC_OFFSET_MIN = 300;
export const CLINIC_UTC_OFFSET = '+05:00';

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type ScheduleReason = 'DAY_OFF' | 'OUTSIDE_HOURS' | 'BREAK';
export type SlotReason = ScheduleReason | 'TAKEN' | 'PAST';

/** Shifokor vaqtini band qiladigan holatlar (CANCELLED / NO_SHOW band qilmaydi) */
export const BLOCKING_STATUSES: readonly AppointmentStatusCode[] = [
  'SCHEDULED',
  'CONFIRMED',
  'ARRIVED',
  'DONE',
];

export function isBlockingStatus(status: string): boolean {
  return (BLOCKING_STATUSES as readonly string[]).includes(status);
}

/** Holatdan qaysi holatlarga oʻtish mumkin */
export const STATUS_TRANSITIONS: Record<AppointmentStatusCode, readonly AppointmentStatusCode[]> = {
  SCHEDULED: ['CONFIRMED', 'ARRIVED', 'CANCELLED', 'NO_SHOW'],
  CONFIRMED: ['ARRIVED', 'CANCELLED', 'NO_SHOW', 'SCHEDULED'],
  ARRIVED: ['DONE', 'CANCELLED', 'CONFIRMED'],
  DONE: [],
  CANCELLED: ['SCHEDULED'],
  NO_SHOW: ['SCHEDULED', 'ARRIVED'],
};

export function canTransition(from: AppointmentStatusCode, to: AppointmentStatusCode): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}

/** Vaqt/shifokorni oʻzgartirish faqat rejalashtirilgan yoki tasdiqlangan yozilishda mumkin */
export function isLockedForMove(status: AppointmentStatusCode): boolean {
  return status !== 'SCHEDULED' && status !== 'CONFIRMED';
}

// ───────────────────────── Toshkent vaqti ─────────────────────────

/** Sana → "YYYY-MM-DD" (Toshkent kuni) */
export function tzDateKey(d: Date): string {
  return todayKey(d);
}

/** Kun ichidagi daqiqa (0–1439) Toshkent vaqtida */
export function tzMinutesOfDay(d: Date): number {
  const m = Math.floor(d.getTime() / 60000) + CLINIC_UTC_OFFSET_MIN;
  return ((m % 1440) + 1440) % 1440;
}

/** "HH:mm" Toshkent vaqtida */
export function tzTime(d: Date | string): string {
  return minutesToHm(tzMinutesOfDay(new Date(d)));
}

export function isValidDateKey(s: string | null | undefined): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** "YYYY-MM-DD" → hafta kuni (0 = yakshanba … 6 = shanba) */
export function tzDayOfWeek(dateKey: string): Weekday {
  return new Date(`${dateKey}T00:00:00Z`).getUTCDay() as Weekday;
}

/** "YYYY-MM-DD" + n kun */
export function addDaysKey(dateKey: string, n: number): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Haftaning dushanbasi */
export function weekStartKey(dateKey: string): string {
  const dow = tzDayOfWeek(dateKey);
  return addDaysKey(dateKey, dow === 0 ? -6 : 1 - dow);
}

/** Dushanba … yakshanba (7 ta kalit) */
export function weekKeys(dateKey: string): string[] {
  const monday = weekStartKey(dateKey);
  return Array.from({ length: 7 }, (_, i) => addDaysKey(monday, i));
}

/** "YYYY-MM-DD" + "HH:mm" → Date (Toshkent vaqti) */
export function atTz(dateKey: string, hm: string): Date {
  return new Date(`${dateKey}T${hm}:00${CLINIC_UTC_OFFSET}`);
}

/** "YYYY-MM-DD" → mahalliy (brauzer) Date, kun oʻzgarmaydi — Calendar komponenti uchun */
export function keyToLocalDate(dateKey: string): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

/** Mahalliy Date → "YYYY-MM-DD" (kun mahalliy vaqtda) */
export function localDateToKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** "2026-09-15" → "15.09.2026" */
export function formatDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split('-');
  return `${d ?? ''}.${m ?? ''}.${y ?? ''}`;
}

export function durationMinutes(startAt: Date | string, endAt: Date | string): number {
  return Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000);
}

// ───────────────────────── Jadval ─────────────────────────

export function dayScheduleFor(schedule: WeeklySchedule, dateKey: string): DaySchedule {
  return schedule[tzDayOfWeek(dateKey)];
}

/**
 * Yozilish shifokor jadvaliga mos keladimi: kun yoqilgan, ish vaqti ichida, tanaffusga tushmaydi.
 * `null` — hammasi joyida.
 */
export function checkSchedule(schedule: WeeklySchedule, startAt: Date, endAt: Date): ScheduleReason | null {
  const dateKey = tzDateKey(startAt);
  const day = dayScheduleFor(schedule, dateKey);
  if (!day.enabled) return 'DAY_OFF';
  const s = tzMinutesOfDay(startAt);
  const e = s + durationMinutes(startAt, endAt);
  if (e > 1440) return 'OUTSIDE_HOURS';
  if (s < hmToMinutes(day.start) || e > hmToMinutes(day.end)) return 'OUTSIDE_HOURS';
  if (day.breakStart && day.breakEnd) {
    const bs = hmToMinutes(day.breakStart);
    const be = hmToMinutes(day.breakEnd);
    if (be > bs && overlaps(s, e, bs, be)) return 'BREAK';
  }
  return null;
}

/** Kun ichida ishlanmaydigan oraliqlar (daqiqalarda, [from, to)) — kalendarda shtrix uchun */
export function nonWorkingRanges(
  schedule: WeeklySchedule | null | undefined,
  dateKey: string,
  workStart: string,
  workEnd: string,
): Array<{ from: number; to: number; reason: ScheduleReason }> {
  const ws = hmToMinutes(workStart);
  const we = hmToMinutes(workEnd);
  if (!schedule) return [];
  const day = dayScheduleFor(schedule, dateKey);
  if (!day.enabled) return [{ from: ws, to: we, reason: 'DAY_OFF' }];
  const out: Array<{ from: number; to: number; reason: ScheduleReason }> = [];
  const ds = Math.max(ws, hmToMinutes(day.start));
  const de = Math.min(we, hmToMinutes(day.end));
  if (ds > ws) out.push({ from: ws, to: Math.min(ds, we), reason: 'OUTSIDE_HOURS' });
  if (de < we) out.push({ from: Math.max(de, ws), to: we, reason: 'OUTSIDE_HOURS' });
  if (day.breakStart && day.breakEnd) {
    const bs = Math.max(ws, hmToMinutes(day.breakStart));
    const be = Math.min(we, hmToMinutes(day.breakEnd));
    if (be > bs) out.push({ from: bs, to: be, reason: 'BREAK' });
  }
  return out.sort((a, b) => a.from - b.from);
}

// ───────────────────────── Kesishuv ─────────────────────────

type TimeLike = number | Date | string;
const ms = (v: TimeLike): number => (typeof v === 'number' ? v : new Date(v).getTime());

/** Yarim ochiq oraliqlar [aStart, aEnd) va [bStart, bEnd) kesishadimi (chegara tegishi — kesishuv emas) */
export function overlaps(aStart: TimeLike, aEnd: TimeLike, bStart: TimeLike, bEnd: TimeLike): boolean {
  return ms(aStart) < ms(bEnd) && ms(bStart) < ms(aEnd);
}

export interface BusyInterval {
  id: string;
  startAt: Date | string;
  endAt: Date | string;
  status: string;
}

/** Berilgan oraliq bilan kesishadigan (band qiluvchi) birinchi yozilish, boʻlmasa null */
export function findConflict<T extends BusyInterval>(
  items: readonly T[],
  startAt: TimeLike,
  endAt: TimeLike,
  excludeId?: string,
): T | null {
  for (const it of items) {
    if (excludeId && it.id === excludeId) continue;
    if (!isBlockingStatus(it.status)) continue;
    if (overlaps(startAt, endAt, it.startAt, it.endAt)) return it;
  }
  return null;
}

// ───────────────────────── Slotlar ─────────────────────────

export interface SlotInfo {
  /** "HH:mm" (Toshkent) */
  time: string;
  /** ISO */
  startAt: string;
  endAt: string;
  available: boolean;
  reason?: SlotReason;
}

export interface BuildSlotsOptions {
  dateKey: string;
  workStart: string;
  workEnd: string;
  slotMinutes: number;
  durationMin: number;
  schedule: WeeklySchedule;
  busy: readonly BusyInterval[];
  excludeId?: string;
  now?: Date;
}

/** Klinika ish vaqti boʻyicha slotlar roʻyxati: har biri boʻsh yoki sabab bilan band */
export function buildSlots(o: BuildSlotsOptions): SlotInfo[] {
  const ws = hmToMinutes(o.workStart);
  const we = hmToMinutes(o.workEnd);
  const step = Math.max(5, o.slotMinutes);
  const nowMs = (o.now ?? new Date()).getTime();
  const out: SlotInfo[] = [];
  for (let t = ws; t + o.durationMin <= we; t += step) {
    const time = minutesToHm(t);
    const startAt = atTz(o.dateKey, time);
    const endAt = new Date(startAt.getTime() + o.durationMin * 60000);
    let reason: SlotReason | undefined;
    if (endAt.getTime() <= nowMs) reason = 'PAST';
    else {
      const sched = checkSchedule(o.schedule, startAt, endAt);
      if (sched) reason = sched;
      else if (findConflict(o.busy, startAt, endAt, o.excludeId)) reason = 'TAKEN';
    }
    out.push({
      time,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      available: !reason,
      reason,
    });
  }
  return out;
}

/** Daqiqani slot toʻriga yaxlitlash (eng yaqin) va [min, max] ga qisish */
export function snapToSlot(minutes: number, slotMinutes: number, min: number, max: number): number {
  const step = Math.max(5, slotMinutes);
  const snapped = min + Math.round((minutes - min) / step) * step;
  return Math.min(max, Math.max(min, snapped));
}

// ───────────────────────── Joylashuv (lanes) ─────────────────────────

export interface LaneItem {
  id: string;
  start: number;
  end: number;
}

export interface LanePlacement {
  lane: number;
  lanes: number;
}

/** Kesishuvchi kartalarni yonma-yon ustunlarga (lane) taqsimlash */
export function layoutLanes(items: readonly LaneItem[]): Map<string, LanePlacement> {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
  const result = new Map<string, LanePlacement>();
  let cluster: Array<{ id: string; lane: number }> = [];
  let laneEnds: number[] = [];
  let clusterEnd = -Infinity;

  const flush = () => {
    const lanes = laneEnds.length;
    for (const c of cluster) result.set(c.id, { lane: c.lane, lanes });
    cluster = [];
    laneEnds = [];
  };

  for (const it of sorted) {
    if (cluster.length > 0 && it.start >= clusterEnd) flush();
    let lane = laneEnds.findIndex((end) => end <= it.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(it.end);
    } else {
      laneEnds[lane] = it.end;
    }
    cluster.push({ id: it.id, lane });
    clusterEnd = Math.max(clusterEnd, it.end);
  }
  if (cluster.length > 0) flush();
  return result;
}

// ───────────────────────── SMS ─────────────────────────

/** `{clinic}`, `{name}` … oʻrniga qiymat; nomaʼlum kalit oʻzgarmaydi */
export function renderTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) => (key in vars ? String(vars[key]) : m));
}

/** "Karimova Dilnoza Baxtiyorovna" → "Dilnoza" (SMS uchun ism) */
export function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  return parts[1] ?? parts[0] ?? fullName;
}

export interface SmsVars {
  clinic: string;
  phone: string;
  patientName: string;
  doctorName: string;
  startAt: Date;
}

/** Tasdiq/eslatma SMS matni (sana/vaqt Toshkent vaqtida) */
export function renderAppointmentSms(template: string, v: SmsVars): string {
  return renderTemplate(template, {
    clinic: v.clinic,
    name: shortName(v.patientName),
    date: formatDateKey(tzDateKey(v.startAt)),
    time: tzTime(v.startAt),
    doctor: v.doctorName,
    phone: v.phone,
  });
}
