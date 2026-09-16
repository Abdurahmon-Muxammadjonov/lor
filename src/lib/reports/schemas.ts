import { z } from 'zod';
import { GROUP_BYS, REPORT_KINDS, REPORT_TABS } from './types';
import { isDateKey, normalizeRange, presetRange } from './period';

/**
 * Hisobot soʻrovlarining zod sxemalari (client va server uchun umumiy; server-only importlarsiz).
 * `from`/`to` berilmasa — joriy oy.
 */

const zDateKey = z.string().refine(isDateKey, 'Sana YYYY-MM-DD koʻrinishida boʻlishi kerak');

const zRangeBase = z.object({
  from: zDateKey.optional(),
  to: zDateKey.optional(),
  doctorId: z.string().min(1).max(64).optional(),
});

function withRange<T extends z.infer<typeof zRangeBase>>(v: T) {
  const fallback = presetRange('month');
  const range = normalizeRange(v.from ?? fallback.from, v.to ?? fallback.to);
  return { ...v, ...range, doctorId: v.doctorId ?? null };
}

export const ReportQuerySchema = zRangeBase.transform(withRange);
export type ReportQuery = z.infer<typeof ReportQuerySchema>;

export const GroupedQuerySchema = zRangeBase.extend({ groupBy: z.enum(GROUP_BYS).default('day') }).transform(withRange);
export type GroupedQuery = z.infer<typeof GroupedQuerySchema>;

const zFlag = z
  .union([z.literal('1'), z.literal('0'), z.literal('true'), z.literal('false')])
  .optional()
  .transform((v) => v === '1' || v === 'true');

export const DebtorsQuerySchema = zRangeBase.extend({ all: zFlag }).transform(withRange);
export type DebtorsQuery = z.infer<typeof DebtorsQuerySchema>;

export const ExportQuerySchema = zRangeBase
  .extend({
    kind: z.enum(REPORT_KINDS),
    groupBy: z.enum(GROUP_BYS).default('day'),
    all: zFlag,
  })
  .transform(withRange);
export type ExportQuery = z.infer<typeof ExportQuerySchema>;

export const PrintQuerySchema = zRangeBase
  .extend({
    tab: z.enum(REPORT_TABS).default('revenue'),
    groupBy: z.enum(GROUP_BYS).default('day'),
    all: zFlag,
    auto: zFlag,
  })
  .transform(withRange);
export type PrintQuery = z.infer<typeof PrintQuerySchema>;

export const DebtReminderSchema = z.object({
  patientId: z.string().min(1).max(64),
  locale: z.enum(['uz', 'ru']).default('uz'),
});
export type DebtReminderInput = z.infer<typeof DebtReminderSchema>;
