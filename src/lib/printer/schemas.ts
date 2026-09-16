import { z } from 'zod';

/** Xom ESC/POS baytlar (base64) — `POST /api/print/raw` tanasi (route [queue] modulida). ~1 MB chegara. */
export const PrintRawBodySchema = z.object({
  bytesBase64: z
    .string()
    .min(1)
    .max(1_400_000)
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, 'base64'),
});
export type PrintRawBody = z.infer<typeof PrintRawBodySchema>;
