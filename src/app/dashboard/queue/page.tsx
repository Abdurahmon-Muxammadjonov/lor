import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { todayKey } from '@/lib/date';
import { getT } from '@/i18n/server';
import { getBoard, loadQueueClinic } from '@/lib/queue/service';
import type { QueueViewer } from '@/lib/queue/types';
import { QueueBoard } from '@/components/queue/queue-board';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = getT();
  return { title: t('queue.meta.board'), robots: { index: false, follow: false } };
}

const KIOSK_KEY_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'RECEPTION']);

/** /dashboard/queue — jonli navbat taxtasi (queue.view) */
export default async function QueueRoute({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  const user = await requireUser('queue.view');
  const today = todayKey();
  const [clinic, initialBoard] = await Promise.all([loadQueueClinic(user.clinicId), getBoard(user.clinicId, today)]);
  const viewer: QueueViewer = { id: user.id, role: user.role, fullName: user.fullName, room: user.room ?? null };
  return (
    <QueueBoard
      viewer={viewer}
      clinic={{ name: clinic.name, phone: clinic.phone, ticketFooter: clinic.ticketFooter, kioskKey: KIOSK_KEY_ROLES.has(user.role) ? clinic.kioskKey : null }}
      settings={clinic.settings.queue}
      initialBoard={initialBoard}
      todayKey={today}
      openNew={searchParams.new === '1'}
    />
  );
}
