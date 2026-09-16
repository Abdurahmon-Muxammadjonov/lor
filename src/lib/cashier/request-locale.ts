import type { NextRequest } from 'next/server';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from '@/i18n/config';

/** Route handler uchun til: NEXT_LOCALE cookie → Accept-Language → uz (`server-only` importsiz, testlarda ham ishlaydi) */
export function requestLocale(req: NextRequest): Locale {
  const c = req.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(c)) return c;
  return /^ru\b/i.test(req.headers.get('accept-language') ?? '') ? 'ru' : DEFAULT_LOCALE;
}
