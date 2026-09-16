'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueueType } from '@prisma/client';
import { api, qs } from '@/lib/api/client';
import type { Locale } from '@/i18n/config';
import type { CreateTicketInput } from './schemas';
import type {
  CreatedTicketDTO,
  NextTicketResultDTO,
  QueueAction,
  QueueBoardDTO,
  QueueRowDTO,
  TicketWithDataDTO,
  VisitFromTicketResultDTO,
} from './types';

/** TanStack Query kalitlari (CONTRACTS §3): ['queue', dateKey] */
export const queueKeys = {
  all: ['queue'] as const,
  board: (dateKey: string) => ['queue', dateKey] as const,
  count: ['queue', 'count'] as const,
  ticket: (id: string) => ['queue', 'ticket', id] as const,
  doctors: ['users', { role: 'DOCTOR', active: 1 }] as const,
  patientSearch: (q: string) => ['patients', 'search', { q, limit: 10 }] as const,
};

export interface DoctorOptionDTO {
  id: string;
  fullName: string;
  role: string;
  specialty: string | null;
  room: string | null;
  color: string;
  isActive: boolean;
}

export interface PatientSearchItemDTO {
  id: string;
  fullName: string;
  cardNumber: string;
  phone: string;
  birthDate: string;
  gender: 'MALE' | 'FEMALE';
}

export function useQueueBoard(dateKey: string, opts: { initialData?: QueueBoardDTO; live?: boolean } = {}) {
  return useQuery({
    queryKey: queueKeys.board(dateKey),
    queryFn: () => api.get<QueueBoardDTO>(`/api/queue${qs({ date: dateKey })}`),
    initialData: opts.initialData,
    // Jonli oqim ishlayotganda polling shart emas; zaxira sifatida 30 s
    refetchInterval: opts.live ? 30_000 : 10_000,
    refetchIntervalInBackground: false,
    staleTime: 2_000,
    placeholderData: keepPreviousData,
  });
}

/** Taxta keshini bir joydan yangilash (SSE snapshot / mutatsiya natijasi) */
export function useQueueCache() {
  const qc = useQueryClient();
  return {
    setBoard: (board: QueueBoardDTO) => qc.setQueryData<QueueBoardDTO>(queueKeys.board(board.dateKey), board),
    invalidate: (dateKey?: string) =>
      qc.invalidateQueries({ queryKey: dateKey ? queueKeys.board(dateKey) : queueKeys.all }).then(() => qc.invalidateQueries({ queryKey: queueKeys.count })),
    /** Bitta qatorni ustunlar boʻylab almashtirish (optimistik) */
    patchRow: (dateKey: string, row: QueueRowDTO) =>
      qc.setQueryData<QueueBoardDTO>(queueKeys.board(dateKey), (prev) => {
        if (!prev) return prev;
        const strip = (rows: QueueRowDTO[]) => rows.filter((r) => r.id !== row.id);
        const next: QueueBoardDTO = {
          ...prev,
          waiting: strip(prev.waiting),
          called: strip(prev.called),
          serving: strip(prev.serving),
          done: strip(prev.done),
          skipped: strip(prev.skipped),
        };
        switch (row.status) {
          case 'WAITING':
            next.waiting = [...next.waiting, row].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
            break;
          case 'CALLED':
            next.called = [row, ...next.called];
            break;
          case 'SERVING':
            next.serving = [row, ...next.serving];
            break;
          case 'DONE':
            next.done = [row, ...next.done];
            break;
          case 'SKIPPED':
            next.skipped = [row, ...next.skipped];
            break;
        }
        return next;
      }),
  };
}

export function useCreateTicket() {
  const cache = useQueueCache();
  return useMutation({
    mutationFn: (input: CreateTicketInput & { locale?: Locale }) => api.post<CreatedTicketDTO>('/api/queue', input),
    onSuccess: () => void cache.invalidate(),
  });
}

export function useCallNext() {
  const cache = useQueueCache();
  return useMutation({
    mutationFn: (type: QueueType) => api.post<NextTicketResultDTO>('/api/queue/next', { type }),
    onSuccess: () => void cache.invalidate(),
  });
}

export interface TicketActionInput {
  id: string;
  action: QueueAction;
  requeue?: boolean;
}

export function useTicketAction() {
  const cache = useQueueCache();
  return useMutation({
    mutationFn: ({ id, action, requeue }: TicketActionInput) =>
      api.post<QueueRowDTO>(`/api/queue/${encodeURIComponent(id)}/${action}`, action === 'recall' ? { requeue: requeue ?? false } : undefined),
    onSuccess: () => void cache.invalidate(),
  });
}

export function usePrintTicketData() {
  return useMutation({
    mutationFn: ({ id, locale }: { id: string; locale: Locale }) => api.post<TicketWithDataDTO>(`/api/queue/${encodeURIComponent(id)}/print`, { locale }),
  });
}

export function useLinkPatient() {
  const cache = useQueueCache();
  return useMutation({
    mutationFn: ({ id, patientId }: { id: string; patientId: string }) => api.post<QueueRowDTO>(`/api/queue/${encodeURIComponent(id)}/patient`, { patientId }),
    onSuccess: () => void cache.invalidate(),
  });
}

export function useVisitFromTicket() {
  const cache = useQueueCache();
  return useMutation({
    mutationFn: ({ id, doctorId }: { id: string; doctorId?: string | null }) =>
      api.post<VisitFromTicketResultDTO>(`/api/queue/${encodeURIComponent(id)}/visit`, doctorId ? { doctorId } : {}),
    onSuccess: () => void cache.invalidate(),
  });
}

/** Faol shifokorlar (staff moduli). Xato boʻlsa — boʻsh roʻyxat */
export function useDoctorOptions(enabled = true) {
  return useQuery({
    queryKey: queueKeys.doctors,
    queryFn: async () => (await api.get<{ items: DoctorOptionDTO[] }>(`/api/users${qs({ role: 'DOCTOR', active: 1 })}`)).items,
    staleTime: 5 * 60_000,
    retry: 0,
    enabled,
  });
}

/** Bemor qidiruvi (patients moduli) */
export function usePatientSearch(q: string, enabled: boolean) {
  return useQuery({
    queryKey: queueKeys.patientSearch(q),
    queryFn: async () => (await api.get<{ items: PatientSearchItemDTO[] }>(`/api/patients/search${qs({ q, limit: 10 })}`)).items,
    enabled: enabled && q.trim().length >= 2,
    staleTime: 20_000,
    placeholderData: keepPreviousData,
    retry: 0,
  });
}
