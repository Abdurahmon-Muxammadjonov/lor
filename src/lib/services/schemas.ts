import { z } from 'zod';
import { zId, zMoney, zMoneySigned, zText } from '@/lib/api/validate';

/**
 * Xizmatlar va kategoriyalar uchun zod sxemalar. Client (formalar) va server (API) bir xil sxemani ishlatadi,
 * shuning uchun bu fayl server-only importlarsiz. Xato matnlari — i18n KALITLARI (UI `t(msg)` qiladi).
 */

export const SERVICE_CODE_RE = /^[A-Z]{1,3}-\d{3}$/;

export const SERVICE_UNITS = ['ta', 'seans', 'kun'] as const;
export type ServiceUnit = (typeof SERVICE_UNITS)[number];
export const ServiceUnitSchema = z.enum(SERVICE_UNITS, { errorMap: () => ({ message: 'services.validation.unit' }) });

export const ORGANS = ['EAR', 'NOSE', 'THROAT', 'LARYNX', 'OTHER'] as const;
export const OrganSchema = z.enum(ORGANS);

/** 4 xil narx maydoni (kattalar/bolalar × dorisiz/dori bilan) */
export const PRICE_FIELDS = ['priceAdultNoMed', 'priceAdultMed', 'priceChildNoMed', 'priceChildMed'] as const;
export type PriceField = (typeof PRICE_FIELDS)[number];
export const PriceFieldSchema = z.enum(PRICE_FIELDS);

export const DURATION_MIN = 5;
export const DURATION_MAX = 300;

const zCode = z
  .string({ required_error: 'common.validation.required' })
  .trim()
  .toUpperCase()
  .regex(SERVICE_CODE_RE, 'services.validation.code');

const zName = (max = 160) =>
  z
    .string({ required_error: 'common.validation.required' })
    .trim()
    .min(2, 'services.validation.nameMin')
    .max(max, 'services.validation.nameMax')
    .pipe(zText(max));

const zPrice = zMoney.pipe(z.number().int().min(0, 'services.validation.price'));

export const ServiceSchema = z.object({
  categoryId: zId,
  code: zCode,
  name: zName(),
  nameRu: zName(),
  unit: ServiceUnitSchema.default('ta'),
  priceAdultNoMed: zPrice,
  priceAdultMed: zPrice,
  priceChildNoMed: zPrice,
  priceChildMed: zPrice,
  allowHalf: z.boolean().default(true),
  medicineOptional: z.boolean().default(true),
  durationMin: z.coerce
    .number({ invalid_type_error: 'common.validation.number' })
    .int('common.validation.number')
    .min(DURATION_MIN, 'services.validation.duration')
    .max(DURATION_MAX, 'services.validation.duration')
    .default(20),
  defaultOrgan: OrganSchema.nullable().optional(),
  isActive: z.boolean().default(true),
});
export type ServiceInput = z.input<typeof ServiceSchema>;
export type ServiceOutput = z.output<typeof ServiceSchema>;

/** PATCH: har qanday qism; boʻsh obyekt rad etiladi */
export const ServiceUpdateSchema = ServiceSchema.partial().refine((v) => Object.keys(v).length > 0, {
  message: 'services.validation.empty',
});
export type ServiceUpdateInput = z.input<typeof ServiceUpdateSchema>;
export type ServiceUpdateOutput = z.output<typeof ServiceUpdateSchema>;

// ── Ommaviy narx oʻzgartirish ──

export const BULK_MODES = ['PERCENT', 'FIXED', 'SET'] as const;
export type BulkMode = (typeof BULK_MODES)[number];
export const BulkModeSchema = z.enum(BULK_MODES);

export const BULK_ROUNDS = [100, 1000] as const;
export type BulkRound = (typeof BULK_ROUNDS)[number];
export const BulkRoundSchema = z.union([z.literal(100), z.literal(1000)]);

export const BulkSchema = z
  .object({
    /** Kategoriya boʻyicha (berilmasa — barchasi yoki serviceIds) */
    categoryId: zId.optional(),
    /** Tanlangan xizmatlar */
    serviceIds: z.array(zId).min(1).max(500).optional(),
    mode: BulkModeSchema,
    /** PERCENT/FIXED — ishorali; SET — ≥ 0 */
    value: zMoneySigned,
    fields: z.array(PriceFieldSchema).min(1, 'services.validation.fields').max(4),
    roundTo: BulkRoundSchema.default(100),
    /** true — faqat hisoblab koʻrsatadi, DB ga yozmaydi */
    preview: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    if (v.mode === 'PERCENT' && (v.value < -100 || v.value > 1000)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['value'], message: 'services.validation.percentRange' });
    }
    if (v.mode === 'SET' && v.value < 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['value'], message: 'services.validation.price' });
    }
    if (v.mode !== 'SET' && v.value === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['value'], message: 'services.validation.valueZero' });
    }
    if (Array.from(new Set(v.fields)).length !== v.fields.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['fields'], message: 'services.validation.fields' });
    }
  });
export type BulkInput = z.input<typeof BulkSchema>;
export type BulkOutput = z.output<typeof BulkSchema>;

// ── Tartib ──

export const ReorderSchema = z.object({
  ids: z.array(zId).min(1).max(1000),
});
export type ReorderInput = z.infer<typeof ReorderSchema>;

// ── Kategoriya ──

/** Kategoriya ikonkalari (lucide nomlari) — kichik, tanlash uchun roʻyxat */
export const CATEGORY_ICONS = [
  'stethoscope',
  'wind',
  'ear',
  'mic',
  'zap',
  'scissors',
  'flask-conical',
  'syringe',
  'pill',
  'activity',
  'heart-pulse',
  'microscope',
  'thermometer',
  'droplets',
  'waves',
  'baby',
  'bandage',
  'test-tube',
  'scan-line',
  'clipboard-list',
  'sparkles',
] as const;
export type CategoryIconName = (typeof CATEGORY_ICONS)[number];
export const CategoryIconSchema = z.enum(CATEGORY_ICONS);

export const CategorySchema = z.object({
  name: zName(80),
  nameRu: zName(80),
  icon: CategoryIconSchema.nullable().optional(),
  order: z.coerce.number({ invalid_type_error: 'common.validation.number' }).int().min(0).max(9999).default(0),
});
export type CategoryInput = z.input<typeof CategorySchema>;
export type CategoryOutput = z.output<typeof CategorySchema>;

export const CategoryUpdateSchema = CategorySchema.partial().refine((v) => Object.keys(v).length > 0, {
  message: 'services.validation.empty',
});
export type CategoryUpdateOutput = z.output<typeof CategoryUpdateSchema>;

// ── Soʻrov (query) ──

const zFlag = z
  .union([z.literal('1'), z.literal('true'), z.literal('0'), z.literal('false'), z.literal('')])
  .optional()
  .transform((v) => v === '1' || v === 'true');

export const ServicesQuerySchema = z.object({
  /** ?all=1 — nofaollar ham */
  all: zFlag,
  categoryId: zId.optional(),
  q: z.string().trim().max(100).optional(),
});
export type ServicesQuery = z.output<typeof ServicesQuerySchema>;

export const HistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
