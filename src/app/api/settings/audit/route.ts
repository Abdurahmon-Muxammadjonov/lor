import { withAuth, ok, parseQuery } from '@/lib/api';
import { AuditQuerySchema } from '@/lib/settings/schemas';
import { listAudit } from '@/lib/settings/service';

export const dynamic = 'force-dynamic';

/** GET /api/settings/audit?page=&pageSize=&entity=&entityId=&userId=&action=&from=&to= (audit.view) */
export const GET = withAuth({ permission: 'audit.view' }, async ({ clinicId, req }) => {
  const q = parseQuery(req, AuditQuerySchema);
  return ok(await listAudit(clinicId, q));
});
