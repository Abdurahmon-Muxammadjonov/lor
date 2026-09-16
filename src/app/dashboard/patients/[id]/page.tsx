import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { getT } from '@/i18n/server';
import { PatientCard, type PatientCardTab } from '@/components/patients/patient-card';

export const dynamic = 'force-dynamic';

interface RouteProps {
  params: { id: string };
  searchParams: Record<string, string | string[] | undefined>;
}

const TABS: PatientCardTab[] = ['visits', 'finance', 'appointments', 'documents'];

function tabFrom(v: string | string[] | undefined): PatientCardTab {
  const s = Array.isArray(v) ? v[0] : v;
  return TABS.includes(s as PatientCardTab) ? (s as PatientCardTab) : 'visits';
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const t = getT();
  const user = await requireUser('patients.view');
  const patient = await prisma.patient.findFirst({
    where: { id: params.id, clinicId: user.clinicId },
    select: { fullName: true, cardNumber: true },
  });
  const title = patient ? `${patient.fullName} · ${patient.cardNumber}` : t('patients.card.title');
  return { title, robots: { index: false, follow: false } };
}

/** /dashboard/patients/[id] — bemor kartasi (patients.view) */
export default async function PatientRoute({ params, searchParams }: RouteProps) {
  const user = await requireUser('patients.view');
  const clinic = await prisma.clinic.findUnique({
    where: { id: user.clinicId },
    select: { childAgeLimit: true },
  });
  return (
    <PatientCard
      id={params.id}
      viewer={{ id: user.id, role: user.role, fullName: user.fullName }}
      childAgeLimit={clinic?.childAgeLimit ?? 14}
      initialTab={tabFrom(searchParams.tab)}
    />
  );
}
