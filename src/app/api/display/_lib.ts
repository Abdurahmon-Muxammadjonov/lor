import type { NextRequest } from 'next/server';
import { parseQuery } from '@/lib/api/validate';
import { DisplayQuerySchema } from '@/lib/queue/schemas';
import { requireClinicByKioskKey, type QueueClinic } from '@/lib/queue/service';

/** ?key=<kioskKey> → klinika (404 boʻlmasa) */
export async function clinicFromKey(req: NextRequest): Promise<QueueClinic> {
  const { key } = parseQuery(req, DisplayQuerySchema);
  return requireClinicByKioskKey(key);
}
