import { z } from 'zod';
import { zPhone } from '@/lib/api/validate';
import { hmToMinutes } from '@/lib/date';
import {
  ClinicSettingsSchema,
  PaperWidth,
  PrinterSettingsSchema,
  PrinterTransport,
  QueueSettingsSchema,
  SmsSettingsSchema,
  TelegramSettingsSchema,
  type ClinicSettings,
  type PrinterSettings,
  type QueueSettings,
  type SmsSettings,
  type TelegramSettings,
} from './types';

/**
 * Sozlamalar moduli zod sxemalari — client (react-hook-form) va server (route handler) bir xil.
 * Xato matnlari i18n KALITLARI: UI da `t(message)` bilan tarjima qilinadi.
 * Server-only importlar YOʻQ (client komponentlar shu faylni import qiladi).
 */

export {
  ClinicSettingsSchema,
  PaperWidth,
  PrinterSettingsSchema,
  PrinterTransport,
  QueueSettingsSchema,
  SmsSettingsSchema,
  TelegramSettingsSchema,
};
export type { ClinicSettings, PrinterSettings, QueueSettings, SmsSettings, TelegramSettings };

export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const ROUND_TO_VALUES = [1, 10, 100, 1000] as const;
export type RoundTo = (typeof ROUND_TO_VALUES)[number];

/** Qoʻllab-quvvatlanadigan vaqt zonalari (Oʻzbekiston va qoʻshni mintaqalar) */
export const TIMEZONES = [
  'Asia/Tashkent',
  'Asia/Samarkand',
  'Asia/Almaty',
  'Asia/Bishkek',
  'Asia/Dushanbe',
  'Asia/Ashgabat',
  'Asia/Baku',
  'Europe/Moscow',
] as const;
export type Timezone = (typeof TIMEZONES)[number];

export const CHILD_AGE_MIN = 1;
export const CHILD_AGE_MAX = 18;
export const SLOT_MIN = 5;
export const SLOT_MAX = 60;

export const zTime = z.string({ required_error: 'common.validation.required' }).regex(TIME_RE, 'settings.validation.time');

/** zPhone (kernel) ni i18n kalitli xato bilan oʻrash: notoʻgʻri → 'common.validation.phone' */
export const zPhoneI18n = z
  .string({ required_error: 'common.validation.required' })
  .trim()
  .min(1, 'common.validation.required')
  .refine((v) => zPhone.safeParse(v).success, 'common.validation.phone')
  .transform((v) => zPhone.parse(v));

const zRoundTo = z.coerce
  .number({ invalid_type_error: 'common.validation.number' })
  .pipe(z.union([z.literal(1), z.literal(10), z.literal(100), z.literal(1000)], { errorMap: () => ({ message: 'settings.validation.roundTo' }) }));

// ── Klinika profili ──

export const ClinicProfileSchema = z
  .object({
    name: z
      .string({ required_error: 'common.validation.required' })
      .trim()
      .min(2, 'settings.validation.nameMin')
      .max(120, 'settings.validation.tooLong'),
    phone: zPhoneI18n,
    email: z.union([z.literal(''), z.string().trim().email('common.validation.email').max(160, 'settings.validation.tooLong')]),
    address: z.string().trim().max(300, 'settings.validation.tooLong'),
    city: z.string().trim().max(80, 'settings.validation.tooLong'),
    logoUrl: z.union([z.literal(''), z.string().trim().url('settings.validation.url').max(500, 'settings.validation.tooLong')]),
    childAgeLimit: z.coerce
      .number({ invalid_type_error: 'common.validation.number' })
      .int('common.validation.number')
      .min(CHILD_AGE_MIN, 'settings.validation.childAge')
      .max(CHILD_AGE_MAX, 'settings.validation.childAge'),
    roundTo: zRoundTo,
    workStart: zTime,
    workEnd: zTime,
    slotMinutes: z.coerce
      .number({ invalid_type_error: 'common.validation.number' })
      .int('common.validation.number')
      .min(SLOT_MIN, 'settings.validation.slot')
      .max(SLOT_MAX, 'settings.validation.slot'),
    ticketFooter: z.string().trim().max(120, 'settings.validation.tooLong'),
    timezone: z.enum(TIMEZONES, { errorMap: () => ({ message: 'settings.validation.timezone' }) }),
  })
  .superRefine((v, ctx) => {
    if (TIME_RE.test(v.workStart) && TIME_RE.test(v.workEnd) && hmToMinutes(v.workEnd) <= hmToMinutes(v.workStart)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['workEnd'], message: 'settings.validation.endAfterStart' });
    }
  });
