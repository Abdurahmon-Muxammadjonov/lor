import { z } from 'zod';
import { isStrongPassword } from '@/lib/auth/password-rules';
import { zPhone, zText } from '@/lib/api/validate';

/**
 * Dashboard moduli zod sxemalari — client va server bir xil sxemani ishlatadi.
 * Xato matnlari i18n KALITLARI (UI `t(err.message)` qiladi).
 */

export const StatsQuerySchema = z.object({
  range: z
    .union([z.literal('7'), z.literal('30'), z.literal('90'), z.literal(7), z.literal(30), z.literal(90)])
    .default('7')
    .transform((v) => Number(v) as 7 | 30 | 90),
  doctorId: z.string().trim().min(1).max(64).optional(),
});
export type StatsQuery = z.infer<typeof StatsQuerySchema>;

export const FULL_NAME_MIN = 3;
export const FULL_NAME_MAX = 120;

const PasswordChangeSchema = z.object({
  current: z.string().min(1, 'dashboard.profile.validation.currentRequired').max(128),
  next: z
    .string()
    .min(8, 'dashboard.profile.validation.passwordWeak')
    .max(128, 'common.validation.max')
    .refine(isStrongPassword, 'dashboard.profile.validation.passwordWeak'),
});

/** PATCH /api/me tanasi */
export const UpdateMeSchema = z
  .object({
    fullName: zText(FULL_NAME_MAX).pipe(z.string().min(FULL_NAME_MIN, 'dashboard.profile.validation.name')).optional(),
    phone: z.union([z.literal(''), zPhone]).optional(),
    password: PasswordChangeSchema.optional(),
  })
  .refine((v) => v.fullName !== undefined || v.phone !== undefined || v.password !== undefined, {
    message: 'common.validation.required',
  });
export type UpdateMeInput = z.infer<typeof UpdateMeSchema>;

/** Profil formasi (client): parol maydonlari ixtiyoriy, lekin toʻldirilsa — barchasi kerak */
export const ProfileFormSchema = z
  .object({
    fullName: z.string().trim().min(FULL_NAME_MIN, 'dashboard.profile.validation.name').max(FULL_NAME_MAX, 'common.validation.max'),
    phone: z
      .string()
      .trim()
      .refine((s) => s === '' || /^\+?\d{9,13}$/.test(s.replace(/[^\d+]/g, '')), 'common.validation.phone'),
    currentPassword: z.string().max(128),
    newPassword: z.string().max(128),
    confirmPassword: z.string().max(128),
  })
  .superRefine((v, ctx) => {
    const wantsChange = v.currentPassword !== '' || v.newPassword !== '' || v.confirmPassword !== '';
    if (!wantsChange) return;
    if (v.currentPassword === '') {
      ctx.addIssue({ code: 'custom', path: ['currentPassword'], message: 'dashboard.profile.validation.currentRequired' });
    }
    if (!isStrongPassword(v.newPassword)) {
      ctx.addIssue({ code: 'custom', path: ['newPassword'], message: 'dashboard.profile.validation.passwordWeak' });
    }
    if (v.newPassword !== v.confirmPassword) {
      ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'common.validation.match' });
    }
    if (v.newPassword !== '' && v.newPassword === v.currentPassword) {
      ctx.addIssue({ code: 'custom', path: ['newPassword'], message: 'dashboard.profile.validation.same' });
    }
  });
export type ProfileFormValues = z.infer<typeof ProfileFormSchema>;
