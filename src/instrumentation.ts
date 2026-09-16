/**
 * Next.js instrumentation — server ishga tushganda, ilovaning boshqa modullaridan oldin bajariladi.
 * Boʻsh muhit oʻzgaruvchilarini tozalaydi (`next.config.mjs` da build vaqti uchun shu ish bajariladi).
 */
export async function register(): Promise<void> {
  const { sanitizeEnv } = await import('@/lib/env-sanitize');
  const removed = sanitizeEnv();
  if (removed.length > 0) {
    console.warn(`[env] boʻsh qiymatli oʻzgaruvchilar eʼtiborsiz qoldirildi: ${removed.join(', ')}`);
  }
}
