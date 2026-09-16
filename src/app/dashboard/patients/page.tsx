import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { getT } from '@/i18n/server';
import { parseListSearchParams, type SearchParamsInput } from '@/lib/patients/list-params';
import { PatientsPage } from '@/components/patients/patients-page';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = getT();
  return { title: t('patients.title'), robots: { index: false, follow: false } };
}

/** /dashboard/patients — bemorlar reyestri (patients.view) */
export default async function PatientsRoute({ searchParams }: { searchParams: SearchParamsInput }) {
  const user = await requireUser('patients.view');
  const clinic = await prisma.clinic.findUnique({
    where: { id: user.clinicId },
    select: { childAgeLimit: true },
  });
  const initial = parseListSearchParams(searchParams);
  return (
    <PatientsPage
      viewer={{ id: user.id, role: user.role, fullName: user.fullName }}
      childAgeLimit={clinic?.childAgeLimit ?? 14}
      initial={initial}
      openNew={searchParams.new === '1'}
    />
  );
}
