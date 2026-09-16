import 'server-only';
import { cookies, headers } from 'next/headers';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from './config';
import { getMessages } from './messages';
import { makeT } from './t';

/**
 * Server komponentlar / route handlerlar uchun joriy til (cookie → Accept-Language → uz).
 *
 * `cookies()`/`headers()` soʻrov kontekstidan tashqarida (build vaqtida sahifa maʼlumotlarini
 * yigʻishda, `/_not-found` ni statik render qilishda) xato tashlashi mumkin — bunday holatda
 * sahifa qulamasligi va standart tilga qaytishi kerak.
 */
export function getLocale(): Locale {
  try {
    const c = cookies().get(LOCALE_COOKIE)?.value;
    if (isLocale(c)) return c;
  } catch {
    return DEFAULT_LOCALE;
  }
  try {
    const al = headers().get('accept-language') ?? '';
    if (/^ru\b/i.test(al)) return 'ru';
  } catch {
    return DEFAULT_LOCALE;
  }
  return DEFAULT_LOCALE;
}

export function getT(locale: Locale = getLocale()) {
  return makeT(getMessages(), locale);
}
