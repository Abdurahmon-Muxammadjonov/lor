'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiClientError } from '@/lib/api/client';
import type { TFunction } from '@/i18n/t';
import type { PatientPayload } from '@/lib/patients/schemas';
import {
  createPatient,
  deletePatient,
  enqueuePatient,
  fetchActiveDoctors,
  fetchPatient,
  fetchPatientAppointments,
  fetchPatientPayments,
  fetchPatientVisits,
  fetchPatients,
  patientKeys,
  startVisit,
  updatePatient,
} from '@/lib/patients/queries';
import { isDuplicatePhoneDetails, type PatientListParams, type PatientRowDTO } from '@/lib/patients/types';

/**
 * Bemorlar moduli uchun TanStack Query hooklari. Kalitlar `patientKeys` (CONTRACTS §3).
 * Mutatsiyalardan soʻng roʻyxat va karta keshi bekor qilinadi.
 */

/** API xatosini foydalanuvchiga tushunarli matnga keltiradi */
export function patientErrorMessage(err: unknown, t: TFunction): string {
  if (err instanceof ApiClientError) {
    if (err.code === 'CONFLICT' && isDuplicatePhoneDetails(err.details)) return t('patients.errors.conflict');
    if (
      err.code === 'CONFLICT' &&
      err.details &&
      typeof err.details === 'object' &&
      'visits' in err.details
    ) {
      return t('patients.errors.hasVisits');
    }
    if (err.code === 'NOT_FOUND') return t('patients.errors.notFound');
    if (err.code === 'FORBIDDEN') return t('patients.errors.forbidden');
    if (err.code === 'UNAUTHORIZED') return t('common.denied.title');
    if (err.code.startsWith('HTTP_')) return t('common.offline.title');
    return err.message || t('common.error');
  }
  if (err instanceof Error && err.message) return err.message;
  return t('common.error');
}

export function isNotFoundError(err: unknown): boolean {
  return err instanceof ApiClientError && err.status === 404;
}

export function usePatientList(params: PatientListParams) {
  return useQuery({
    queryKey: patientKeys.list(params),
    queryFn: () => fetchPatients(params),
    placeholderData: keepPreviousData,
  });
}

export function usePatient(id: string) {
  return useQuery({
    queryKey: patientKeys.detail(id),
    queryFn: () => fetchPatient(id),
    retry: (count, err) => !isNotFoundError(err) && count < 1,
  });
}

export function usePatientVisits(id: string, page: number, pageSize: number, enabled = true) {
  return useQuery({
    queryKey: patientKeys.visits(id, page, pageSize),
    queryFn: () => fetchPatientVisits(id, page, pageSize),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function usePatientPayments(id: string, enabled = true) {
  return useQuery({ queryKey: patientKeys.payments(id), queryFn: () => fetchPatientPayments(id), enabled });
}

export function usePatientAppointments(id: string, enabled = true) {
  return useQuery({
    queryKey: patientKeys.appointments(id),
    queryFn: () => fetchPatientAppointments(id),
    enabled,
  });
}

/** Faol shifokorlar (staff moduli). 5 daqiqa kesh — dialoglarda qayta-qayta soʻralmaydi */
export function useActiveDoctors(enabled = true) {
  return useQuery({
    queryKey: patientKeys.doctors,
    queryFn: async () => (await fetchActiveDoctors()).items.filter((d) => d.isActive !== false),
    staleTime: 5 * 60_000,
    enabled,
  });
}

export function useCreatePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PatientPayload) => createPatient(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: patientKeys.all });
    },
  });
}

export function useUpdatePatient(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<PatientPayload>) => updatePatient(id, body),
    onSuccess: (row: PatientRowDTO) => {
      void qc.invalidateQueries({ queryKey: patientKeys.all });
      void qc.invalidateQueries({ queryKey: patientKeys.detail(row.id) });
    },
  });
}

export function useDeletePatient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deletePatient(id),
    onSuccess: (_res, id) => {
      void qc.invalidateQueries({ queryKey: patientKeys.all });
      // Karta sahifasi hali ochiq — qayta soʻrov (404) qilmasdan eskirgan deb belgilaymiz
      void qc.invalidateQueries({ queryKey: patientKeys.detail(id), refetchType: 'none' });
    },
  });
}

/** POST /api/visits — visits moduli */
export function useStartVisitMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ patientId, doctorId }: { patientId: string; doctorId: string }) =>
      startVisit(patientId, doctorId),
    onSuccess: (_visit, vars) => {
      void qc.invalidateQueries({ queryKey: patientKeys.detail(vars.patientId) });
      void qc.invalidateQueries({ queryKey: patientKeys.all });
    },
  });
}

/** POST /api/queue — queue moduli */
export function useEnqueueMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ patientId, doctorId }: { patientId: string; doctorId?: string }) =>
      enqueuePatient(patientId, doctorId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['queue'] });
    },
  });
}
