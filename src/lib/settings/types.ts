import { z } from 'zod';

/**
 * Clinic.settings (Json) ning tipi. Printer / SMS / Telegram / kiosk sozlamalari.
 * Har doim `parseClinicSettings()` orqali oʻqing — defaultlar toʻldiriladi.
 */

export const PrinterTransport = z.enum(['WEBUSB', 'QZ', 'NETWORK', 'BROWSER']);
export type PrinterTransport = z.infer<typeof PrinterTransport>;

export const PaperWidth = z.union([z.literal(58), z.literal(80)]);
export type PaperWidth = z.infer<typeof PaperWidth>;

export const PrinterSettingsSchema = z.object({
  transport: PrinterTransport.default('BROWSER'),
  paperWidth: PaperWidth.default(58),
  /** NETWORK: IP manzil */
  host: z.string().default(''),
  port: z.coerce.number().int().min(1).max(65535).default(9100),
  /** QZ Tray: printer nomi */
  qzPrinterName: z.string().default(''),
  /** Kodlash: CP866 (kirill), CP1251, yoki ASCII (faqat lotin) */
  codepage: z.enum(['CP866', 'CP1251', 'ASCII']).default('CP866'),
  /** Talon/chekni avtomatik chop etish */
  autoPrintTicket: z.boolean().default(true),
  autoPrintReceipt: z.boolean().default(true),
  /** Chek pastidagi matn */
  receiptFooter: z.string().default('Tashrifingiz uchun rahmat!'),
  /** Chekda QR kod (bemor kartasi/qabul havolasi) */
  receiptQr: z.boolean().default(true),
  /** Chop etishdan keyin qogʻozni kesish */
  cut: z.boolean().default(true),
  /** Talonda taxminiy kutish vaqti (daqiqa/bemor) */
  avgServiceMinutes: z.coerce.number().int().min(1).max(120).default(8),
});
export type PrinterSettings = z.infer<typeof PrinterSettingsSchema>;

export const SmsSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  provider: z.literal('eskiz').default('eskiz'),
  from: z.string().default('4546'),
  /** Yozilish tasdigʻi */
  confirmTemplate: z
    .string()
    .default('{clinic}: {name}, siz {date} soat {time} ga {doctor} qabuliga yozildingiz. Tel: {phone}'),
  /** 1 kun oldin eslatma */
  reminderTemplate: z
    .string()
    .default('{clinic}: {name}, ertaga {date} soat {time} da {doctor} qabuliga kutamiz. Tel: {phone}'),
  birthdayTemplate: z.string().default('{clinic}: Hurmatli {name}, tugʻilgan kuningiz bilan tabriklaymiz! Sogʻ boʻling!'),
  reminderHoursBefore: z.coerce.number().int().min(1).max(72).default(24),
});
export type SmsSettings = z.infer<typeof SmsSettingsSchema>;

export const TelegramSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  /** Admin(lar) chat ID — kunlik hisobot uchun */
  adminChatIds: z.array(z.string()).default([]),
  dailyReportHour: z.coerce.number().int().min(0).max(23).default(21),
  patientReminders: z.boolean().default(true),
});
export type TelegramSettings = z.infer<typeof TelegramSettingsSchema>;

export const QueueSettingsSchema = z.object({
  /** Kiosk tugmalari va prefikslari */
  prefixes: z
    .object({
      DOCTOR: z.string().length(1).default('A'),
      RECHECK: z.string().length(1).default('B'),
      LAB: z.string().length(1).default('C'),
      CASHIER: z.string().length(1).default('D'),
    })
    .default({}),
  /** Kioskda koʻrsatiladigan tugmalar */
  enabledTypes: z.array(z.enum(['DOCTOR', 'RECHECK', 'LAB', 'CASHIER'])).default(['DOCTOR', 'RECHECK', 'LAB', 'CASHIER']),
  /** Ekranda (TV) ovozli signal */
  displaySound: z.boolean().default(true),
  displayVoice: z.boolean().default(true),
  /** Kioskda raqam koʻrsatilish vaqti (soniya) */
  kioskShowSeconds: z.coerce.number().int().min(2).max(30).default(5),
});
export type QueueSettings = z.infer<typeof QueueSettingsSchema>;

export const ClinicSettingsSchema = z.object({
  printer: PrinterSettingsSchema.default({}),
  sms: SmsSettingsSchema.default({}),
  telegram: TelegramSettingsSchema.default({}),
  queue: QueueSettingsSchema.default({}),
});
export type ClinicSettings = z.infer<typeof ClinicSettingsSchema>;

export function parseClinicSettings(json: unknown): ClinicSettings {
  const r = ClinicSettingsSchema.safeParse(json ?? {});
  return r.success ? r.data : ClinicSettingsSchema.parse({});
}

// ── Xodim ish jadvali (User.schedule Json) ──
export const DaySchedule = z.object({
  enabled: z.boolean().default(true),
  start: z.string().regex(/^\d{2}:\d{2}$/).default('09:00'),
  end: z.string().regex(/^\d{2}:\d{2}$/).default('18:00'),
  breakStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  breakEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});
export type DaySchedule = z.infer<typeof DaySchedule>;

/** 0 = yakshanba ... 6 = shanba (JS Date.getDay) */
export const WeeklyScheduleSchema = z.object({
  0: DaySchedule.default({ enabled: false }),
  1: DaySchedule.default({}),
  2: DaySchedule.default({}),
  3: DaySchedule.default({}),
  4: DaySchedule.default({}),
  5: DaySchedule.default({}),
  6: DaySchedule.default({ enabled: true, start: '09:00', end: '14:00' }),
});
export type WeeklySchedule = z.infer<typeof WeeklyScheduleSchema>;

export function parseWeeklySchedule(json: unknown): WeeklySchedule {
  const r = WeeklyScheduleSchema.safeParse(json ?? {});
  return r.success ? r.data : WeeklyScheduleSchema.parse({});
}
