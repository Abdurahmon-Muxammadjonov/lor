import { withAuth, ok, parseBody } from '@/lib/api';
import { BulkSchema } from '@/lib/services/schemas';
import { bulkUpdateServices } from '@/lib/services/service';

export const dynamic = 'force-dynamic';

/**
 * POST /api/services/bulk → { preview, total, updated, rows }
 * preview=true — faqat hisoblangan yangi narxlar (DB oʻzgarmaydi); aks holda tranzaksiyada saqlanadi,
 * har bir xizmat uchun PRICE_CHANGE auditi.
 */
export const POST = withAuth({ permission: 'services.write' }, async ({ req, clinicId, user, ip }) => {
  const body = await parseBody(req, BulkSchema);
  const result = await bulkUpdateServices(
    { clinicId, userId: user.id, ip, userAgent: req.headers.get('user-agent') },
    body,
  );
  return ok(result);
});
