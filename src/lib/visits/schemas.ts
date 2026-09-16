import { z } from 'zod';
import { zId, zMoney, zOptionalText, zPage, zQuantity } from '@/lib/api/validate';

/**
 * Qabul (Visit) va muolaja qatorlari uchun Zod sxemalar.
 * Client (formalar) va server (API) bir xil sxemadan foydalanadi — server importlari YOʻQ.
 */

export const PatientTypeSchema = z.enum(['ADULT', 'CHILD']);
export const DiscountTypeSchema = z.enum(['NONE', 'PERCENT', 'FIXED']);
export const SideSchema = z.enum(['LEFT', 'RIGHT', 'BOTH']);
export const OrganSchema = z.enum(['EAR', 'NOSE', 'THROAT', 'LARYNX', 'OTHER']);
export const VisitStatusSchema = z.enum(['OPEN', 'COMPLETED', 'CANCELLED']);

/** POST /api/visits */
export const CreateVisitSchema = z.object({
  patientId: zId,
  /** DOCTOR uchun eʼtiborga olinmaydi (oʻzi boʻladi); ADMIN/RECEPTION uchun majburiy */
  doctorId: zId.optional(),
  queueId: zId.optional(),
  appointmentId: zId.optional(),
});
export type CreateVisitInput = z.infer<typeof CreateVisitSchema>;

/** ICD-10 kodi: H66.0, J01, T17.1 — harf + 2 raqam (+ .raqam) */
const zIcd10 = z
  .string()
  .trim()
  .toUpperCase()
  .max(10)
  .refine((s) => s === '' || /^[A-Z]\d{2}(\.\d{1,2})?$/.test(s), 'ICD-10 kodi notoʻgʻri')
  .optional()
  .nullable();

/** PATCH /api/visits/[id] — klinik maydonlar (barchasi ixtiyoriy, kelgani yangilanadi) */
export const UpdateVisitSchema = z
  .object({
    complaint: zOptionalText(2000),
    anamnesis: zOptionalText(2000),
    examination: zOptionalText(2000),
    diagnosis: zOptionalText(2000),
    icd10: zIcd10,
    plan: zOptionalText(2000),
    recommendations: zOptionalText(2000),
  })
  .strict();
export type UpdateVisitInput = z.infer<typeof UpdateVisitSchema>;

/** POST /api/visits/[id]/lines */
export const AddLineSchema = z
  .object({
    serviceId: zId,
    patientType: PatientTypeSchema,
    withMedicine: z.boolean(),
    quantity: zQuantity,
    discountType: DiscountTypeSchema.default('NONE'),
    discountValue: zMoney.default(0),
    side: SideSchema.optional().nullable(),
    organ: OrganSchema.optional().nullable(),
    detail: zOptionalText(200),
    note: zOptionalText(500),
  })
  .superRefine((v, ctx) => {
    if (v.discountType === 'PERCENT' && v.discountValue > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['discountValue'],
        message: 'Foiz 100 dan oshmasligi kerak',
      });
    }
  });
export type AddLineInput = z.infer<typeof AddLineSchema>;

/** PATCH /api/visits/[id]/lines/[lineId] — qisman */
export const UpdateLineSchema = z
  .object({
    serviceId: zId.optional(),
    patientType: PatientTypeSchema.optional(),
    withMedicine: z.boolean().optional(),
    quantity: zQuantity.optional(),
    discountType: DiscountTypeSchema.optional(),
    discountValue: zMoney.optional(),
    side: SideSchema.optional().nullable(),
    organ: OrganSchema.optional().nullable(),
    detail: zOptionalText(200),
    note: zOptionalText(500),
  })
  .superRefine((v, ctx) => {
    if (v.discountType === 'PERCENT' && v.discountValue !== undefined && v.discountValue > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['discountValue'],
        message: 'Foiz 100 dan oshmasligi kerak',
      });
    }
  });
export type UpdateLineInput = z.infer<typeof UpdateLineSchema>;

/** PATCH /api/visits/[id]/discount */
export const GlobalDiscountSchema = z
  .object({
    type: DiscountTypeSchema,
    value: zMoney.default(0),
  })
  .superRefine((v, ctx) => {
    if (v.type === 'PERCENT' && v.value > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'Foiz 100 dan oshmasligi kerak',
      });
    }
  });
export type GlobalDiscountInput = z.infer<typeof GlobalDiscountSchema>;

const zDateKey = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Sana YYYY-MM-DD boʻlishi kerak');

/** GET /api/visits?from=&to=&doctorId=&patientId=&status=&page=&pageSize= */
export const ListVisitsQuerySchema = z
  .object({
    from: zDateKey.optional(),
    to: zDateKey.optional(),
    doctorId: zId.optional(),
    patientId: zId.optional(),
    status: VisitStatusSchema.optional(),
  })
  .merge(zPage);
export type ListVisitsQuery = z.infer<typeof ListVisitsQuerySchema>;

/** GET /api/icd10?q=&limit= */
export const Icd10QuerySchema = z.object({
  q: z.string().trim().max(100).default(''),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  /** Reyting tili (berilmasa cookie / Accept-Language) */
  locale: z.enum(['uz', 'ru']).optional(),
});
export type Icd10Query = z.infer<typeof Icd10QuerySchema>;
