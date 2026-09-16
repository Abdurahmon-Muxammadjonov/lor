import { notFound } from 'next/navigation';
import { findClinicByKioskKey } from '@/lib/queue/service';
import type { KioskConfig } from '@/lib/queue/types';
import { KioskScreen } from '@/components/queue/kiosk-screen';

export const dynamic = 'force-dynamic';

/** /kiosk?key=<clinic.kioskKey> — bemor oʻzi talon oladi (sessiyasiz, kalit bilan) */
export default async function KioskPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const key = typeof searchParams.key === 'string' ? searchParams.key.trim() : '';
  const clinic = key ? await findClinicByKioskKey(key) : null;
  if (!clinic) notFound();

  const config: KioskConfig = {
    key,
    clinicName: clinic.name,
    clinicPhone: clinic.phone,
    ticketFooter: clinic.ticketFooter,
    queue: clinic.settings.queue,
    // Tarmoq printeri manzili mijozga berilmaydi — NETWORK chop etish server orqali (/api/kiosk/print)
    printer: { ...clinic.settings.printer, host: '', port: 9100 },
  };
  return <KioskScreen config={config} />;
}
