import { z } from 'zod';
import { zId, zOptionalText } from '@/lib/api/validate';
import { dayRangeTz } from '@/lib/date';

/**
 * Yozilish (Appointment) zod sxemalari — client (react-hook-form) va server (route handler)
 * bir xil sxemadan foydalanadi. Bu fayl server-only importlarsiz (client bundle ga tushadi).
 *
 * Xato matnlari i18n kalitlari: UI da `t(message)` bilan tarjima qilinadi.
 */

export const APPOINTMENT_STATUSES = [
  'SCHEDULED',
  'CONFIRMED',
  'ARRIVED',
  'DONE',
  'CANCELLED',
  'NO_SHOW',
] as const;
export type AppointmentStatusCode = (typeof APPOINTMENT_STATUSES)[number];

export const MIN_DURATION_MIN = 5;
export const MAX_DURATION_MIN = 240;

/** ISO 8601 sana-vaqt (`2026-09-15T04:00:00.000Z` yoki `+05:00` bilan) */
export const zIsoDateTime = z
  .string()
  .datetime({ offset: true, message: 'common.validation.date' })
  .refine((s) => !Number.isNaN(new Date(s).getTime()), 'common.validation.date');

/** "YYYY-MM-DD" kalit (Toshkent kuni) */
export const zDateKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'common.validation.date')
  .refine((s) => !Number.isNaN(new Date(`${s}T00:00:00Z`).getTime()), 'common.validation.date');

export const zDurationMin = z.coerce
  .number({ invalid_type_error: 'common.validation.number' })
  .int('appointments.validation.duration')
  .min(MIN_DURATION_MIN, 'appointments.validation.duration')
  .max(MAX_DURATION_MIN, 'appointments.validation.duration');

export const zAppointmentStatus = z.enum(APPOINTMENT_STATUSES);

/** POST /api/appointments */
export const CreateAppointmentSchema = z.object({
  patientId: zId,
  doctorId: zId,
  startAt: zIsoDateTime,
  /** Berilmasa — clinic.slotMinutes */
  durationMin: zDurationMin.optional(),
  note: zOptionalText(500),
});
export type CreateAppointmentInput = z.infer<typeof CreateAppointmentSchema>;

/** PATCH /api/appointments/[id] — kamida bitta maydon */
export const UpdateAppointmentSchema = z
  .object({
    startAt: zIsoDateTime.optional(),
    doctorId: zId.optional(),
    durationMin: zDurationMin.optional(),
    note: zOptionalText(500),
  })
  .refine(
    (v) =>
      v.startAt !== undefined ||
      v.doctorId !== undefined ||
      v.durationMin !== undefined ||
      v.note !== undefined,
    { message: 'common.validation.required', path: ['startAt'] },
  );
export type UpdateAppointmentInput = z.infer<typeof UpdateAppointmentSchema>;

/** POST /api/appointments/[id]/status */
export const AppointmentStatusSchema = z.object({
  status: zAppointmentStatus,
});
export type AppointmentStatusInput = z.infer<typeof AppointmentStatusSchema>;

/**
 * Oraliq chegarasi: toʻliq ISO sana-vaqt YOKI "YYYY-MM-DD" kalit.
 * Kalit berilsa Toshkent kunining boshiga (`from`) / oxiriga (`to`) kengaytiriladi —
 * shunda `?from=2026-09-16&to=2026-09-23` koʻrinishdagi soʻrov ham ishlaydi.
 * Notoʻgʻri kalit oʻzgarishsiz oʻtadi va `zIsoDateTime` uni rad etadi (VALIDATION).
 */
function zRangeBound(edge: 'start' | 'end') {
  return z
    .string()
    .transform((s) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      const d = dayRangeTz(s)[edge];
      return Number.isNaN(d.getTime()) ? s : d.toISOString();
    })
    .pipe(zIsoDateTime);
}

/** GET /api/appointments?from&to&doctorId&status */
export const RangeQuerySchema = z
  .object({
    from: zRangeBound('start'),
    to: zRangeBound('end'),
    doctorId: zId.optional(),
    patientId: zId.optional(),
    status: zAppointmentStatus.optional(),
  })
  .refine((v) => new Date(v.from).getTime() < new Date(v.to).getTime(), {
    message: 'common.validation.date',
    path: ['to'],
  })
  .refine((v) => new Date(v.to).getTime() - new Date(v.from).getTime() <= 62 * 24 * 60 * 60 * 1000, {
    message: 'common.validation.max',
    path: ['to'],
  });
export type RangeQueryInput = z.infer<typeof RangeQuerySchema>;

/** GET /api/appointments/slots?doctorId&date&durationMin&excludeId */
export const SlotsQuerySchema = z.object({
  doctorId: zId,
  date: zDateKey,
  durationMin: zDurationMin.optional(),
  /** Tahrirlashda oʻzining vaqti band hisoblanmasin */
  excludeId: zId.optional(),
});
export type SlotsQueryInput = z.infer<typeof SlotsQuerySchema>;

/** Dialog formasi (react-hook-form): sana + vaqt alohida, serverga `startAt` ISO yuboriladi */
export const AppointmentFormSchema = z.object({
  patientId: z.string({ required_error: 'common.validation.required' }).min(1, 'common.validation.required'),
  doctorId: z.string({ required_error: 'common.validation.required' }).min(1, 'common.validation.required'),
  date: zDateKey,
  time: z
    .string({ required_error: 'appointments.validation.time' })
    .regex(/^\d{2}:\d{2}$/, 'appointments.validation.time'),
  durationMin: zDurationMin,
  note: z.string().trim().max(500, 'common.validation.max'),
});
export type AppointmentFormValues = z.infer<typeof AppointmentFormSchema>;
