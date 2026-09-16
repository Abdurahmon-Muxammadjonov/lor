import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth/session';
import { getLocale, getT } from '@/i18n/server';
import { prisma } from '@/lib/prisma';
import { reportsHref } from '@/lib/reports/url';
import { canViewReport } from '@/lib/reports/access';
import { PrintQuerySchema } from '@/lib/reports/schemas';
import { debtors, doctors, medicine, patientTypes, revenue, services, shifts, summary } from '@/lib/reports/queries';
import type { ReportTab } from '@/lib/reports/types';
import { PrintActions } from '@/components/reports/print/print-actions';
import { PrintView, type PrintReport } from '@/components/reports/print/print-view';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = getT();
  return { title: t('reports.meta.print'), robots: { index: false } };
}

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** Qogʻoz uchun CSS: qobiq (yon panel, fon effektlari) yashiriladi, varaq A4 (smenalar — landshaft), jadval sarlavhasi takrorlanadi */
function printCss(tab: ReportTab): string {
  return `
@page { size: A4 ${tab === 'shifts' || tab === 'revenue' ? 'landscape' : 'portrait'}; margin: 10mm; }
@media print {
  aside, nav, header.no-print, .no-print, [data-sonner-toaster] { display: none !important; }
  body > div > div[aria-hidden="true"], .fixed { display: none !important; }
  [data-sidebar] { padding-left: 0 !important; }
  main#main { padding: 0 !important; margin: 0 !important; max-width: none !important; }
  .print-root { max-width: none !important; padding: 0 !important; box-shadow: none !important; border-radius: 0 !important; }
  .print-table thead { display: table-header-group; }
  .print-table tr { break-inside: avoid; page-break-inside: avoid; }
  .print-table { font-size: 10px; }
}
`;
}

async function loadReport(tab: ReportTab, clinicId: string, q: { from: string; to: string; doctorId: string | null; groupBy: 'day' | 'week' | 'month'; all: boolean }): Promise<PrintReport> {
  const filters = { from: q.from, to: q.to, doctorId: q.doctorId };
  switch (tab) {
    case 'revenue':
      return { tab, report: await revenue(clinicId, filters, q.groupBy) };
    case 'doctors':
      return { tab, report: await doctors(clinicId, filters) };
    case 'services':
      return { tab, report: await services(clinicId, filters) };
    case 'patient-types':
      return { tab, report: await patientTypes(clinicId, filters, q.groupBy) };
    case 'medicine':
      return { tab, report: await medicine(clinicId, filters) };
    case 'shifts':
      return { tab, report: await shifts(clinicId, filters) };
    case 'debtors':
      return { tab, report: await debtors(clinicId, filters, q.all) };
  }
}

/**
 * /dashboard/reports/print?tab&from&to&groupBy&doctorId&all&auto — chop etish uchun sahifa (reports.view).
 * Maʼlumot serverda toʻgʻridan-toʻgʻri agregatsiya qilinadi; foydalanuvchi «PDF sifatida saqlash» qiladi.
 */
export default async function ReportsPrintRoute({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser('reports.view');
  const parsed = PrintQuerySchema.safeParse({
    tab: first(searchParams.tab),
    from: first(searchParams.from),
    to: first(searchParams.to),
    groupBy: first(searchParams.groupBy),
    doctorId: first(searchParams.doctorId),
    all: first(searchParams.all),
    auto: first(searchParams.auto),
  });
  const q = parsed.success ? parsed.data : PrintQuerySchema.parse({});
  if (!canViewReport(user.role, q.tab)) redirect('/dashboard?denied=1');

  const t = getT();
  const locale = getLocale();
  const filters = { from: q.from, to: q.to, doctorId: q.doctorId };
  const [clinic, doctor, data, sum] = await Promise.all([
    prisma.clinic.findFirst({ where: { id: user.clinicId }, select: { name: true, phone: true } }),
    q.doctorId ? prisma.user.findFirst({ where: { id: q.doctorId, clinicId: user.clinicId }, select: { fullName: true } }) : Promise.resolve(null),
    loadReport(q.tab, user.clinicId, q),
    summary(user.clinicId, filters),
  ]);

  const backHref = reportsHref({ tab: q.tab, from: q.from, to: q.to, groupBy: q.groupBy, doctorId: q.doctorId, allTime: q.all });

  return (
    <div className="space-y-4">
      <style dangerouslySetInnerHTML={{ __html: printCss(q.tab) }} />
      <PrintActions backHref={backHref} auto={q.auto} />
      <PrintView
        data={data}
        summary={sum}
        t={t}
        meta={{
          clinicName: clinic?.name ?? user.clinicName,
          clinicPhone: clinic?.phone ?? '',
          range: { from: q.from, to: q.to },
          groupBy: q.groupBy,
          doctorName: doctor?.fullName ?? null,
          generatedAt: new Date(),
          locale,
        }}
      />
    </div>
  );
}
