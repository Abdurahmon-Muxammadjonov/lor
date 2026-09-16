import type { Role } from '@prisma/client';
import type { NextRequest } from 'next/server';
import type { z, ZodTypeAny } from 'zod';
import { ApiError } from '@/lib/api/errors';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from '@/i18n/config';
import type { SessionUser } from '@/lib/auth/session';
import type { QueueActor } from '@/lib/queue/service';

/** Route handlerlar uchun umumiy yordamchilar (faqat shu papka ichida ishlatiladi) */

export function actorFrom(user: SessionUser, ip: string, req: NextRequest): QueueActor {
  return { id: user.id, role: user.role as Role, room: user.room ?? null, ip, userAgent: req.headers.get('user-agent') };
}

/** Tanadagi `locale` boʻlsa — u, aks holda NEXT_LOCALE cookie → Accept-Language → uz (soʻrov konteksti talab qilinmaydi) */
export function resolveLocale(req: NextRequest, explicit?: Locale | null): Locale {
  if (explicit) return explicit;
  const c = req.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(c)) return c;
  const al = req.headers.get('accept-language') ?? '';
  return /^ru\b/i.test(al) ? 'ru' : DEFAULT_LOCALE;
}

/** Tanasi ixtiyoriy boʻlgan POST lar uchun: boʻsh tana → `{}` sxema orqali (defaultlar), aks holda JSON tekshiruvi */
export async function parseOptionalBody<S extends ZodTypeAny>(req: NextRequest, schema: S): Promise<z.infer<S>> {
  let text = '';
  try {
    text = await req.text();
  } catch {
    text = '';
  }
  let json: unknown = {};
  if (text.trim()) {
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      throw ApiError.validation(undefined, 'JSON notoʻgʻri');
    }
  }
  const r = schema.safeParse(json);
  if (!r.success) throw ApiError.validation(r.error.flatten());
  return r.data;
}
