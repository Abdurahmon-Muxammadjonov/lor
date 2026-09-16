import { z } from 'zod';
import { isStrongPassword } from './password-rules';

/**
 * Auth zod sxemalari — client (react-hook-form) va server (route handler) bir sxemani ishlatadi.
 * Xato matnlari i18n kalitlari: UI da `t(message)` bilan tarjima qilinadi
 * (`common.validation.*`, `auth.validation.*`).
 */

export const LOGIN_MIN = 3;
export const LOGIN_MAX = 64;
export const PASSWORD_MIN = 6;
export const PASSWORD_MAX = 128;

export const LoginSchema = z.object({
  login: z
    .string({ required_error: 'common.validation.required' })
    .trim()
    .toLowerCase()
    .min(LOGIN_MIN, 'auth.validation.loginMin')
    .max(LOGIN_MAX, 'auth.validation.loginMax'),
  password: z
    .string({ required_error: 'common.validation.required' })
    .min(PASSWORD_MIN, 'auth.validation.passwordMin')
    .max(PASSWORD_MAX, 'auth.validation.passwordMax'),
});
export type LoginInput = z.infer<typeof LoginSchema>;

/** Login yoki email (ikkalasi ham kichik harfga keltiriladi) */
export const ForgotSchema = z.object({
  login: z
    .string({ required_error: 'common.validation.required' })
    .trim()
    .toLowerCase()
    .min(LOGIN_MIN, 'auth.validation.loginMin')
    .max(160, 'auth.validation.loginMax'),
});
export type ForgotInput = z.infer<typeof ForgotSchema>;

export const ResetSchema = z
  .object({
    token: z
      .string({ required_error: 'auth.validation.tokenRequired' })
      .trim()
      .min(16, 'auth.validation.tokenRequired')
      .max(256, 'auth.validation.tokenRequired'),
    password: z
      .string({ required_error: 'common.validation.required' })
      .max(PASSWORD_MAX, 'auth.validation.passwordMax')
      .refine(isStrongPassword, 'auth.validation.passwordWeak'),
    confirm: z.string({ required_error: 'common.validation.required' }),
  })
  .refine((d) => d.password === d.confirm, { path: ['confirm'], message: 'auth.validation.confirmMatch' });
export type ResetInput = z.infer<typeof ResetSchema>;

/**
 * Kirishdan soʻng yoʻnaltirish manzili faqat sayt ichidagi yoʻl boʻlishi mumkin
 * (`/dashboard/...`). Tashqi yoki protokol-nisbiy (`//evil.com`) manzillar rad etiladi.
 */
export function sanitizeCallbackUrl(
  raw: string | string[] | null | undefined,
  fallback = '/dashboard',
): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return fallback;
  const v = value.trim();
  if (!v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\')) return fallback;
  if (/[\r\n]/.test(v) || v.length > 2048) return fallback;
  // /login ga qayta yoʻnaltirish halqasini oldini olamiz
  if (v === '/login' || v.startsWith('/login?')) return fallback;
  return v;
}

/** Parol kuchi (UI indikatori uchun): 0–4 */
export function passwordStrength(p: string): 0 | 1 | 2 | 3 | 4 {
  if (!p) return 0;
  let score = 0;
  if (p.length >= 8) score += 1;
  if (/[A-Za-z]/.test(p) && /\d/.test(p)) score += 1;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p)) score += 1;
  if (/[^A-Za-z0-9]/.test(p) || p.length >= 14) score += 1;
  return Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
}
