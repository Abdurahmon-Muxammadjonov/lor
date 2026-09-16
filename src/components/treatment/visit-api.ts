'use client';

import { api, qs, ApiClientError } from '@/lib/api/client';
import type { Icd10Response, VisitDetailDTO, VisitListResponse } from '@/lib/visits/dto';
import type {
  AddLineInput,
  CreateVisitInput,
  GlobalDiscountInput,
  ListVisitsQuery,
  UpdateLineInput,
  UpdateVisitInput,
} from '@/lib/visits/schemas';

/** TanStack Query kalitlari */
export const visitKey = (id: string) => ['visit', id] as const;
export const visitsKey = (params: Partial<ListVisitsQuery>) => ['visits', params] as const;
export const icd10Key = (q: string) => ['icd10', q] as const;

export const visitApi = {
  get: (id: string) => api.get<VisitDetailDTO>(`/api/visits/${id}`),
  list: (params: Partial<ListVisitsQuery>) => api.get<VisitListResponse>(`/api/visits${qs(params)}`),
  create: (input: CreateVisitInput) => api.post<VisitDetailDTO>('/api/visits', input),
  update: (id: string, input: UpdateVisitInput) => api.patch<VisitDetailDTO>(`/api/visits/${id}`, input),
  addLine: (id: string, input: AddLineInput) => api.post<VisitDetailDTO>(`/api/visits/${id}/lines`, input),
  updateLine: (id: string, lineId: string, input: UpdateLineInput) =>
    api.patch<VisitDetailDTO>(`/api/visits/${id}/lines/${lineId}`, input),
  deleteLine: (id: string, lineId: string) => api.delete<VisitDetailDTO>(`/api/visits/${id}/lines/${lineId}`),
  setDiscount: (id: string, input: GlobalDiscountInput) =>
    api.patch<VisitDetailDTO>(`/api/visits/${id}/discount`, input),
  complete: (id: string) => api.post<VisitDetailDTO>(`/api/visits/${id}/complete`),
  cancel: (id: string) => api.post<VisitDetailDTO>(`/api/visits/${id}/cancel`),
  icd10: (q: string, limit = 20) => api.get<Icd10Response>(`/api/icd10${qs({ q, limit })}`),
};

/** `visits.errors.*` da mavjud kodlar */
const KNOWN_ERROR_KEYS = new Set([
  'INVALID_QUANTITY',
  'HALF_NOT_ALLOWED',
  'INVALID_DISCOUNT',
  'MEDICINE_REQUIRED',
  'NEGATIVE_PRICE',
  'INVALID_MONEY',
  'VISIT_CLOSED',
  'NOT_FOUND',
  'FORBIDDEN',
  'UNAUTHORIZED',
  'CONFLICT',
  'VALIDATION',
  'NO_LINES',
  'HAS_PAYMENTS',
  'QUEUE_LINKED',
  'APPOINTMENT_LINKED',
  'APPOINTMENT_CANCELLED',
  'SERVICE_INACTIVE',
  'NO_SERVICE',
  'NETWORK',
]);

/**
 * API xatosini `visits.errors.<KOD>` kalitiga keltiradi (CONFLICT uchun `details.reason` aniqroq kod beradi).
 * Tarjima boʻlmasa `t()` kalitni qaytaradi — shuning uchun `fallback` (server xabari) ham qaytariladi.
 */
export function visitErrorKey(err: unknown): { key: string; fallback: string } {
  if (err instanceof ApiClientError) {
    const reason =
      err.details && typeof err.details === 'object' && 'reason' in err.details
        ? String((err.details as { reason?: unknown }).reason ?? '')
        : '';
    const code =
      reason && KNOWN_ERROR_KEYS.has(reason) ? reason : KNOWN_ERROR_KEYS.has(err.code) ? err.code : 'default';
    return { key: `visits.errors.${code}`, fallback: err.message };
  }
  if (err instanceof TypeError) return { key: 'visits.errors.NETWORK', fallback: err.message };
  return { key: 'visits.errors.default', fallback: err instanceof Error ? err.message : String(err) };
}

/** `t` bilan tarjima qilingan xabar (kalit topilmasa server xabari) */
export function visitErrorMessage(err: unknown, t: (key: string) => string): string {
  const { key, fallback } = visitErrorKey(err);
  const msg = t(key);
  return msg === key ? fallback : msg;
}
