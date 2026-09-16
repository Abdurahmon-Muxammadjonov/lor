'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, qs } from '@/lib/api/client';
import type { PasswordInput, UserCreateOutput, UserUpdateOutput } from '@/lib/staff/schemas';
import type { SalaryDoctorDTO, SalaryReportDTO, StaffListDTO, StaffUserDTO } from '@/lib/staff/types';

/** TanStack Query kalitlari: ['staff', …] */
export const staffKeys = {
  all: ['staff'] as const,
  list: (params: StaffListParams) => ['staff', 'list', params] as const,
  one: (id: string) => ['staff', 'one', id] as const,
  salary: (month: string) => ['staff', 'salary', month] as const,
  doctorSalary: (id: string, month: string) => ['staff', 'salary', 'doctor', id, month] as const,
};

/** Tip alias (interface emas): `qs()` indeks imzoli Record kutadi */
export type StaffListParams = {
  role?: 'ADMIN' | 'DOCTOR' | 'RECEPTION' | 'CASHIER';
  active?: '1' | '0';
  search?: string;
};

export function useStaffList(params: StaffListParams = {}) {
  return useQuery({
    queryKey: staffKeys.list(params),
    queryFn: () => api.get<StaffListDTO>('/api/users' + qs(params)),
  });
}

export function useSalaryReport(month: string, enabled = true) {
  return useQuery({
    queryKey: staffKeys.salary(month),
    queryFn: () => api.get<SalaryReportDTO>('/api/users/salary' + qs({ month })),
    enabled,
  });
}

export interface DoctorSalaryDTO {
  month: string;
  from: string;
  to: string;
  item: SalaryDoctorDTO;
}

export function useDoctorSalary(id: string | null, month: string) {
  return useQuery({
    queryKey: staffKeys.doctorSalary(id ?? '', month),
    queryFn: () => api.get<DoctorSalaryDTO>(`/api/users/${id}/salary` + qs({ month })),
    enabled: !!id,
  });
}

function useInvalidateStaff() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: staffKeys.all });
}

export function useCreateStaff() {
  const invalidate = useInvalidateStaff();
  return useMutation({
    mutationFn: (body: UserCreateOutput) => api.post<StaffUserDTO>('/api/users', body),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateStaff() {
  const invalidate = useInvalidateStaff();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UserUpdateOutput }) => api.patch<StaffUserDTO>(`/api/users/${id}`, body),
    onSuccess: () => invalidate(),
  });
}

export function useSetStaffPassword() {
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: PasswordInput }) => api.post<{ id: string }>(`/api/users/${id}/password`, body),
  });
}

export function useDeactivateStaff() {
  const invalidate = useInvalidateStaff();
  return useMutation({
    mutationFn: (id: string) => api.delete<StaffUserDTO>(`/api/users/${id}`),
    onSuccess: () => invalidate(),
  });
}
