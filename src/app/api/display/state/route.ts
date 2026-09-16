import { withPublic, ok } from '@/lib/api';
import { getDisplayState } from '@/lib/queue/service';
import { clinicFromKey } from '../_lib';

export const dynamic = 'force-dynamic';

/** GET /api/display/state?key= — tablo holati: oxirgi 5 chaqiruv, kutayotganlar, vaqt */
export const GET = withPublic(async ({ req }) => {
  const clinic = await clinicFromKey(req);
  return ok(await getDisplayState(clinic), { headers: { 'Cache-Control': 'no-store' } });
});
