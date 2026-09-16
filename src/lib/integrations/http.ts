/**
 * Tashqi API lar uchun kichik fetch yordamchilari: vaqt chegarasi (AbortController), JSON oʻqish.
 * Global `fetch` (Node 18+ / Edge) ishlatiladi; testlarda `fetchImpl` orqali almashtiriladi.
 */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export const DEFAULT_HTTP_TIMEOUT_MS = 10_000;

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_HTTP_TIMEOUT_MS,
  fetchImpl: FetchLike = (u, i) => fetch(u, i),
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Javob tanasini JSON sifatida oʻqish; boʻsh/notoʻgʻri boʻlsa null */
export async function readJsonSafe(res: Response): Promise<unknown> {
  try {
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

export function readString(obj: unknown, key: string): string | undefined {
  if (!isRecord(obj)) return undefined;
  const v = obj[key];
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : undefined;
}

export function readNumber(obj: unknown, key: string): number | undefined {
  if (!isRecord(obj)) return undefined;
  const v = obj[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}

/** Klinika vaqt zonasida sana/vaqt (server TZ dan mustaqil) */
export function formatDateInTz(d: Date, timeZone = 'Asia/Tashkent'): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, day: '2-digit', month: '2-digit', year: 'numeric' }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return `${get('day')}.${get('month')}.${get('year')}`;
}

export function formatTimeInTz(d: Date, timeZone = 'Asia/Tashkent'): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const h = get('hour') === '24' ? '00' : get('hour');
  return `${h}:${get('minute')}`;
}

/** Joriy soat (0–23) berilgan vaqt zonasida */
export function hourInTz(d: Date, timeZone = 'Asia/Tashkent'): number {
  const h = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hour12: false }).format(d);
  const n = Number(h);
  return n === 24 ? 0 : n;
}

/** "YYYY-MM-DD" berilgan vaqt zonasida */
export function dateKeyInTz(d: Date, timeZone = 'Asia/Tashkent'): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
