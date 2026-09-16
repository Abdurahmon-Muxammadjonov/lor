import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { todayKey } from '@/lib/date';
import { getT } from '@/i18n/server';
import { VisitsList, type VisitsListInitial } from '@/components/treatment/visits-list';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  const t = getT();
  return { title: t('visits.meta.list') };
}

type SearchParams = Record<string, string | string[] | undefined>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES = new Set(['OPEN', 'COMPLETED', 'CANCELLED']);

function str(sp: SearchParams | undefined, key: string): string | undefined {
  const v = sp?.[key];
  return typeof v === 'string' && v.length > 0 && v.length <= 64 ? v : undefined;
}

/** /dashboard/visits?from=&to=&doctorId=&status=&new=1&patientId= */
export default async function VisitsPage({ searchParams }: { searchParams?: SearchParams }) {
  const user = await requireUser('visits.view');
  const clinic = await prisma.clinic.findUnique({
    where: { id: user.clinicId },
    select: { childAgeLimit: true },
  });
  const today = todayKey();

  const from = str(searchParams, 'from');
  const to = str(searchParams, 'to');
  const status = str(searchParams, 'status');
  const initial: VisitsListInitial = {
    from: from && DATE_RE.test(from) ? from : today,
    to: to && DATE_RE.test(to) ? to : from && DATE_RE.test(from) ? from : today,
    doctorId: str(searchParams, 'doctorId'),
    status: status && STATUSES.has(status) ? (status as VisitsListInitial['status']) : undefined,
    openNew: str(searchParams, 'new') === '1',
    patientId: str(searchParams, 'patientId'),
  };
  if (initial.patientId) initial.openNew = true;

  return (
    <VisitsList user={user} initial={initial} today={today} childAgeLimit={clinic?.childAgeLimit ?? 14} />
  );
}
