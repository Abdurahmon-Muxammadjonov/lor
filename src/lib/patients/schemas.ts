import { z } from 'zod';
import { sanitizeText, zPage, zPhone, zText } from '@/lib/api/validate';
import { checkBirthDate, dateKeyToUtc, toDateKey } from './age';

/**
 * Bemor sxemalari. Client (RHF) va server (API) bir xil qoidalarni ishlatadi:
 *   - `PatientFormSchema` — forma qiymatlari (hammasi satr/boolean, kirish == chiqish tipi)
 *   - `PatientSchema` / `PatientPatchSchema` — API tanasi (normallashtirilgan: null, Date)
 *   - `toPatientPayload(values)` — forma → API tanasi
 * Xato xabarlari i18n KALITLARI — UI `t(error.message)` qiladi.
 */

export const FULL_NAME_MIN = 3;
export const FULL_NAME_MAX = 120;
export const ADDRESS_MAX = 200;
export const ALLERGIES_MAX = 500;
export const CHRONIC_MAX = 500;
export const NOTES_MAX = 1000;
export const SOURCE_MAX = 60;

export const GenderEnum = z.enum(['MALE', 'FEMALE']);
export type GenderValue = z.infer<typeof GenderEnum>;

const PHONE_RE = /^\+?\d{9,13}$/;
const phoneDigits = (s: string) => s.replace(/[^\d+]/g, '');
const isPhone = (s: string) => PHONE_RE.test(phoneDigits(s));

// ── Server (API) sxemalari ──

/** Tugʻilgan sana → UTC yarim tun Date; qoidalar: haqiqiy, ≥ 1900, kelajakda emas */
export const zBirthDate = z
  .union([z.string(), z.date()])
  .superRefine((v, ctx) => {
    const problem = checkBirthDate(v);
    if (problem === 'invalid')
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'patients.validation.birthDate' });
    if (problem === 'future')
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'patients.validation.birthFuture' });
    if (problem === 'tooOld')
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'patients.validation.birthTooOld' });
  })
  .transform((v) => dateKeyToUtc(toDateKey(v) ?? '1900-01-01'));

/** Ixtiyoriy matn: "" / null / undefined → null, aks holda tozalangan satr */
export const zNullableText = (max: number) =>
  z
    .union([z.null(), z.undefined(), zText(max)])
    .transform((v) => (typeof v === 'string' && v.length > 0 ? v : null));

/** Ixtiyoriy telefon: "" / null → null, aks holda +998XXXXXXXXX */
export const zPhoneOptional = z
  .union([z.literal(''), z.null(), z.undefined(), zPhone])
  .transform((v) => (typeof v === 'string' && v.length > 0 ? v : null));

const patientFields = {
  fullName: zText(FULL_NAME_MAX).refine((s) => s.length >= FULL_NAME_MIN, {
    message: 'patients.validation.nameMin',
  }),
  birthDate: zBirthDate,
  gender: GenderEnum,
  phone: zPhone,
  phone2: zPhoneOptional,
  address: zNullableText(ADDRESS_MAX),
  allergies: zNullableText(ALLERGIES_MAX),
  chronic: zNullableText(CHRONIC_MAX),
  notes: zNullableText(NOTES_MAX),
  source: zNullableText(SOURCE_MAX),
  smsConsent: z.boolean().default(true),
};

/** POST /api/patients tanasi. `force=true` — takroriy telefon ogohlantirishini eʼtiborsiz qoldirish */
export const PatientSchema = z.object({ ...patientFields, force: z.boolean().optional() });
export type PatientInput = z.infer<typeof PatientSchema>;

/** PATCH /api/patients/[id] tanasi — hamma maydon ixtiyoriy */
export const PatientPatchSchema = z
  .object({ ...patientFields, force: z.boolean().optional() })
  .partial()
  .refine((v) => Object.keys(v).some((k) => k !== 'force' && v[k as keyof typeof v] !== undefined), {
    message: 'common.validation.required',
  });
export type PatientPatchInput = z.infer<typeof PatientPatchSchema>;

export const PatientSort = z.enum(['name', 'created', 'lastVisit']);
export type PatientSort = z.infer<typeof PatientSort>;

