import { withAuth, ok } from '@/lib/api';
import { PrintTicketSchema } from '@/lib/queue/schemas';
import { loadQueueClinic, markPrinted, ticketDataForRow, toRowDTO } from '@/lib/queue/service';
import type { TicketWithDataDTO } from '@/lib/queue/types';
import { parseOptionalBody, resolveLocale } from '../../_lib';

export const dynamic = 'force-dynamic';

/** POST /api/queue/[id]/print {locale?} — `printedAt` belgilanadi, printer uchun TicketData qaytadi */
export const POST = withAuth<{ id: string }>({ permission: 'queue.view' }, async ({ clinicId, req, params }) => {
  const body = await parseOptionalBody(req, PrintTicketSchema);
  const locale = resolveLocale(req, body.locale);
  const [row, clinic] = await Promise.all([markPrinted(clinicId, params.id), loadQueueClinic(clinicId)]);
  const data: TicketWithDataDTO = { ticket: toRowDTO(row), ticketData: await ticketDataForRow(row, clinic, locale) };
  return ok(data);
});
