import type { NextRequest } from 'next/server';
import { withAuth, ok, parseQuery } from '@/lib/api';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from '@/i18n/config';
import { searchIcd10 } from '@/data/icd10-lor';
import { Icd10QuerySchema } from '@/lib/visits/schemas';

export const dynamic = 'force-dynamic';

/** Soʻrov tili: ?locale= → NEXT_LOCALE cookie → Accept-Language → uz */
function requestLocale(req: NextRequest, override: string | undefined): Locale {
  if (isLocale(override)) return override;
  const cookie = req.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookie)) return cookie;
  return /^ru\b/i.test(req.headers.get('accept-language') ?? '') ? 'ru' : DEFAULT_LOCALE;
}

/** GET /api/icd10?q=&limit=&locale= — LOR ICD-10 kodlari (kod yoki nom boʻyicha, joriy tilga qarab reyting) */
export const GET = withAuth({ permission: 'visits.view' }, async ({ req }) => {
  const { q, limit, locale } = parseQuery(req, Icd10QuerySchema);
  const items = searchIcd10(q, requestLocale(req, locale), limit);
  return ok({ items });
});
