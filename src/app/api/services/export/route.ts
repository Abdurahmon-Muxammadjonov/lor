import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { todayKey } from '@/lib/date';
import { isLocale, LOCALE_COOKIE, type Locale } from '@/i18n/config';
import { listServices } from '@/lib/services/service';
import { buildPriceListWorkbook, priceListFileName } from '@/lib/services/excel';

export const dynamic = 'force-dynamic';

/** GET /api/services/export?all=1&locale= → Excel narxlar roʻyxati (faqat ADMIN) */
export const GET = withAuth({ roles: ['ADMIN'], permission: 'services.write' }, async ({ req, clinicId, user }) => {
  const sp = req.nextUrl.searchParams;
  const all = sp.get('all') === '1';
  const fromQuery = sp.get('locale');
  const fromCookie = req.cookies.get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(fromQuery) ? fromQuery : isLocale(fromCookie) ? fromCookie : 'uz';

  const clinic = await prisma.clinic.findFirst({ where: { id: clinicId }, select: { name: true } });
  const services = await listServices(clinicId, { all, categoryId: undefined, q: undefined });
  const dateKey = todayKey();
  const buffer = await buildPriceListWorkbook(services, { clinicName: clinic?.name ?? user.clinicName, locale, dateKey });

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${priceListFileName(dateKey)}"`,
      'Cache-Control': 'no-store',
    },
  });
});
