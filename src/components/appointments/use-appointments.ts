'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, qs } from '@/lib/api/client';
import type { AppointmentDTO, AppointmentListDTO, DoctorOption, SlotsDTO } from '@/lib/appointments/types';
import type { AppointmentStatusCode } from '@/lib/appointments/schemas';

export interface RangeParams {
  from: string;
  to: string;
  doctorId?: string | null;
}

export const appointmentKeys = {
  all: ['appointments'] as const,
  range: (p: RangeParams) =>
    ['appointments', 'range', { from: p.from, to: p.to, doctorId: p.doctorId ?? null }] as const,
  slots: (p: { doctorId: string; date: string; durationMin?: number; excludeId?: string }) =>
    ['appointments', 'slots', p.doctorId, p.date, p.durationMin ?? null, p.excludeId ?? null] as const,
};

export function useAppointmentsRange(p: RangeParams, enabled = true) {
  return useQuery({
    queryKey: appointmentKeys.range(p),
    queryFn: () =>
      api.get<AppointmentListDTO>(
        `/api/appointments${qs({ from: p.from, to: p.to, doctorId: p.doctorId ?? undefined })}`,
      ),
    placeholderData: keepPreviousData,
    enabled,
    refetchInterval: 60_000,
  });
}

export function useFreeSlots(
  p: { doctorId: string; date: string; durationMin?: number; excludeId?: string },
  enabled: boolean,
) {
  return useQuery({
    queryKey: appointmentKeys.slots(p),
    queryFn: () =>
      api.get<SlotsDTO>(
        `/api/appointments/slots${qs({ doctorId: p.doctorId, date: p.date, durationMin: p.durationMin, excludeId: p.excludeId })}`,
      ),
    enabled,
    staleTime: 10_000,
  });
}

export interface MoveInput {
  id: string;
  startAt: string;
  doctorId: string;
}

type MoveContext = { previous?: AppointmentListDTO };

/** Sudrab koʻchirish: optimistik yangilash, xatoda (409 va h.k.) qaytarish */
export function useMoveAppointment(
  rangeKey: ReturnType<typeof appointmentKeys.range>,
  doctors: DoctorOption[],
) {
  const qc = useQueryClient();
  return useMutation<AppointmentDTO, Error, MoveInput, MoveContext>({
    mutationFn: ({ id, startAt, doctorId }) =>
      api.patch<AppointmentDTO>(`/api/appointments/${id}`, { startAt, doctorId }),
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: rangeKey });
      const previous = qc.getQueryData<AppointmentListDTO>(rangeKey);
      if (previous) {
        const doctor = doctors.find((d) => d.id === input.doctorId);
        qc.setQueryData<AppointmentListDTO>(rangeKey, {
          ...previous,
          items: previous.items.map((a) => {
            if (a.id !== input.id) return a;
            const duration = new Date(a.endAt).getTime() - new Date(a.startAt).getTime();
            const start = new Date(input.startAt);
            return {
              ...a,
              startAt: start.toISOString(),
              endAt: new Date(start.getTime() + duration).toISOString(),
              doctorId: input.doctorId,
              doctor: doctor
                ? {
                    id: doctor.id,
                    fullName: doctor.fullName,
                    room: doctor.room,
                    color: doctor.color,
                    specialty: doctor.specialty,
                  }
                : a.doctor,
            };
          }),
        });
      }
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous) qc.setQueryData(rangeKey, ctx.previous);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: appointmentKeys.all });
    },
  });
}

export function useSetStatus() {
  const qc = useQueryClient();
  return useMutation<AppointmentDTO, Error, { id: string; status: AppointmentStatusCode }>({
    mutationFn: ({ id, status }) => api.post<AppointmentDTO>(`/api/appointments/${id}/status`, { status }),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: appointmentKeys.all });
    },
  });
}

export function useDeleteAppointment() {
  const qc = useQueryClient();
  return useMutation<{ id: string; deleted: boolean }, Error, { id: string }>({
    mutationFn: ({ id }) => api.delete<{ id: string; deleted: boolean }>(`/api/appointments/${id}`),
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: appointmentKeys.all });
    },
  });
}
