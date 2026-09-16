import { withAuth, ok, created, parseBody, parseQuery } from '@/lib/api';
import { todayKey } from '@/lib/date';
import { BoardQuerySchema, CreateTicketSchema } from '@/lib/queue/schemas';
import { createTicket, getBoard, ticketDataForRow, toRowDTO } from '@/lib/queue/service';
import type { CreatedTicketDTO } from '@/lib/queue/types';
import { publishQueueEvent, queueEventFromRow } from '@/lib/realtime/queue-events';
import { resolveLocale } from './_lib';

export const dynamic = 'force-dynamic';

/** GET /api/queue?date=YYYY-MM-DD — kunlik taxta (ustunlar + statistika) */
export const GET = withAuth({ permission: 'queue.view' }, async ({ clinicId, req }) => {
  const q = parseQuery(req, BoardQuerySchema);
  const board = await getBoard(clinicId, q.date ?? todayKey());
  return ok(board, { headers: { 'Cache-Control': 'no-store' } });
});

/** POST /api/queue {type, patientId?, doctorId?} — yangi talon (qabulxona/shifokor/admin/kassir) */
export const POST = withAuth({ permission: 'queue.call' }, async ({ clinicId, req }) => {
  const body = await parseBody(req, CreateTicketSchema);
  const { row, ahead, waitMin, clinic } = await createTicket({ clinicId, type: body.type, patientId: body.patientId, doctorId: body.doctorId });
  publishQueueEvent(clinicId, queueEventFromRow(row, null, 'created'));
  const ticketData = await ticketDataForRow(row, clinic, resolveLocale(req, body.locale), ahead);
  const data: CreatedTicketDTO = { ...toRowDTO(row), ahead, waitMin, ticketData };
  return created(data);
});
