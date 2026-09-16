import type { NextRequest } from 'next/server';
import { withAuth, parseQuery } from '@/lib/api';
import { DEFAULT_LOCALE, LOCALE_COOKIE, getMessages, isLocale, makeT, type Locale } from '@/i18n';
import { todayKey, fmtDateTime } from '@/lib/date';
import { formatPhone } from '@/lib/utils';
import { toMoneyString } from '@/lib/money';
import { buildCsv, type CsvCell } from '@/lib/patients/csv';
import { PatientListQuery } from '@/lib/patients/schemas';
import { exportPatients, getClinicChildAgeLimit } from '@/lib/patients/service';
import { keyToDisplay, toDateKey } from '@/lib/patients/age';

export const dynamic = 'force-dynamic';

/** GET /api/patients/export — CSV (UTF-8 BOM, `;`), faqat ADMIN. Roʻyxat filtrlari qoʻllanadi. */
function requestLocale(req: NextRequest): Locale {
  const c = req.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(c)) return c;
  return /^ru\b/i.test(req.headers.get('accept-language') ?? '') ? 'ru' : DEFAULT_LOCALE;
}

export const GET = withAuth({ roles: ['ADMIN'] }, async ({ clinicId, req }) => {
  const locale = requestLocale(req);
  const t = makeT(getMessages(), locale);
  const parsed = parseQuery(req, PatientListQuery);
  const filters = {
    q: parsed.q,
    sort: parsed.sort,
    dir: parsed.dir,
    gender: parsed.gender,
    type: parsed.type,
    hasDebt: parsed.hasDebt,
  };
  const childAgeLimit = await getClinicChildAgeLimit(clinicId);
  const rows = await exportPatients(clinicId, filters, childAgeLimit);

  const headers = [
    t('patients.csv.cardNumber'),
    t('patients.csv.fullName'),
    t('patients.csv.birthDate'),
    t('patients.csv.age'),
    t('patients.csv.type'),
    t('patients.csv.gender'),
    t('patients.csv.phone'),
    t('patients.csv.phone2'),
    t('patients.csv.address'),
    t('patients.csv.allergies'),
    t('patients.csv.chronic'),
    t('patients.csv.notes'),
    t('patients.csv.source'),
    t('patients.csv.smsConsent'),
    t('patients.csv.createdAt'),
    t('patients.csv.visits'),
    t('patients.csv.lastVisit'),
    t('patients.csv.debt'),
  ];
  const data: CsvCell[][] = rows.map((p) => {
    return [
      p.cardNumber,
      p.fullName,
      keyToDisplay(toDateKey(p.birthDate)),
      p.age,
      t(`common.patientType.${p.patientType}`),
      t(`common.gender.${p.gender}`),
      formatPhone(p.phone),
      p.phone2 ? formatPhone(p.phone2) : '',
      p.address ?? '',
      p.allergies ?? '',
      p.chronic ?? '',
      p.notes ?? '',
      p.source ?? '',
      p.smsConsent ? t('patients.csv.yes') : t('patients.csv.no'),
      fmtDateTime(p.createdAt, locale),
      p.visitsCount,
      p.lastVisitAt ? fmtDateTime(p.lastVisitAt, locale) : '',
      toMoneyString(p.debt),
    ];
  });

  const csv = buildCsv(headers, data);
  const fileName = `${t('patients.csv.fileName')}-${todayKey()}.csv`;
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
});