export type ClinicProfileInput = z.infer<typeof ClinicProfileSchema>;

/** PATCH /api/settings/clinic — barcha maydonlar ixtiyoriy (qisman yangilash) */
export const ClinicProfilePatchSchema = ClinicProfileSchema.innerType().partial().superRefine((v, ctx) => {
  if (
    v.workStart !== undefined &&
    v.workEnd !== undefined &&
    TIME_RE.test(v.workStart) &&
    TIME_RE.test(v.workEnd) &&
    hmToMinutes(v.workEnd) <= hmToMinutes(v.workStart)
  ) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['workEnd'], message: 'settings.validation.endAfterStart' });
  }
});
export type ClinicProfilePatch = z.infer<typeof ClinicProfilePatchSchema>;

/** GET /api/settings/clinic javobi */
export interface ClinicProfileDTO {
  id: string;
  slug: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  logoUrl: string;
  timezone: string;
  childAgeLimit: number;
  currency: string;
  roundTo: number;
  workStart: string;
  workEnd: string;
  slotMinutes: number;
  ticketFooter: string;
  kioskKey: string;
  plan: 'START' | 'PRO' | 'CLINIC';
  createdAt: string;
  updatedAt: string;
}

// ── Boʻlimlar (Clinic.settings Json) ──

export const SETTINGS_SECTIONS = ['printer', 'sms', 'telegram', 'queue'] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

const IPV4_RE = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const HOSTNAME_RE = /^(?=.{1,253}$)([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

export function isValidHost(host: string): boolean {
  const h = host.trim();
  return h === '' || IPV4_RE.test(h) || HOSTNAME_RE.test(h);
}

/** Printer formasi: NETWORK transportda host majburiy */
export const PrinterFormSchema = PrinterSettingsSchema.extend({
  host: z.string().trim().max(253, 'settings.validation.tooLong').default(''),
  port: z.coerce
    .number({ invalid_type_error: 'common.validation.number' })
    .int('common.validation.number')
    .min(1, 'settings.validation.port')
    .max(65535, 'settings.validation.port')
    .default(9100),
  qzPrinterName: z.string().trim().max(120, 'settings.validation.tooLong').default(''),
  receiptFooter: z.string().trim().max(200, 'settings.validation.tooLong').default('Tashrifingiz uchun rahmat!'),
  avgServiceMinutes: z.coerce
    .number({ invalid_type_error: 'common.validation.number' })
    .int('common.validation.number')
    .min(1, 'settings.validation.range')
    .max(120, 'settings.validation.range')
    .default(8),
}).superRefine((v, ctx) => {
  if (v.transport === 'NETWORK' && !v.host.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['host'], message: 'settings.validation.hostRequired' });
  }
  if (!isValidHost(v.host)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['host'], message: 'settings.validation.host' });
  }
});
export type PrinterFormValues = z.infer<typeof PrinterFormSchema>;

/** PATCH /api/settings/printer — qisman */
export const PrinterPatchSchema = PrinterFormSchema.innerType().partial();
export type PrinterPatch = z.infer<typeof PrinterPatchSchema>;

const TEMPLATE_MAX = 320;
const zTemplate = z.string().trim().min(1, 'common.validation.required').max(TEMPLATE_MAX, 'settings.validation.templateLong');

