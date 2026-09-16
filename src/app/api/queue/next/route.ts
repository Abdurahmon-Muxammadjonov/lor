import { withAuth, ok, parseBody } from '@/lib/api';
import { NextTicketSchema } from '@/lib/queue/schemas';
import { callNext, toRowDTO } from '@/lib/queue/service';
import type { NextTicketResultDTO } from '@/lib/queue/types';
import { actorFrom } from '../_lib';

export const dynamic = 'force-dynamic';

/** POST /api/queue/next {type} — navbatdagi keyingi talonni chaqirish (shifokor: oʻz xonasiga) */
export const POST = withAuth({ permission: 'queue.call' }, async ({ user, clinicId, req, ip }) => {
  const body = await parseBody(req, NextTicketSchema);
  const row = await callNext(clinicId, body.type, actorFrom(user, ip, req));
  const data: NextTicketResultDTO = { ticket: row ? toRowDTO(row) : null };
  return ok(data);
});
