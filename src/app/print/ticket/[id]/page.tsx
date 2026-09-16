import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth/session';
import { getLocale, getT } from '@/i18n/server';
import { isLocale } from '@/i18n/config';
import { findClinicByKioskKey, loadQueueClinic, queueRowInclude, ticketDataForRow } from '@/lib/queue/service';
import { AutoPrint } from '@/components/queue/auto-print';
import { TicketPreview } from '@/components/queue/ticket-preview';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = getT();
  return { title: t('queue.meta.print'), robots: { index: false, follow: false } };
}

interface PageProps {
  params: { id: string };
  searchParams: Record<string, string | string[] | undefined>;
}

/**
 * /print/ticket/[id]?key=&locale= — 58/80 mm talon (brauzer orqali chop etish zaxirasi).
 * Ruxsat: kiosk kaliti (talon klinikasiga mos) yoki shu klinika sessiyasi. Iframe ichida transportning oʻzi
 * `print()` ni chaqiradi; toʻgʻridan-toʻgʻri ochilsa — <AutoPrint/> avtomatik chop etadi.
 */
export default async function PrintTicketPage({ params, searchParams }: PageProps) {
  const key = typeof searchParams.key === 'string' ? searchParams.key.trim() : '';
  const row = await prisma.queue.findFirst({ where: { id: params.id }, include: queueRowInclude });
  if (!row) notFound();

  let allowed = false;
  if (key) {
    const byKey = await findClinicByKioskKey(key);
    allowed = !!byKey && byKey.id === row.clinicId;
  }
  if (!allowed) {
    const user = await getCurrentUser();
    allowed = !!user && (user.clinicId === row.clinicId || user.role === 'SUPER_ADMIN');
  }
  if (!allowed) notFound();

  const clinic = await loadQueueClinic(row.clinicId);
  const localeParam = typeof searchParams.locale === 'string' ? searchParams.locale : '';
  const locale = isLocale(localeParam) ? localeParam : getLocale();
  const data = await ticketDataForRow(row, clinic, locale);
  const width = clinic.settings.printer.paperWidth;
  const t = getT(locale);

  return (
    <div className="flex min-h-dvh flex-col items-center bg-white pb-24 pt-4 text-black print:min-h-0 print:p-0">
      <style>{`@page { size: ${width}mm auto; margin: 2mm; } @media print { html, body { background: #fff !important; margin: 0; } }`}</style>
      <h1 className="sr-only">
        {t('queue.print.title')} {data.number}
      </h1>
      <TicketPreview data={data} paperWidth={width} className="print:px-0" />
      <AutoPrint />
    </div>
  );
}
