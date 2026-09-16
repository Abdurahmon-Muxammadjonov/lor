import { withAuth, ok } from '@/lib/api';
import { getTicket, loadQueueClinic, ticketDataForRow, toRowDTO } from '@/lib/queue/service';
import type { TicketWithDataDTO } from '@/lib/queue/types';
import { resolveLocale } from '../_lib';

export const dynamic = 'force-dynamic';

/** GET /api/queue/[id] — bitta talon + printer maʼlumoti */
export const GET = withAuth<{ id: string }>({ permission: 'queue.view' }, async ({ clinicId, req, params }) => {
  const [row, clinic] = await Promise.all([getTicket(clinicId, params.id), loadQueueClinic(clinicId)]);
  const data: TicketWithDataDTO = { ticket: toRowDTO(row), ticketData: await ticketDataForRow(row, clinic, resolveLocale(req)) };
  return ok(data, { headers: { 'Cache-Control': 'no-store' } });
});
