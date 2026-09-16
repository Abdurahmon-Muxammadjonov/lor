import type { NextRequest } from 'next/server';
import type { Role } from '@prisma/client';
import { ApiError } from '@/lib/api/errors';
import { isLocale, LOCALE_COOKIE, type Locale } from '@/i18n/config';
import { canViewReport } from './access';
import type { ReportKind } from './types';

/** Boʻlimga ruxsat yoʻq boʻlsa 403 (CASHIER → faqat tushum/smenalar/qarzdorlar; doctors/full → reports.full) */
export function assertReportAccess(role: Role, kind: ReportKind): void {
  if (!canViewReport(role, kind)) throw ApiError.forbidden();
}

/** Soʻrov tili: ?locale= → NEXT_LOCALE cookie → uz (next/headers ishlatilmaydi — testlarda ham ishlaydi) */
export function requestLocale(req: NextRequest): Locale {
  const q = req.nextUrl.searchParams.get('locale');
  if (isLocale(q)) return q;
  const c = req.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(c)) return c;
  const al = req.headers.get('accept-language') ?? '';
  return /^ru\b/i.test(al) ? 'ru' : 'uz';
}
