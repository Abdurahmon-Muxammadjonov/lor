import type { AppointmentStatusCode } from '@/lib/appointments/schemas';
import { isAppointmentErrorDetails } from '@/lib/appointments/types';

/** Bitta slot balandligi (px) — daqiqa/px nisbati clinic.slotMinutes dan hisoblanadi */
export const SLOT_PX = 56;
/** Vaqt oʻqi ustuni kengligi */
export const AXIS_W = '3.5rem';
/** Ustun minimal kengligi (kun koʻrinishida gorizontal aylantirish) */
export const COLUMN_MIN_W = '11rem';
/** Karta minimal balandligi */
export const CARD_MIN_PX = 22;

/** Holat ranglari (hex) — chegara/tint uchun */
export const STATUS_COLOR: Record<AppointmentStatusCode, string> = {
  SCHEDULED: '#8A99B8',
  CONFIRMED: '#00D4FF',
  ARRIVED: '#FFB547',
  DONE: '#00FFB2',
  CANCELLED: '#FF4D6D',
  NO_SHOW: '#7C5CFF',
};

export const STATUS_ORDER: readonly AppointmentStatusCode[] = [
  'SCHEDULED',
  'CONFIRMED',
  'ARRIVED',
  'DONE',
  'CANCELLED',
  'NO_SHOW',
];

/** Davomiylik variantlari (daqiqa); klinika slot davomiyligi qoʻshiladi */
export const DURATION_PRESETS = [10, 15, 20, 30, 40, 45, 60, 90, 120] as const;

export function durationOptions(slotMinutes: number): number[] {
  const set = new Set<number>([...DURATION_PRESETS, slotMinutes, slotMinutes * 2]);
  return [...set].filter((n) => n >= 5 && n <= 240).sort((a, b) => a - b);
}

/** #RRGGBB + alpha (0–1) → #RRGGBBAA */
export function withAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, '0');
  return `#${m[1]}${a}`;
}

interface ErrorLike {
  message: string;
  code?: string;
  details?: unknown;
}

/** API xatosini foydalanuvchi tiliga oʻgirish: details.reason → appointments.errors.*, aks holda message */
export function appointmentErrorMessage(t: (key: string) => string, err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as ErrorLike;
    if (isAppointmentErrorDetails(e.details)) {
      const key = `appointments.errors.${e.details.reason}`;
      const translated = t(key);
      if (translated !== key) return translated;
    }
    if (e.code === 'NOT_FOUND') return t('appointments.errors.NOT_FOUND');
    if (typeof e.message === 'string' && e.message) return e.message;
  }
  return t('common.error');
}
