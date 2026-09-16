import { NextRequest } from 'next/server';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export const TEST_ORIGIN = 'http://localhost:3000';

/** Middleware talab qiladigan CSRF sarlavhasi (api client avtomatik qoʻyadi) */
export const REQUESTED_WITH = { 'X-Requested-With': 'lor-crm' } as const;

/**
 * Route handler uchun NextRequest. Nisbiy URL (`/api/...`) TEST_ORIGIN ga qoʻshiladi.
 * `body` obyekt boʻlsa JSON ga aylantiriladi, string boʻlsa oʻzi yuboriladi.
 */
export function makeRequest(
  method: HttpMethod,
  url: string,
  body?: unknown,
  headers: Record<string, string> = {},
): NextRequest {
  const absolute = /^https?:\/\//.test(url) ? url : `${TEST_ORIGIN}${url.startsWith('/') ? url : `/${url}`}`;
  const h = new Headers({ ...REQUESTED_WITH, ...headers });
  let payload: string | undefined;
  if (body !== undefined && method !== 'GET') {
    if (typeof body === 'string') {
      payload = body;
      if (!h.has('content-type')) h.set('content-type', 'application/json');
    } else {
      payload = JSON.stringify(body);
      h.set('content-type', 'application/json');
    }
  }
  return new NextRequest(absolute, { method, headers: h, body: payload });
}

/** API javobi shakli (src/lib/api/respond.ts bilan bir xil) */
export type ApiJson<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; details?: unknown } };

/** Response → JSON (tip bilan) */
export async function readJson<T = unknown>(res: Response): Promise<ApiJson<T>> {
  return (await res.json()) as ApiJson<T>;
}

/** `ok: true` boʻlishini tekshirib `data` ni qaytaradi, aks holda xato otadi */
export async function readData<T = unknown>(res: Response): Promise<T> {
  const json = await readJson<T>(res);
  if (!json.ok) throw new Error(`API xato ${res.status}: ${json.error.code} — ${json.error.message}`);
  return json.data;
}

/** `ok: false` boʻlishini tekshirib xato kodini qaytaradi */
export async function readError(res: Response): Promise<{ status: number; code: string; message: string; details?: unknown }> {
  const json = await readJson(res);
  if (json.ok) throw new Error(`Xato kutilgan edi, lekin ok=true keldi (status ${res.status})`);
  return { status: res.status, ...json.error };
}
