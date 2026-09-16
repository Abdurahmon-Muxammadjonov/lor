import { SMS_PLACEHOLDERS, type SmsPlaceholder } from './schemas';

/**
 * SMS shablonlarini client tomonda koʻrsatish uchun sof yordamchilar.
 * `@/lib/integrations/eskiz` serverga bogʻliq (`@/lib/prisma`) boʻlgani uchun bu yerda
 * `renderTemplate` / `smsSegments` bilan bir xil mantiq takrorlanadi — parity testda tekshiriladi.
 */

export type SmsTemplateVars = { [key: string]: string | number | null | undefined };

/** Shablondagi `{kalit}` larni almashtiradi; nomaʼlum kalitlar oʻzgarishsiz qoladi */
export function renderSmsTemplate(template: string, vars: SmsTemplateVars): string {
  return template
    .replace(/\{(\w+)\}/g, (match, key: string) => {
      if (!(key in vars)) return match;
      const v = vars[key];
      return v === null || v === undefined ? '' : String(v);
    })
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ ([,.!?;:])/g, '$1')
    .trim();
}

export interface SmsCost {
  encoding: 'GSM-7' | 'UCS-2';
  length: number;
  segments: number;
}

/** SMS sarfini baholash: GSM-7 (lotin) — 160/153, aks holda (kirill) UCS-2 — 70/67 */
export function smsSegments(text: string): SmsCost {
  // eslint-disable-next-line no-control-regex
  const gsm = /^[\x00-\x7F€£¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉÄÖÑÜ§¿äöñüà]*$/;
  const isGsm = gsm.test(text);
  const length = text.length;
  if (length === 0) return { encoding: isGsm ? 'GSM-7' : 'UCS-2', length: 0, segments: 0 };
  const single = isGsm ? 160 : 70;
  const multi = isGsm ? 153 : 67;
  const segments = length <= single ? 1 : Math.ceil(length / multi);
  return { encoding: isGsm ? 'GSM-7' : 'UCS-2', length, segments };
}

/** Shablonda ishlatilgan oʻrin egallovchilar (legenda uchun) */
export function usedPlaceholders(template: string): SmsPlaceholder[] {
  return SMS_PLACEHOLDERS.filter((p) => template.includes(`{${p}}`));
}

export interface InsertResult {
  text: string;
  /** Yangi kursor holati (qoʻyilgan kalitdan keyin) */
  caret: number;
}

/**
 * Matnga `{kalit}` ni kursor oʻrniga qoʻyadi (belgilangan matn almashtiriladi).
 * Chegaradan chiqqan indekslar matn uzunligiga qisiladi.
 */
export function insertPlaceholder(text: string, key: SmsPlaceholder, start = text.length, end = start): InsertResult {
  const token = `{${key}}`;
  const from = Math.max(0, Math.min(start, text.length));
  const to = Math.max(from, Math.min(end, text.length));
  const next = text.slice(0, from) + token + text.slice(to);
  return { text: next, caret: from + token.length };
}
