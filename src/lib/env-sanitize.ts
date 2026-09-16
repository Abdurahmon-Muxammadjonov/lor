/**
 * Boʻsh qiymatli muhit oʻzgaruvchilarini olib tashlaydi.
 *
 * Vercel (va boshqa hosting) panelida oʻzgaruvchini **qiymatsiz** qoʻshish mumkin — u kodga
 * `''` (boʻsh satr) boʻlib keladi. `??` va `?.` operatorlari boʻsh satrni ushlamaydi, shuning uchun
 * kutubxonalar uni haqiqiy qiymat deb qabul qiladi. Eng ogʻriqli misol — `next-auth/react`:
 * modul yuklanishida `parseUrl(process.env.NEXTAUTH_URL)` → `new URL('')` →
 * `TypeError: Invalid URL (input: '')`. Natijada `next build` butunlay toʻxtaydi:
 * `Failed to collect page data for /_not-found`.
 *
 * Yechim: ilova kodi yuklanishidan oldin boʻsh oʻzgaruvchilarni `delete` qilish — shunda ular
 * umuman berilmagan hisoblanadi va kutubxonalarning oʻz standart qiymatlari ishlaydi.
 */
export const URLISH_ENV_KEYS = [
  'NEXTAUTH_URL',
  'NEXTAUTH_URL_INTERNAL',
  'APP_URL',
  'NEXT_PUBLIC_APP_URL',
  'VERCEL_URL',
  'VERCEL_PROJECT_PRODUCTION_URL',
  'DATABASE_URL',
  'DIRECT_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'ESKIZ_BASE_URL',
  'PAYME_CHECKOUT_URL',
  'SMTP_HOST',
] as const;

/** Boʻsh (yoki faqat probeldan iborat) oʻzgaruvchilarni oʻchiradi; oʻchirilganlar roʻyxatini qaytaradi. */
export function sanitizeEnv(env: Record<string, string | undefined> = process.env, keys: readonly string[] = URLISH_ENV_KEYS): string[] {
  const removed: string[] = [];
  for (const key of keys) {
    const value = env[key];
    if (typeof value === 'string' && value.trim() === '') {
      delete env[key];
      removed.push(key);
    }
  }
  return removed;
}
