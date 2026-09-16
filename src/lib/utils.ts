import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Oʻzbek lotin apostrofini (U+02BB) bir xil koʻrinishga keltiradi: o' → oʻ, g' → gʻ */
export function normalizeUzApostrophe(s: string): string {
  return s.replace(/([oOgG])['’`‘]/g, '$1ʻ');
}

/** Qidiruv uchun: kichik harf, apostroflarni olib tashlash, ortiqcha boʻshliqlar */
export function normalizeSearch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ʻ'’`‘]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** +998 XX XXX XX XX koʻrinishiga keltiradi (saqlash uchun faqat raqamlar) */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 9) return `+998${digits}`;
  if (digits.length === 12 && digits.startsWith('998')) return `+${digits}`;
  if (digits.length === 13 && digits.startsWith('8998')) return `+${digits.slice(1)}`;
  return raw.startsWith('+') ? `+${digits}` : digits ? `+${digits}` : '';
}

export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const d = phone.replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('998')) {
    return `+998 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10, 12)}`;
  }
  return phone;
}

export function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${String(x)}`);
}
