/**
 * Sessiya cookie'sining nomi va `secure` bayrogʻi.
 *
 * `authOptions` (Node runtime) va `middleware` (Edge runtime) AYNAN bir xil nomdan
 * foydalanishi shart: aks holda NextAuth bir nom bilan yozadi, `getToken()` esa
 * boshqasini qidiradi va har bir soʻrov 401 boʻladi.
 *
 * Qoida NextAuth'ning oʻz standarti bilan bir xil — `NEXTAUTH_URL` https boʻlsa
 * `__Secure-` prefiksi (biz bekor qilmaydigan csrf/callback cookie'lari ham shunday
 * hisoblanadi, shuning uchun hammasi bir xil qoladi).
 *
 * Bu fayl faqat `process.env` ni oʻqiydi — Edge runtime'da import qilish xavfsiz.
 */

/** HTTPS deployment'mi? → `__Secure-` prefiksi va `secure: true`. */
export function secureAuthCookies(): boolean {
  const url = process.env.NEXTAUTH_URL?.trim();
  if (url) return url.startsWith('https://');
  return Boolean(process.env.VERCEL);
}

/** NextAuth sessiya JWT cookie'sining nomi. */
export function sessionCookieName(): string {
  return secureAuthCookies() ? '__Secure-next-auth.session-token' : 'next-auth.session-token';
}
