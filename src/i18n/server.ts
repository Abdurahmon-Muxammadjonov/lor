import 'server-only';
import { cookies, headers } from 'next/headers';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from './config';
import { getMessages } from './messages';
import { makeT } from './t';

/** Server komponentlar / route handlerlar uchun joriy til (cookie → Accept-Language → uz) */
export function getLocale(): Locale {
  const c = cookies().get(LOCALE_COOKIE)?.value;
  if (isLocale(c)) return c;
  const al = headers().get('accept-language') ?? '';
  if (/^ru\b/i.test(al)) return 'ru';
  return DEFAULT_LOCALE;
}

export function getT(locale: Locale = getLocale()) {
  return makeT(getMessages(), locale);
}
