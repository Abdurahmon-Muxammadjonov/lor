import { withPublic, created, parseBody } from '@/lib/api';
import { KioskTicketSchema } from '@/lib/queue/schemas';
import { createTicket, requireClinicByKioskKey, ticketDataForRow, toRowDTO } from '@/lib/queue/service';
import type { KioskTicketResultDTO } from '@/lib/queue/types';
import { publishQueueEvent, queueEventFromRow } from '@/lib/realtime/queue-events';
import { enforceKioskRateLimit } from '../_lib';

export const dynamic = 'force-dynamic';

/** POST /api/kiosk/ticket {key, type, locale?} — ochiq: kiosk kaliti boʻyicha klinika, talon + printer maʼlumoti */
export const POST = withPublic(async ({ req, ip }) => {
  enforceKioskRateLimit(ip, 'ticket');
  const body = await parseBody(req, KioskTicketSchema);
  const clinic = await requireClinicByKioskKey(body.key);
  const { row, ahead, waitMin } = await createTicket({ clinicId: clinic.id, type: body.type, enforceEnabled: true });
  publishQueueEvent(clinic.id, queueEventFromRow(row, null, 'created'));
  const ticketData = await ticketDataForRow(row, clinic, body.locale ?? 'uz', ahead);
  const data: KioskTicketResultDTO = {
    ticket: { ...toRowDTO(row), ahead, waitMin, ticketData },
    ticketData,
    showSeconds: clinic.settings.queue.kioskShowSeconds,
  };
  return created(data);
});
