'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, qs } from '@/lib/api/client';
import type {
  DashboardStatsDTO,
  DoctorOptionDTO,
  MeClinicDTO,
  MeDTO,
  PatientSearchItemDTO,
  QueueCountDTO,
  StatsRange,
  TodaySummaryDTO,
  UpdateMeResultDTO,
} from '@/lib/dashboard/types';
import type { UpdateMeInput } from '@/lib/dashboard/schemas';

/** TanStack Query kalitlari (CONTRACTS §3 uslubida) */
export const dashboardKeys = {
  stats: (range: StatsRange, doctorId: string | null) => ['stats', range, doctorId ?? 'all'] as const,
  queueCount: ['queue', 'count'] as const,
  today: ['dashboard', 'today'] as const,
  me: ['me'] as const,
  clinic: ['me', 'clinic'] as const,
  doctors: ['users', { role: 'DOCTOR', active: 1 }] as const,
  patientSearch: (q: string) => ['patients', 'search', q] as const,
};

export const QUEUE_POLL_MS = 15_000;

export function useDashboardStats(range: StatsRange, doctorId: string | null) {
  return useQuery({
    queryKey: dashboardKeys.stats(range, doctorId),
    queryFn: () => api.get<DashboardStatsDTO>(`/api/dashboard/stats${qs({ range, doctorId })}`),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

/** Navbatda kutayotganlar — 15 s polling (topbar va bosh sahifa bir kalitni boʻlishadi) */
export function useQueueCount(enabled = true) {
  return useQuery({
    queryKey: dashboardKeys.queueCount,
    queryFn: () => api.get<QueueCountDTO>('/api/dashboard/queue-count'),
    refetchInterval: QUEUE_POLL_MS,
    refetchIntervalInBackground: false,
    staleTime: QUEUE_POLL_MS - 1000,
    enabled,
  });
}

export function useTodaySummary(enabled = true) {
  return useQuery({
    queryKey: dashboardKeys.today,
    queryFn: () => api.get<TodaySummaryDTO>('/api/dashboard/today'),
    staleTime: 30_000,
    refetchInterval: 60_000,
    enabled,
  });
}

export function useMe() {
  return useQuery({
    queryKey: dashboardKeys.me,
    queryFn: () => api.get<MeDTO>('/api/me'),
    staleTime: 5 * 60_000,
  });
}

export function useClinicInfo(initialData?: MeClinicDTO) {
  return useQuery({
    queryKey: dashboardKeys.clinic,
    queryFn: () => api.get<MeClinicDTO>('/api/me/clinic'),
    staleTime: 5 * 60_000,
    initialData,
  });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateMeInput) => api.patch<UpdateMeResultDTO>('/api/me', input),
    onSuccess: (data) => {
      qc.setQueryData<MeDTO>(dashboardKeys.me, (prev) => (prev ? { ...prev, user: data.user } : prev));
      void qc.invalidateQueries({ queryKey: dashboardKeys.me });
    },
  });
}

/** Shifokorlar (staff moduli). Xato boʻlsa — boʻsh roʻyxat, filtr faqat "Barchasi" boʻlib qoladi. */
export function useDoctorOptions(enabled: boolean) {
  return useQuery({
    queryKey: dashboardKeys.doctors,
    queryFn: async () => {
      const r = await api.get<{ items: DoctorOptionDTO[] }>(`/api/users${qs({ role: 'DOCTOR', active: 1 })}`);
      return r.items;
    },
    staleTime: 5 * 60_000,
    retry: 0,
    enabled,
  });
}

/** Bemor qidiruvi (patients moduli) — buyruqlar paneli */
export function usePatientSearch(q: string, enabled: boolean) {
  return useQuery({
    queryKey: dashboardKeys.patientSearch(q),
    queryFn: async () => {
      const r = await api.get<{ items: PatientSearchItemDTO[] }>(`/api/patients/search${qs({ q, limit: 8 })}`);
      return r.items;
    },
    enabled: enabled && q.trim().length >= 2,
    staleTime: 20_000,
    placeholderData: keepPreviousData,
    retry: 0,
  });
}