/** Kernel defaultlari (shablonlar) */
export const SMS_DEFAULTS: SmsSettings = SmsSettingsSchema.parse({});

/** SMS shablonlarida ishlatiladigan oʻrin egallovchilar */
export const SMS_PLACEHOLDERS = ['clinic', 'name', 'date', 'time', 'doctor', 'phone'] as const;
export type SmsPlaceholder = (typeof SMS_PLACEHOLDERS)[number];

export const SmsFormSchema = SmsSettingsSchema.extend({
  from: z.string().trim().max(20, 'settings.validation.tooLong').default('4546'),
  confirmTemplate: zTemplate.default(SMS_DEFAULTS.confirmTemplate),
  reminderTemplate: zTemplate.default(SMS_DEFAULTS.reminderTemplate),
  birthdayTemplate: zTemplate.default(SMS_DEFAULTS.birthdayTemplate),
  reminderHoursBefore: z.coerce
    .number({ invalid_type_error: 'common.validation.number' })
    .int('common.validation.number')
    .min(1, 'settings.validation.range')
    .max(72, 'settings.validation.range')
    .default(24),
});
export type SmsFormValues = z.infer<typeof SmsFormSchema>;
export const SmsPatchSchema = SmsFormSchema.partial();
export type SmsPatch = z.infer<typeof SmsPatchSchema>;

export const CHAT_ID_RE = /^-?\d{5,20}$/;
export const zChatId = z.string().trim().regex(CHAT_ID_RE, 'settings.validation.chatId');

export const TelegramFormSchema = TelegramSettingsSchema.extend({
  adminChatIds: z.array(zChatId).max(20, 'settings.validation.tooMany').default([]),
  dailyReportHour: z.coerce
    .number({ invalid_type_error: 'common.validation.number' })
    .int('common.validation.number')
    .min(0, 'settings.validation.hour')
    .max(23, 'settings.validation.hour')
    .default(21),
});
export type TelegramFormValues = z.infer<typeof TelegramFormSchema>;
export const TelegramPatchSchema = TelegramFormSchema.partial();
export type TelegramPatch = z.infer<typeof TelegramPatchSchema>;

export const QUEUE_TYPES = ['DOCTOR', 'RECHECK', 'LAB', 'CASHIER'] as const;
export type QueueTypeKey = (typeof QUEUE_TYPES)[number];

const zPrefix = z
  .string({ required_error: 'common.validation.required' })
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]$/, 'settings.validation.prefix');

export const QueueFormSchema = QueueSettingsSchema.extend({
  prefixes: z
    .object({
      DOCTOR: zPrefix.default('A'),
      RECHECK: zPrefix.default('B'),
      LAB: zPrefix.default('C'),
      CASHIER: zPrefix.default('D'),
    })
    .default({})
    .superRefine((p, ctx) => {
      const seen = new Map<string, QueueTypeKey>();
      for (const key of QUEUE_TYPES) {
        const v = p[key];
        const prev = seen.get(v);
        if (prev) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: 'settings.validation.prefixUnique' });
        else seen.set(v, key);
      }
    }),
  enabledTypes: z.array(z.enum(QUEUE_TYPES)).min(1, 'settings.validation.enabledTypes').default([...QUEUE_TYPES]),
  kioskShowSeconds: z.coerce
    .number({ invalid_type_error: 'common.validation.number' })
    .int('common.validation.number')
    .min(2, 'settings.validation.range')
    .max(30, 'settings.validation.range')
    .default(5),
});
export type QueueFormValues = z.infer<typeof QueueFormSchema>;
export const QueuePatchSchema = QueueFormSchema.partial();
export type QueuePatch = z.infer<typeof QueuePatchSchema>;

/** Boʻlim → toʻliq sxema (DB ga yozishdan oldin merge natijasi shu bilan tekshiriladi) */
export const SECTION_SCHEMAS = {
  printer: PrinterFormSchema,
  sms: SmsFormSchema,
  telegram: TelegramFormSchema,
  queue: QueueFormSchema,
} as const;

