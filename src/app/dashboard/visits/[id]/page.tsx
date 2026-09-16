import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth/session';
import { getT } from '@/i18n/server';
import {
  getVisit,
  listTreatmentServices,
  toTreatmentServiceDTOs,
  toVisitDetailDTO,
} from '@/lib/visits/service';
import { VisitWorkspace } from '@/components/treatment/visit-workspace';

export const dynamic = 'force-dynamic';

interface Props {
  params: { id: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = getT();
  const user = await requireUser('visits.view');
  const visit = await getVisit(user.clinicId, params.id);
  return { title: visit ? `${t('visits.meta.visit')} · ${visit.patient.fullName}` : t('visits.meta.visit') };
}

/** /dashboard/visits/[id] — ⭐ muolaja kalkulyatori va qabul ish maydoni */
export default async function VisitPage({ params }: Props) {
  const user = await requireUser('visits.view');
  const [visit, services] = await Promise.all([
    getVisit(user.clinicId, params.id),
    listTreatmentServices(user.clinicId),
  ]);
  if (!visit) notFound();

  return (
    <VisitWorkspace visit={toVisitDetailDTO(visit)} services={toTreatmentServiceDTOs(services)} user={user} />
  );
}
