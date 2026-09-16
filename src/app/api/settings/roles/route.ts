import { withAuth, ok } from '@/lib/api';
import { rolesMatrix } from '@/lib/settings/service';

export const dynamic = 'force-dynamic';

/** GET /api/settings/roles — PERMISSIONS × rollar matritsasi (faqat oʻqish) */
export const GET = withAuth({ permission: 'settings.view' }, async () => ok(rolesMatrix()));
