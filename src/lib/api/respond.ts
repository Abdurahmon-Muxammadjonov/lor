import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { ApiError } from './errors';
import { CalcError } from '@/lib/calc';
import { MoneyError } from '@/lib/money';

/**
 * Yagona javob shakli:
 *   { ok: true, data }               — muvaffaqiyat
 *   { ok: false, error: {code, message, details?} } — xato
 */
export type ApiOk<T> = { ok: true; data: T };
export type ApiFail = { ok: false; error: { code: string; message: string; details?: unknown } };
export type ApiResponse<T> = ApiOk<T> | ApiFail;

/** Decimal koʻrinishidagi qiymat (Prisma.Decimal yoki decimal.js — ikkalasi ham `toFixed` + `d/e/s` maydonlariga ega) */
function isDecimalLike(v: unknown): v is { toString(): string; toFixed(n: number): string } {
  return (
    v instanceof Prisma.Decimal ||
    (!!v && typeof v === 'object' && 'toFixed' in v && 'd' in v && 'e' in v && 's' in v)
  );
}

/**
 * Prisma Decimal / decimal.js / BigInt → JSON-safe number.
 * Pul DB da butun soʻm saqlanadi (Decimal(14,2), `dbMoney`/`toMoneyString`), shuning uchun natija butun number;
 * `quantity` (0.5 qadam) va foizli qiymatlar (12.5 %) esa aniq saqlanadi — yaxlitlanmaydi.
 * Muhim: JSON.stringify replacer ga qiymatni `toJSON()` dan KEYIN beradi (Decimal → string),
 * shuning uchun xom qiymat `this[key]` (holder) orqali olinadi — replacer `function` boʻlishi shart.
 */
export function serialize<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, function (this: Record<string, unknown>, k: string, v: unknown) {
      const raw = this[k];
      if (isDecimalLike(raw)) return Number(raw.toString());
      if (typeof v === 'bigint') return Number(v);
      return v;
    }),
  ) as T;
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiOk<T>> {
  return NextResponse.json({ ok: true as const, data: serialize(data) }, init);
}

export function created<T>(data: T): NextResponse<ApiOk<T>> {
  return ok(data, { status: 201 });
}

export function fail(
  status: number,
  code: string,
  message: string,
  details?: unknown,
): NextResponse<ApiFail> {
  return NextResponse.json({ ok: false as const, error: { code, message, details } }, { status });
}

export function toErrorResponse(err: unknown): NextResponse<ApiFail> {
  if (err instanceof ApiError) return fail(err.status, err.code, err.message, err.details);
  if (err instanceof ZodError) return fail(400, 'VALIDATION', 'Maʼlumotlar notoʻgʻri', err.flatten());
  if (err instanceof CalcError) return fail(400, err.code, calcMessage(err.code));
  if (err instanceof MoneyError) return fail(400, err.code, 'Pul qiymati notoʻgʻri');
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return fail(409, 'CONFLICT', 'Bunday yozuv allaqachon mavjud', err.meta);
    if (err.code === 'P2025') return fail(404, 'NOT_FOUND', 'Topilmadi');
    if (err.code === 'P2003') return fail(409, 'CONFLICT', 'Bogʻliq yozuvlar mavjud');
  }
  console.error('[api] unhandled error', err);
  return fail(500, 'INTERNAL', 'Server xatosi');
}

function calcMessage(code: CalcError['code']): string {
  switch (code) {
    case 'INVALID_QUANTITY':
      return 'Miqdor notoʻgʻri (0.5 ga karrali va 0 dan katta boʻlishi kerak)';
    case 'HALF_NOT_ALLOWED':
      return 'Bu muolajani yarim miqdorda qilib boʻlmaydi';
    case 'INVALID_DISCOUNT':
      return 'Chegirma notoʻgʻri';
    case 'MEDICINE_REQUIRED':
      return 'Bu muolaja faqat dori bilan bajariladi';
    case 'NEGATIVE_PRICE':
      return 'Narx manfiy boʻlishi mumkin emas';
  }
}
