'use client';

import type { ApiResponse } from './respond';

/**
 * Brauzer tomonidagi API mijozi. { ok, data } ni ochadi, xato boʻlsa ApiClientError tashlaydi.
 * Barcha soʻrovlar `X-Requested-With` sarlavhasini yuboradi (CSRF himoyasi, middleware tekshiradi).
 */
export class ApiClientError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function request<T>(method: string, url: string, body?: unknown, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    method,
    credentials: 'same-origin',
    headers: {
      Accept: 'application/json',
      'X-Requested-With': 'lor-crm',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let json: ApiResponse<T> | null = null;
  try {
    json = (await res.json()) as ApiResponse<T>;
  } catch {
    json = null;
  }
  if (!res.ok || !json || !json.ok) {
    const err = json && !json.ok ? json.error : { code: 'HTTP_' + res.status, message: res.statusText || 'Xatolik' };
    throw new ApiClientError(res.status, err.code, err.message, err.details);
  }
  return json.data;
}

export const api = {
  get: <T>(url: string, init?: RequestInit) => request<T>('GET', url, undefined, init),
  post: <T>(url: string, body?: unknown, init?: RequestInit) => request<T>('POST', url, body, init),
  put: <T>(url: string, body?: unknown, init?: RequestInit) => request<T>('PUT', url, body, init),
  patch: <T>(url: string, body?: unknown, init?: RequestInit) => request<T>('PATCH', url, body, init),
  delete: <T>(url: string, init?: RequestInit) => request<T>('DELETE', url, undefined, init),
};

export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}
