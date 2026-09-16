import { SITE } from '@/data/landing-content';

/**
 * Ilovaning bazaviy manzili (protokol + domen, oxirida `/` siz).
 *
 * Muammо: `process.env.APP_URL` Vercel'da **boʻsh satr** boʻlishi mumkin (oʻzgaruvchi qoʻshilgan,
 * lekin qiymati kiritilmagan). `??` boʻsh satrni ushlamaydi, natijada `new URL('')` build vaqtida
 * `TypeError: Invalid URL` bilan qulaydi. Shu sababli barcha joyda faqat shu funksiya ishlatiladi:
 * boʻsh/notoʻgʻri qiymatlar tashlab yuboriladi va keyingi manbaga oʻtiladi.
 *
 * Tartib: APP_URL → NEXT_PUBLIC_APP_URL → NEXTAUTH_URL → VERCEL_PROJECT_PRODUCTION_URL →
 *         VERCEL_URL → SITE.url → http://localhost:3000
 */
export const LOCAL_URL = 'http://localhost:3000';

/** Qiymatni tekshiradi; yaroqli boʻlsa normallashtirilgan `https://domen` koʻrinishida qaytaradi. */
export function normalizeBaseUrl(value: string | undefined | null): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  // Boshqa protokol (ftp:, file: ...) — rad etiladi
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(raw)?.[1]?.toLowerCase();
  if (scheme && scheme !== 'http' && scheme !== 'https') return null;
  // Vercel VERCEL_URL ni protokolsiz beradi: "lor-abc123.vercel.app"
  const withProtocol = scheme ? raw : `https://${raw}`;
  try {
    const url = new URL(withProtocol);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname) return null;
    return `${url.protocol}//${url.host}`;
  } catch {
    return null;
  }
}

/** Bazaviy manzil (oxirida `/` yoʻq). Hech qachon xato tashlamaydi. */
export function getSiteUrl(): string {
  const candidates = [
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.NEXTAUTH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
    SITE.url,
  ];
  for (const candidate of candidates) {
    const normalized = normalizeBaseUrl(candidate);
    if (normalized) return normalized;
  }
  return LOCAL_URL;
}

/** `metadataBase` uchun — xato tashlamaydigan `URL`. */
export function getSiteUrlObject(): URL {
  try {
    return new URL(getSiteUrl());
  } catch {
    return new URL(LOCAL_URL);
  }
}

/** Bazaviy manzilga yoʻlni qoʻshadi: absoluteUrl('/login') → "https://lor.uz/login" */
export function absoluteUrl(path = '/'): string {
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${getSiteUrl()}${suffix}`;
}
