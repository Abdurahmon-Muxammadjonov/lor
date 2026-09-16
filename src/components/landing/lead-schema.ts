import { z } from 'zod';
import { zPhone } from '@/lib/api/validate';

/**
 * Landing "soʻrov qoldirish" formasi sxemasi — client (RHF) va server (POST /api/public/lead) bir xil ishlatadi.
 * Xato matnlari i18n KALITLARI: UI `t(message)` bilan koʻrsatadi.
 * Server-only importlar yoʻq.
 */
export const LeadSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'landing.cta.form.errors.nameMin')
    .max(80, 'landing.cta.form.errors.nameMax'),
  /** zPhone: faqat raqam va + qoladi, 9–13 raqam. UI telefon xatosi uchun doim landing kalitini koʻrsatadi. */
  phone: z.string().trim().min(9, 'landing.cta.form.errors.phone').pipe(zPhone),
  clinic: z
    .string()
    .trim()
    .min(2, 'landing.cta.form.errors.clinicMin')
    .max(120, 'landing.cta.form.errors.clinicMax'),
  message: z.string().trim().max(1000, 'landing.cta.form.errors.messageMax').optional().default(''),
  /** Honeypot — odamlar toʻldirmaydi, botlar toʻldiradi. Server toʻldirilganini koʻrsa saqlamaydi (lekin 200 qaytaradi). */
  website: z.string().max(200).optional().default(''),
  locale: z.enum(['uz', 'ru']).optional().default('uz'),
  /** Qaysi tarifdan kelgan (ixtiyoriy, tahlil uchun) */
  source: z.string().trim().max(40).optional().default('landing'),
});

export type LeadInput = z.input<typeof LeadSchema>;
export type Lead = z.output<typeof LeadSchema>;

/** Form uchun (RHF) — transformatsiyasiz kirish tipi */
export interface LeadFormValues {
  name: string;
  phone: string;
  clinic: string;
  message: string;
  website: string;
}
