import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { getLocale, getT } from '@/i18n/server';
import { parseClinicSettings } from '@/lib/settings/types';
import { loadReceiptVisit, visitReceipt } from '@/lib/cashier/service';
import { PrintReceiptClient } from '@/components/cashier/print-receipt-client';

export const dynamic = 'force-dynamic';

interface Params {
  visitId: string;
}

type SearchParams = Record<string, string | string[] | undefined>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const t = getT();
  return {
    title: `${t('cashier.meta.receipt')} ${params.visitId.slice(-6)}`,
    robots: { index: false, follow: false },
  };
}

/**
 * /print/receipt/[visitId] — kassa cheki (HTML), sessiya majburiy (payments.view).
 * Printer kutubxonasining BROWSER zaxirasi va bemor kartasi shu sahifani yashirin iframe da ochadi;
 * toʻgʻridan-toʻgʻri ochilganda avtomatik chop etiladi (`?print=0` — oʻchiradi).
 */
export default async function PrintReceiptPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?callbackUrl=${encodeURIComponent(`/print/receipt/${params.visitId}`)}`);
  if (!can(user.role, 'payments.view')) redirect('/dashboard?denied=1');

  const visit = await loadReceiptVisit(user.clinicId, params.visitId);
  if (!visit) notFound();

  const locale = getLocale();
  const printer = parseClinicSettings(visit.clinic.settings).printer;
  const receipt = visitReceipt(visit, locale);
  const printParam = Array.isArray(searchParams.print) ? searchParams.print[0] : searchParams.print;

  return (
    <PrintReceiptClient
      receipt={receipt}
      paperWidth={printer.paperWidth}
      showQr={printer.receiptQr}
      autoPrint={printParam !== '0'}
      hasPayments={visit.payments.length > 0}
    />
  );
}
