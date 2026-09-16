/**
 * Telefon maskasi: +998 XX XXX XX XX (Oʻzbekiston). Kiritish jarayonida qadam-baqadam formatlaydi.
 * Saqlash uchun `normalizePhone` (src/lib/utils.ts) ishlatiladi — bu yerda faqat koʻrinish.
 */

export const UZ_COUNTRY_CODE = '998';
export const PHONE_MASK_PLACEHOLDER = '+998 __ ___ __ __';

/**
 * Faqat milliy qism (9 raqam). "+998" prefiksi har doim olib tashlanadi; prefiks belgisi boʻlmasa,
 * 998 faqat toʻliq xalqaro raqamda (12+ raqam) mamlakat kodi deb hisoblanadi — "99..." bilan
 * boshlanadigan milliy raqamlarni yozishga xalaqit bermaydi.
 */
export function nationalDigits(raw: string): string {
  let s = raw.trim();
  if (s.startsWith(`+${UZ_COUNTRY_CODE}`)) s = s.slice(4);
  let d = s.replace(/\D/g, '');
  if (d.length >= 13 && d.startsWith(`8${UZ_COUNTRY_CODE}`)) d = d.slice(4);
  else if (d.length >= 12 && d.startsWith(UZ_COUNTRY_CODE)) d = d.slice(3);
  return d.slice(0, 9);
}

/** "901234567" → "+998 90 123 45 67"; qisman: "9012" → "+998 90 12" */
export function formatPhoneMask(raw: string): string {
  const d = nationalDigits(raw);
  if (!d) return '';
  const groups = [d.slice(0, 2), d.slice(2, 5), d.slice(5, 7), d.slice(7, 9)].filter(Boolean);
  return `+${UZ_COUNTRY_CODE} ${groups.join(' ')}`;
}

/** Maska toʻliq toʻldirilganmi (9 ta milliy raqam) */
export function isCompletePhoneMask(raw: string): boolean {
  return nationalDigits(raw).length === 9;
}

/** Saqlash/yuborish uchun: "+998901234567" (toʻliq boʻlmasa — boʻsh satr) */
export function maskToE164(raw: string): string {
  const d = nationalDigits(raw);
  return d.length === 9 ? `+${UZ_COUNTRY_CODE}${d}` : '';
}
