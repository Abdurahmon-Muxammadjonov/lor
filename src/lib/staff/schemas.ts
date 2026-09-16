import { z } from 'zod';
import { isStrongPassword } from '@/lib/auth/password-rules';
import { zMoney, zPhone } from '@/lib/api/validate';
import { hmToMinutes } from '@/lib/date';
import { CLINIC_ROLE_VALUES, SALARY_TYPE_VALUES } from './types';

/**
 * Xodimlar moduli zod sxemalari — client (react-hook-form) va server (route handler) bir xil.
 * Xato matnlari i18n KALITLARI: UI da `t(message)` bilan tarjima qilinadi.
 * Server-only importlar YOʻQ (client komponentlar shu faylni import qiladi).
 */

export const LOGIN_MIN = 3;
export const LOGIN_MAX = 32;
export const LOGIN_RE = /^[a-z0-9._-]+$/;
export const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Avatar rangi uchun 8 ta palitra (dizayn tizimi ranglari) */
export const STAFF_COLORS = [
  '#00D4FF',
  '#7C5CFF',
  '#00FFB2',
  '#FFB547',
  '#FF4D6D',
  '#FF8A5C',
  '#FF7EB6',
  '#5CB8FF',
] as const;
export type StaffColor = (typeof STAFF_COLORS)[number];

export const zTime = z.string({ required_error: 'common.validation.required' }).regex(TIME_RE, 'staff.validation.time');

/** Boʻsh satr → undefined (tanaffus ixtiyoriy) */
const zOptionalTime = z
  .union([z.literal(''), zTime])
  .optional()
  .transform((v) => (v ? v : undefined));

export const DayScheduleInputSchema = z
  .object({
    enabled: z.boolean(),
    start: zTime,
    end: zTime,
    breakStart: zOptionalTime,
    breakEnd: zOptionalTime,
  })
  .superRefine((d, ctx) => {
    if (!d.enabled) return;
    const start = hmToMinutes(d.start);
    const end = hmToMinutes(d.end);
    if (end <= start) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['end'], message: 'staff.validation.endAfterStart' });
      return;
    }
    const hasBs = d.breakStart !== undefined;
    const hasBe = d.breakEnd !== undefined;
    if (hasBs !== hasBe) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: [hasBs ? 'breakEnd' : 'breakStart'], message: 'staff.validation.breakBoth' });
      return;
    }
    if (d.breakStart !== undefined && d.breakEnd !== undefined) {
      const bs = hmToMinutes(d.breakStart);
      const be = hmToMinutes(d.breakEnd);
      if (be <= bs || bs < start || be > end) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['breakEnd'], message: 'staff.validation.breakWithin' });
      }
    }
  });
export type DayScheduleInput = z.input<typeof DayScheduleInputSchema>;
export type DayScheduleOutput = z.output<typeof DayScheduleInputSchema>;

/**
 * 0 = yakshanba … 6 = shanba (JS Date.getDay) — kernel WeeklySchedule bilan bir xil kalitlar.
 * Kalitlar satr koʻrinishida yoziladi: react-hook-form `Path<T>` raqamli kalitlarni (`0 & string = never`) yoʻqotadi,
 * `'0'` esa `schedule.0.start` yoʻlini beradi. Strukturaviy jihatdan `{ 0: … }` bilan bir xil.
 */
export const WeeklyScheduleInputSchema = z.object({
  '0': DayScheduleInputSchema,
  '1': DayScheduleInputSchema,
  '2': DayScheduleInputSchema,
  '3': DayScheduleInputSchema,
  '4': DayScheduleInputSchema,
  '5': DayScheduleInputSchema,
  '6': DayScheduleInputSchema,
});
export type WeeklyScheduleInput = z.input<typeof WeeklyScheduleInputSchema>;
export type WeeklyScheduleOutput = z.output<typeof WeeklyScheduleInputSchema>;

export const zLogin = z
  .string({ required_error: 'common.validation.required' })
  .trim()
  .toLowerCase()
  .min(LOGIN_MIN, 'staff.validation.loginMin')
  .max(LOGIN_MAX, 'staff.validation.loginMax')
  .regex(LOGIN_RE, 'staff.validation.loginFormat');

