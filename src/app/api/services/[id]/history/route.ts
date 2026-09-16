import { withAuth, ok, parseQuery } from '@/lib/api';
import { HistoryQuerySchema } from '@/lib/services/schemas';
import { getServiceHistory } from '@/lib/services/service';

export const dynamic = 'force-dynamic';

/** GET /api/services/[id]/history?limit= → { items: ServiceHistoryItemDTO[] } (AuditLog: PRICE_CHANGE/CREATE/UPDATE) */
export const GET = withAuth<{ id: string }>({ permission: 'services.view' }, async ({ req, params, clinicId }) => {
  const { limit } = parseQuery(req, HistoryQuerySchema);
  const items = await getServiceHistory(clinicId, params.id, limit);
  return ok({ items });
});
