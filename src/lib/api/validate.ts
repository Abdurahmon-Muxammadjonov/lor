import type { NextRequest } from 'next/server';
import { z, type ZodTypeAny } from 'zod';
import { ApiError } from './errors';

export async function parseBody<S extends ZodTypeAny>(req: NextRequest, schema: S): Promise<z.infer<S>> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw ApiError.validation(undefined, 'JSON notoʻgʻri');
  }
  const r = schema.safeParse(json);
  if (!r.success) throw ApiError.validation(r.error.flatten());
  return r.data;
}

export function parseQuery<S extends ZodTypeAny>(req: NextRequest, schema: S): z.infer<S> {
  const obj: Record<string, string | string[]> = {};
  req.nextUrl.searchParams.forEach((v, k) => {
    const prev = obj[k];
    if (prev === undefined) obj[k] = v;
    else obj[k] = Array.isArray(prev) ? [...prev, v] : [prev, v];
  });
  const r = schema.safeParse(obj);
  if (!r.success) throw ApiError.validation(r.error.flatten());
  return r.data;
}

// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;

/** Oddiy XSS himoyasi: HTML teglarini va boshqaruv belgilarini olib tashlash (matn maydonlari uchun) */
export function sanitizeText(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(CONTROL_CHARS, '').trim();
}

// ── Umumiy zod yordamchilari ──
export const zMoney = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === 'string' ? v.replace(/\s/g, '') : v))
  .pipe(z.coerce.number().int('Butun soʻm boʻlishi kerak').min(0).max(99_999_999_999));

export const zMoneySigned = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === 'string' ? v.replace(/\s/g, '') : v))
  .pipe(z.coerce.number().int().min(-99_999_999_999).max(99_999_999_999));

export const zQuantity = z.coerce
  .number()
  .positive()
  .max(99)
  .refine((q) => Number.isInteger(q * 2), 'Miqdor 0.5 ga karrali boʻlishi kerak');

export const zText = (max = 500) => z.string().trim().max(max).transform(sanitizeText);
export const zOptionalText = (max = 500) => zText(max).optional().nullable();

export const zPhone = z
  .string()
  .trim()
  .transform((s) => s.replace(/[^\d+]/g, ''))
  .refine((s) => /^\+?\d{9,13}$/.test(s), 'Telefon raqami notoʻgʻri');

export const zDate = z.coerce.date();
export const zId = z.string().min(1).max(64);
export const zPage = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
});