export const zPassword = z
  .string({ required_error: 'common.validation.required' })
  .max(128, 'staff.validation.passwordMax')
  .refine(isStrongPassword, 'staff.validation.passwordWeak');

export const zClinicRole = z.enum(CLINIC_ROLE_VALUES, {
  required_error: 'common.validation.required',
  invalid_type_error: 'staff.validation.role',
});

export const zSalaryType = z.enum(SALARY_TYPE_VALUES, {
  required_error: 'common.validation.required',
  invalid_type_error: 'common.validation.invalid',
});

/** Ixtiyoriy matn: boʻsh satr ruxsat (serverda null ga aylanadi) */
const zOptionalString = (max: number) =>
  z.string().trim().max(max, 'staff.validation.tooLong').optional();

const zOptionalPhone = z.union([z.literal(''), zPhone]).optional();

const zOptionalEmail = z
  .union([z.literal(''), z.string().trim().toLowerCase().email('common.validation.email').max(160, 'staff.validation.tooLong')])
  .optional();

/** Umumiy maydonlar (parolsiz) */
const UserBaseSchema = z.object({
  login: zLogin,
  fullName: z
    .string({ required_error: 'common.validation.required' })
    .trim()
    .min(2, 'staff.validation.fullName')
    .max(120, 'staff.validation.tooLong'),
  role: zClinicRole,
  phone: zOptionalPhone,
  email: zOptionalEmail,
  specialty: zOptionalString(80),
  room: zOptionalString(40),
  color: z.string({ required_error: 'common.validation.required' }).regex(HEX_COLOR_RE, 'staff.validation.color'),
  salaryType: zSalaryType,
  salaryValue: zMoney,
  schedule: WeeklyScheduleInputSchema,
});

function checkPercent(d: { salaryType?: 'PERCENT' | 'FIXED'; salaryValue?: number }, ctx: z.RefinementCtx) {
  if (d.salaryType === 'PERCENT' && typeof d.salaryValue === 'number' && d.salaryValue > 100) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['salaryValue'], message: 'staff.validation.percentMax' });
  }
}

/** POST /api/users */
export const UserCreateSchema = UserBaseSchema.extend({ password: zPassword }).superRefine(checkPercent);
export type UserCreateInput = z.input<typeof UserCreateSchema>;
export type UserCreateOutput = z.output<typeof UserCreateSchema>;

/** PATCH /api/users/[id] — qisman, parolsiz; `isActive` orqali qayta faollashtirish */
export const UserUpdateSchema = UserBaseSchema.partial()
  .extend({ isActive: z.boolean().optional() })
  .superRefine(checkPercent);
export type UserUpdateInput = z.input<typeof UserUpdateSchema>;
export type UserUpdateOutput = z.output<typeof UserUpdateSchema>;

/** POST /api/users/[id]/password */
export const PasswordSchema = z.object({ password: zPassword });
export type PasswordInput = z.infer<typeof PasswordSchema>;

/** Parol oynasi (client): tasdiqlash bilan */
export const PasswordFormSchema = PasswordSchema.extend({
  confirm: z.string({ required_error: 'common.validation.required' }),
}).refine((d) => d.password === d.confirm, { path: ['confirm'], message: 'staff.validation.confirmMatch' });
export type PasswordFormInput = z.infer<typeof PasswordFormSchema>;

/** GET /api/users?role=&active=&search= */
export const UsersQuerySchema = z.object({
  role: zClinicRole.optional(),
  /** '1' — faqat faol, '0' — faqat nofaol, berilmasa — barchasi */
  active: z.enum(['1', '0']).optional(),
  search: z.string().trim().max(100).optional(),
});
export type UsersQuery = z.infer<typeof UsersQuerySchema>;

/** GET /api/users/salary?month=YYYY-MM&doctorId= */
export const SalaryQuerySchema = z.object({
  month: z.string({ required_error: 'common.validation.required' }).regex(MONTH_RE, 'staff.validation.month'),
  doctorId: z.string().min(1).max(64).optional(),
});
export type SalaryQuery = z.infer<typeof SalaryQuerySchema>;
