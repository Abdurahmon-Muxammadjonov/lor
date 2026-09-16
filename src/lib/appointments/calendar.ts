import { dayRangeTz, hmToMinutes } from '@/lib/date';
import type { WeeklySchedule } from '@/lib/settings/types';
import { durationMinutes, layoutLanes, tzDateKey, tzMinutesOfDay, weekKeys } from './availability';
import type { AppointmentDTO, DoctorOption } from './types';

/**
 * Kalendar koʻrinishi uchun sof yordamchilar (client + test): sana oraligʻi, ustunlar, kartalarni
 * vaqt oʻqiga joylashtirish. Server-only import yoʻq.
 */

export type CalendarView = 'day' | 'week';

export const CALENDAR_VIEWS: readonly CalendarView[] = ['day', 'week'];

export function isCalendarView(v: unknown): v is CalendarView {
  return v === 'day' || v === 'week';
}

/** Koʻrinish uchun soʻrov oraligʻi (ISO) va koʻrsatiladigan kun kalitlari */
export function rangeForView(
  view: CalendarView,
  dateKey: string,
): { from: string; to: string; keys: string[] } {
  if (view === 'day') {
    const r = dayRangeTz(dateKey);
    return { from: r.start.toISOString(), to: r.end.toISOString(), keys: [dateKey] };
  }
  const keys = weekKeys(dateKey);
  const first = keys[0] ?? dateKey;
  const last = keys[keys.length - 1] ?? dateKey;
  return { from: dayRangeTz(first).start.toISOString(), to: dayRangeTz(last).end.toISOString(), keys };
}

/** Yozilishning Toshkent kuni */
export function appointmentDateKey(a: Pick<AppointmentDTO, 'startAt'>): string {
  return tzDateKey(new Date(a.startAt));
}

/** Kun boʻyicha guruhlash (kalitlar tartiblangan) */
export function groupByDate<T extends Pick<AppointmentDTO, 'startAt'>>(
  items: readonly T[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  const sorted = [...items].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  for (const it of sorted) {
    const key = appointmentDateKey(it);
    const list = map.get(key);
    if (list) list.push(it);
    else map.set(key, [it]);
  }
  return new Map([...map.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
}

/** Kalendar ustuni: kun koʻrinishida — shifokor, hafta koʻrinishida — kun */
export interface CalendarColumn {
  /** Droppable identifikatori uchun kalit (`d:<doctorId>` yoki `w:<dateKey>`) */
  key: string;
  dateKey: string;
  /** Hafta koʻrinishida "barchasi" boʻlsa null — karta oʻz shifokorida qoladi */
  doctorId: string | null;
  schedule: WeeklySchedule | null;
  color: string;
  items: AppointmentDTO[];
}

export function dayColumns(
  dateKey: string,
  doctors: readonly DoctorOption[],
  items: readonly AppointmentDTO[],
): CalendarColumn[] {
  return doctors.map((d) => ({
    key: `d:${d.id}`,
    dateKey,
    doctorId: d.id,
    schedule: d.schedule,
    color: d.color,
    items: items.filter((a) => a.doctorId === d.id && appointmentDateKey(a) === dateKey),
  }));
}

export function weekColumns(
  keys: readonly string[],
  doctors: readonly DoctorOption[],
  items: readonly AppointmentDTO[],
): CalendarColumn[] {
  const single = doctors.length === 1 ? doctors[0] : undefined;
  const visible = new Set(doctors.map((d) => d.id));
  return keys.map((dateKey) => ({
    key: `w:${dateKey}`,
    dateKey,
    doctorId: single?.id ?? null,
    schedule: single?.schedule ?? null,
    color: single?.color ?? '#00D4FF',
    items: items.filter((a) => visible.has(a.doctorId) && appointmentDateKey(a) === dateKey),
  }));
}

export interface PlaceOptions {
  workStartMin: number;
  workEndMin: number;
  pxPerMin: number;
  /** Karta minimal balandligi (px) */
  minHeightPx: number;
}

export interface PlacedAppointment {
  appointment: AppointmentDTO;
  /** Kun ichidagi daqiqa (klinika ish vaqtiga qisilgan) */
  startMin: number;
  endMin: number;
  top: number;
  height: number;
  lane: number;
  lanes: number;
}

/** Ustundagi kartalarni piksel koordinatalariga va yonma-yon yoʻlaklarga (lane) joylashtirish */
export function placeAppointments(items: readonly AppointmentDTO[], o: PlaceOptions): PlacedAppointment[] {
  const bounded = items.map((a) => {
    const rawStart = tzMinutesOfDay(new Date(a.startAt));
    const rawEnd = rawStart + Math.max(1, durationMinutes(a.startAt, a.endAt));
    const startMin = Math.min(Math.max(rawStart, o.workStartMin), o.workEndMin);
    const endMin = Math.min(Math.max(rawEnd, startMin + 1), Math.max(o.workEndMin, startMin + 1));
    return { a, startMin, endMin };
  });
  const lanes = layoutLanes(bounded.map((b) => ({ id: b.a.id, start: b.startMin, end: b.endMin })));
  return bounded.map((b) => {
    const place = lanes.get(b.a.id) ?? { lane: 0, lanes: 1 };
    const top = (b.startMin - o.workStartMin) * o.pxPerMin;
    const height = Math.max(o.minHeightPx, (b.endMin - b.startMin) * o.pxPerMin - 2);
    return {
      appointment: b.a,
      startMin: b.startMin,
      endMin: b.endMin,
      top,
      height,
      lane: place.lane,
      lanes: place.lanes,
    };
  });
}

/** Toʻr oʻlchamlari: ish vaqti daqiqalarda va px/daqiqa */
export function gridMetrics(workStart: string, workEnd: string, slotMinutes: number, slotPx: number) {
  const workStartMin = hmToMinutes(workStart);
  const rawEnd = hmToMinutes(workEnd);
  const workEndMin = rawEnd > workStartMin ? rawEnd : workStartMin + 60;
  const step = Math.max(5, slotMinutes);
  const pxPerMin = slotPx / step;
  const rows: number[] = [];
  for (let t = workStartMin; t < workEndMin; t += step) rows.push(t);
  return {
    workStartMin,
    workEndMin,
    step,
    pxPerMin,
    rows,
    totalPx: Math.round((workEndMin - workStartMin) * pxPerMin),
  };
}

/** Ustunga bosilgan y (px) → slot boshlanish daqiqasi */
export function minuteFromOffset(
  offsetPx: number,
  o: { workStartMin: number; workEndMin: number; pxPerMin: number; step: number },
): number {
  const raw = o.workStartMin + offsetPx / o.pxPerMin;
  const snapped = o.workStartMin + Math.floor((raw - o.workStartMin) / o.step) * o.step;
  return Math.min(Math.max(snapped, o.workStartMin), o.workEndMin - o.step);
}
