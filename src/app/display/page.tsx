import { notFound } from 'next/navigation';
import { findClinicByKioskKey, getDisplayState } from '@/lib/queue/service';
import type { DisplayConfig } from '@/lib/queue/types';
import { DisplayBoard } from '@/components/queue/display-board';

export const dynamic = 'force-dynamic';

/** /display?key=<clinic.kioskKey> — TV tablo: chaqirilayotgan raqamlar, xonalar, kutayotganlar (sessiyasiz) */
export default async function DisplayPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const key = typeof searchParams.key === 'string' ? searchParams.key.trim() : '';
  const clinic = key ? await findClinicByKioskKey(key) : null;
  if (!clinic) notFound();

  const initial = await getDisplayState(clinic);
  const config: DisplayConfig = {
    key,
    clinicId: clinic.id,
    clinicName: clinic.name,
    clinicPhone: clinic.phone,
    displaySound: clinic.settings.queue.displaySound,
    displayVoice: clinic.settings.queue.displayVoice,
    initial,
  };
  return <DisplayBoard config={config} />;
}
