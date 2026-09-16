import { api, qs } from '@/lib/api/client';
import type { PatientPayload, PatientListQueryInput } from './schemas';
import type {
  PatientListParams,
  CreatedQueueDTO,
  CreatedVisitDTO,
  DoctorOptionDTO,
  PatientAppointmentsResponse,
  PatientDTO,
  PatientListResponse,
  PatientPaymentsResponse,
  PatientRowDTO,
  PatientSearchResponse,
  PatientVisitsResponse,
} from './types';

/**
 * TanStack Query kalitlari va fetcherlar (faqat client). Kalitlar CONTRACTS §3 ga mos:
 * ['patients', params], ['patient', id] …
 */

export type { PatientListParams } from './types';

export const patientKeys = {
  all: ['patients'] as const,
  list: (params: PatientListParams) => ['patients', params] as const,
  search: (q: string, limit: number) => ['patients', 'search', q, limit] as const,
  detail: (id: string) => ['patient', id] as const,
  visits: (id: string, page: number, pageSize: number) => ['patient', id, 'visits', page, pageSize] as const,
  payments: (id: string) => ['patient', id, 'payments'] as const,
  appointments: (id: string) => ['patient', id, 'appointments'] as const,
  doctors: ['users', 'doctors', 'active'] as const,
};

export function listQueryString(params: PatientListParams): string {
  const query: PatientListQueryInput = {
    q: params.q || undefined,
    page: params.page,
    pageSize: params.pageSize,
    sort: params.sort,
    dir: params.dir,
    gender: params.gender,
    type: params.type,
    hasDebt: params.hasDebt ? '1' : undefined,
  };
  return qs({
    q: query.q,
    page: query.page,
    pageSize: query.pageSize,
    sort: query.sort,
    dir: query.dir,
    gender: query.gender,
    type: query.type,
    hasDebt: query.hasDebt,
  });
}

export const fetchPatients = (params: PatientListParams) =>
  api.get<PatientListResponse>(`/api/patients${listQueryString(params)}`);

export const searchPatients = (q: string, limit = 8) =>
  api.get<PatientSearchResponse>(`/api/patients/search${qs({ q, limit })}`);

export const fetchPatient = (id: string) => api.get<PatientDTO>(`/api/patients/${encodeURIComponent(id)}`);

export const createPatient = (body: PatientPayload) => api.post<PatientRowDTO>('/api/patients', body);

export const updatePatient = (id: string, body: Partial<PatientPayload>) =>
  api.patch<PatientRowDTO>(`/api/patients/${encodeURIComponent(id)}`, body);

export const deletePatient = (id: string) =>
  api.delete<{ id: string }>(`/api/patients/${encodeURIComponent(id)}`);

export const fetchPatientVisits = (id: string, page: number, pageSize: number) =>
  api.get<PatientVisitsResponse>(`/api/patients/${encodeURIComponent(id)}/visits${qs({ page, pageSize })}`);

export const fetchPatientPayments = (id: string) =>
  api.get<PatientPaymentsResponse>(`/api/patients/${encodeURIComponent(id)}/payments`);

export const fetchPatientAppointments = (id: string) =>
  api.get<PatientAppointmentsResponse>(`/api/patients/${encodeURIComponent(id)}/appointments`);

/** Staff moduli: GET /api/users?role=DOCTOR&active=1 */
export const fetchActiveDoctors = () =>
  api.get<{ items: DoctorOptionDTO[] }>('/api/users?role=DOCTOR&active=1');

/** Visits moduli: POST /api/visits */
export const startVisit = (patientId: string, doctorId: string) =>
  api.post<CreatedVisitDTO>('/api/visits', { patientId, doctorId });

/** Queue moduli: POST /api/queue */
export const enqueuePatient = (patientId: string, doctorId?: string) =>
  api.post<CreatedQueueDTO>('/api/queue', { type: 'DOCTOR', patientId, ...(doctorId ? { doctorId } : {}) });

/** CSV eksport — brauzer orqali yuklab olish (fetch + blob; api client JSON kutadi) */
export async function downloadPatientsCsv(
  params: Omit<PatientListParams, 'page' | 'pageSize'>,
): Promise<void> {
  const res = await fetch(`/api/patients/export${listQueryString({ ...params, page: 1, pageSize: 1 })}`, {
    credentials: 'same-origin',
    headers: { 'X-Requested-With': 'lor-crm' },
  });
  if (!res.ok) {
    let message = res.statusText || 'Xatolik';
    try {
      const json = (await res.json()) as { ok: false; error: { message: string } };
      message = json.error.message;
    } catch {
      // JSON boʻlmasa — statusText
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') ?? '';
  const match = /filename="([^"]+)"/.exec(disposition);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = match?.[1] ?? 'patients.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