/** Boʻlim → PATCH sxemasi */
export const SECTION_PATCH_SCHEMAS = {
  printer: PrinterPatchSchema,
  sms: SmsPatchSchema,
  telegram: TelegramPatchSchema,
  queue: QueuePatchSchema,
} as const;

export type SectionValues = {
  printer: PrinterSettings;
  sms: SmsSettings;
  telegram: TelegramSettings;
  queue: QueueSettings;
};

// ── Test yuborish ──

export const SmsTestSchema = z.object({
  phone: zPhoneI18n,
  /** Boʻsh boʻlsa standart test matni */
  text: z.string().trim().max(TEMPLATE_MAX, 'settings.validation.templateLong').optional(),
});
export type SmsTestInput = z.infer<typeof SmsTestSchema>;

export const TelegramTestSchema = z.object({
  /** Boʻsh boʻlsa sozlamalardagi barcha admin chatlarga */
  chatId: z.union([z.literal(''), zChatId]).optional(),
  /** true — qisqa test oʻrniga bugungi kunlik hisobot */
  report: z.boolean().optional(),
});
export type TelegramTestInput = z.infer<typeof TelegramTestSchema>;

// ── Audit ──

export const AUDIT_ACTIONS = [
  'CREATE',
  'UPDATE',
  'DELETE',
  'LOGIN',
  'PRICE_CHANGE',
  'PAYMENT',
  'REFUND',
  'SHIFT_OPEN',
  'SHIFT_CLOSE',
  'VISIT_COMPLETE',
  'VISIT_CANCEL',
  'QUEUE_CALL',
  'SETTINGS',
  'PASSWORD_RESET',
] as const;
export type AuditActionKey = (typeof AUDIT_ACTIONS)[number];

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export const AuditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  entity: z.string().trim().max(64).optional(),
  entityId: z.string().trim().max(64).optional(),
  userId: z.string().trim().max(64).optional(),
  action: z.string().trim().max(32).optional(),
  /** YYYY-MM-DD (Toshkent kuni) */
  from: z.string().regex(DATE_KEY_RE).optional(),
  to: z.string().regex(DATE_KEY_RE).optional(),
});
export type AuditQuery = z.infer<typeof AuditQuerySchema>;

export interface AuditItemDTO {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  user: { id: string; fullName: string; role: string; login: string } | null;
}

export interface AuditListDTO {
  items: AuditItemDTO[];
  total: number;
  page: number;
  pageSize: number;
  /** Filtr uchun: klinikadagi mavjud entity nomlari va foydalanuvchilar */
  entities: string[];
  users: { id: string; fullName: string; role: string }[];
}

/** GET /api/settings/roles javobi */
export interface RolesMatrixDTO {
  roles: string[];
  permissions: { key: string; roles: string[] }[];
}

/** Integratsiyalar holati (env orqali sozlanganmi) — GET /api/settings/integrations */
export interface IntegrationStatusDTO {
  eskiz: boolean;
  telegram: boolean;
  click: boolean;
  payme: boolean;
  cron: boolean;
}

export interface SmsSettingsDTO {
  sms: SmsSettings;
  configured: boolean;
}

export interface TelegramSettingsDTO {
  telegram: TelegramSettings;
  configured: boolean;
  botUsername: string | null;
}

/** Kiosk kaliti javobi */
export interface KioskKeyDTO {
  kioskKey: string;
  kioskUrl: string;
  displayUrl: string;
}

/** Kiosk / ekran havolalari */
export function kioskLinks(kioskKey: string, origin = ''): { kioskUrl: string; displayUrl: string } {
  const key = encodeURIComponent(kioskKey);
  return { kioskUrl: `${origin}/kiosk?key=${key}`, displayUrl: `${origin}/display?key=${key}` };
}