/** GET /api/patients soʻrov parametrlari */
export const PatientListQuery = z
  .object({
    q: z.string().trim().max(120).optional(),
    sort: PatientSort.optional(),
    dir: z.enum(['asc', 'desc']).optional(),
    gender: GenderEnum.optional(),
    type: z.enum(['ADULT', 'CHILD']).optional(),
    hasDebt: z.enum(['1', '0']).optional(),
  })
  .merge(zPage);
export type PatientListQueryInput = z.input<typeof PatientListQuery>;
export type PatientListQueryParsed = z.infer<typeof PatientListQuery>;

/** GET /api/patients/search parametrlari */
export const PatientSearchQuery = z.object({
  q: z.string().trim().max(120).default(''),
  limit: z.coerce.number().int().min(1).max(50).default(8),
});

/** GET /api/patients/[id]/visits parametrlari */
export const PatientVisitsQuery = zPage.extend({
  pageSize: z.coerce.number().int().min(1).max(200).default(10),
});

// ── Client (forma) sxemasi — kirish va chiqish tiplari bir xil ──

export const PatientFormSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(FULL_NAME_MIN, 'patients.validation.nameMin')
    .max(FULL_NAME_MAX, 'patients.validation.nameMax')
    .refine((s) => sanitizeText(s).length >= FULL_NAME_MIN, 'patients.validation.nameMin'),
  /** "DD.MM.YYYY" yoki "YYYY-MM-DD" */
  birthDate: z
    .string()
    .trim()
    .min(1, 'common.validation.required')
    .superRefine((v, ctx) => {
      const problem = checkBirthDate(v);
      if (problem === 'invalid')
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'patients.validation.birthDate' });
      if (problem === 'future')
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'patients.validation.birthFuture' });
      if (problem === 'tooOld')
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'patients.validation.birthTooOld' });
    }),
  gender: z.enum(['MALE', 'FEMALE'], { errorMap: () => ({ message: 'patients.validation.gender' }) }),
  phone: z.string().trim().min(1, 'common.validation.required').refine(isPhone, 'patients.validation.phone'),
  phone2: z
    .string()
    .trim()
    .refine((s) => s === '' || isPhone(s), 'patients.validation.phone'),
  address: z.string().trim().max(ADDRESS_MAX, 'patients.validation.tooLong'),
  allergies: z.string().trim().max(ALLERGIES_MAX, 'patients.validation.tooLong'),
  chronic: z.string().trim().max(CHRONIC_MAX, 'patients.validation.tooLong'),
  notes: z.string().trim().max(NOTES_MAX, 'patients.validation.tooLong'),
  source: z.string().trim().max(SOURCE_MAX, 'patients.validation.tooLong'),
  smsConsent: z.boolean(),
});
export type PatientFormValues = z.infer<typeof PatientFormSchema>;

export const EMPTY_PATIENT_FORM: PatientFormValues = {
  fullName: '',
  birthDate: '',
  gender: 'MALE',
  phone: '',
  phone2: '',
  address: '',
  allergies: '',
  chronic: '',
  notes: '',
  source: '',
  smsConsent: true,
};

/** Forma → API tanasi (JSON). `birthDate` — "YYYY-MM-DD" kaliti (vaqt zonasiz). */
export interface PatientPayload {
  fullName: string;
  birthDate: string;
  gender: GenderValue;
  phone: string;
  phone2: string | null;
  address: string | null;
  allergies: string | null;
  chronic: string | null;
  notes: string | null;
  source: string | null;
  smsConsent: boolean;
  force?: boolean;
}

export function toPatientPayload(v: PatientFormValues, force?: boolean): PatientPayload {
  const opt = (s: string) => (s.trim() ? s.trim() : null);
  return {
    fullName: v.fullName.trim(),
    birthDate: toDateKey(v.birthDate) ?? '',
    gender: v.gender,
    phone: phoneDigits(v.phone),
    phone2: v.phone2.trim() ? phoneDigits(v.phone2) : null,
    address: opt(v.address),
    allergies: opt(v.allergies),
    chronic: opt(v.chronic),
    notes: opt(v.notes),
    source: opt(v.source),
    smsConsent: v.smsConsent,
    ...(force ? { force: true } : {}),
  };
}
