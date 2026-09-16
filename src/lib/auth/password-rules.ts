/**
 * Parol qoidalari — bcrypt'siz, client va server uchun umumiy (zod sxemalarda ishlatiladi).
 */
export const PASSWORD_MIN_LENGTH = 8;

/** Kamida 8 belgi, harf + raqam */
export function isStrongPassword(p: string): boolean {
  return p.length >= PASSWORD_MIN_LENGTH && /[A-Za-z]/.test(p) && /\d/.test(p);
}
