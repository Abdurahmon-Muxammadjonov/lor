import { z } from 'zod';
import { zId } from '@/lib/api/validate';
import { PrintRawBodySchema } from '@/lib/printer/schemas';

/** Zod sxemalar — client va server bir xil (server-only importlarsiz). */

export const QueueTypeSchema = z.enum(['DOCTOR', 'RECHECK', 'LAB', 'CASHIER']);
export type QueueTypeInput = z.infer<typeof QueueTypeSchema>;

export const QueueStatusSchema = z.enum(['WAITING', 'CALLED', 'SERVING', 'DONE', 'SKIPPED']);

export const LocaleSchema = z.enum(['uz', 'ru']);

/** "YYYY-MM-DD" (Asia/Tashkent kuni) */
export const DateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')
  .refine((s) => !Number.isNaN(Date.parse(`${s}T00:00:00Z`)), 'Sana notoʻgʻri');

/** POST /api/queue */
export const CreateTicketSchema = z.object({
  type: QueueTypeSchema,
  patientId: zId.optional().nullable(),
  doctorId: zId.optional().nullable(),
  locale: LocaleSchema.optional(),
});
export type CreateTicketInput = z.infer<typeof CreateTicketSchema>;

/** Kiosk kaliti (Clinic.kioskKey — cuid yoki qoʻlda berilgan satr) */
export const KioskKeySchema = z.string().trim().min(4).max(128);

/** POST /api/kiosk/ticket */
export const KioskTicketSchema = z.object({
  key: KioskKeySchema,
  type: QueueTypeSchema,
  locale: LocaleSchema.optional(),
});
export type KioskTicketInput = z.infer<typeof KioskTicketSchema>;

/** POST /api/kiosk/print — kioskdan tarmoq printeriga xom baytlar (kalit bilan) */
export const KioskPrintSchema = PrintRawBodySchema.extend({ key: KioskKeySchema });
export type KioskPrintInput = z.infer<typeof KioskPrintSchema>;

/** Holat (umumiy) */
export const StatusSchema = z.object({ status: QueueStatusSchema });
export type StatusInput = z.infer<typeof StatusSchema>;

/** POST /api/queue/next */
export const NextTicketSchema = z.object({
  type: QueueTypeSchema.default('DOCTOR'),
});
export type NextTicketInput = z.infer<typeof NextTicketSchema>;

/** GET /api/queue?date= */
export const BoardQuerySchema = z.object({
  date: DateKeySchema.optional(),
});

/** GET /api/display/state?key= , /api/display/stream?key= */
export const DisplayQuerySchema = z.object({
  key: KioskKeySchema,
});

/** POST /api/queue/[id]/recall — `requeue: true` boʻlsa WAITING ga qaytaradi, aks holda qayta chaqiradi */
export const RecallSchema = z.object({
  requeue: z.boolean().optional(),
});
export type RecallInput = z.infer<typeof RecallSchema>;

/** POST /api/queue/[id]/visit */
export const VisitFromTicketSchema = z.object({
  doctorId: zId.optional().nullable(),
});
export type VisitFromTicketInput = z.infer<typeof VisitFromTicketSchema>;

/** POST /api/queue/[id]/patient */
export const LinkPatientSchema = z.object({
  patientId: zId,
});
export type LinkPatientInput = z.infer<typeof LinkPatientSchema>;

/** POST /api/queue/[id]/print */
export const PrintTicketSchema = z.object({
  locale: LocaleSchema.optional(),
});
