'use client';

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { api, ApiClientError, qs } from '@/lib/api/client';
import type { TFunction } from '@/i18n/t';
import { cashierErrorCode } from '@/lib/cashier/format';
import type {
  CloseShiftInput,
  CreatePaymentInput,
  OpenShiftInput,
  RefundBody,
  UnpaidScope,
} from '@/lib/cashier/schemas';
import type {
  CashierVisitDTO,
  CloseShiftResultDTO,
  CurrentShiftResponse,
  PaymentListResponse,
  PaymentResultDTO,
  ReceiptViewData,
  RefundResultDTO,
  ShiftDetailDTO,
  ShiftDTO,
  ShiftListResponse,
  UnpaidListResponse,
} from '@/lib/cashier/types';

/**
 * Kassa moduli TanStack Query hooklari va kalitlari.
 *   ['shift','current'] · ['shifts', {page}] · ['shift', id] · ['cashier','unpaid', {scope,q}] · ['payments', {...}] · ['cashier','visit', id]
 */
export const cashierKeys = {
  currentShift: ['shift', 'current'] as const,
  shifts: (page: number, pageSize: number) => ['shifts', { page, pageSize }] as const,
  shift: (id: string) => ['shift', id] as const,
  unpaid: (scope: UnpaidScope, q: string) => ['cashier', 'unpaid', { scope, q }] as const,
  payments: (params: { date?: string; visitId?: string; page: number; pageSize: number }) =>
    ['payments', params] as const,
  visit: (id: string) => ['cashier', 'visit', id] as const,
};

export function useCurrentShift(enabled = true) {
  return useQuery({
    queryKey: cashierKeys.currentShift,
    queryFn: () => api.get<CurrentShiftResponse>('/api/shifts/current'),
    enabled,
    refetchInterval: 30_000,
  });
}

export function useUnpaidVisits(scope: UnpaidScope, q: string, enabled = true) {
  return useQuery({
    queryKey: cashierKeys.unpaid(scope, q),
    queryFn: () => api.get<UnpaidListResponse>('/api/payments/unpaid' + qs({ scope, q, limit: 200 })),
    enabled,
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
}

export function usePayments(
  params: { date?: string; visitId?: string; page: number; pageSize: number },
  enabled = true,
) {
  return useQuery({
    queryKey: cashierKeys.payments(params),
    queryFn: () => api.get<PaymentListResponse>('/api/payments' + qs(params)),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useShifts(page: number, pageSize: number, enabled = true) {
  return useQuery({
    queryKey: cashierKeys.shifts(page, pageSize),
    queryFn: () => api.get<ShiftListResponse>('/api/shifts' + qs({ page, pageSize })),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useShiftDetail(id: string | null) {
  return useQuery({
    queryKey: cashierKeys.shift(id ?? ''),
    queryFn: () => api.get<ShiftDetailDTO>(`/api/shifts/${encodeURIComponent(id ?? '')}`),
    enabled: !!id,
  });
}

export function useCashierVisit(id: string | null) {
  return useQuery({
    queryKey: cashierKeys.visit(id ?? ''),
    queryFn: () => api.get<CashierVisitDTO>(`/api/payments/visit/${encodeURIComponent(id ?? '')}`),
    enabled: !!id,
    staleTime: 0,
  });
}

/** Toʻlov/qaytarish/smena oʻzgarganda barcha bogʻliq roʻyxatlarni yangilash */
export function useInvalidateCashier() {
  const qc = useQueryClient();
  return useCallback(
    async (visitId?: string) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['shift'] }),
        qc.invalidateQueries({ queryKey: ['shifts'] }),
        qc.invalidateQueries({ queryKey: ['cashier'] }),
        qc.invalidateQueries({ queryKey: ['payments'] }),
        qc.invalidateQueries({ queryKey: ['stats'] }),
        qc.invalidateQueries({ queryKey: ['patients'] }),
        ...(visitId ? [qc.invalidateQueries({ queryKey: ['visit', visitId] })] : []),
      ]);
    },
    [qc],
  );
}

export function useCreatePayment() {
  const invalidate = useInvalidateCashier();
  return useMutation({
    mutationFn: (input: CreatePaymentInput) => api.post<PaymentResultDTO>('/api/payments', input),
    onSuccess: (r) => invalidate(r.visit.id),
  });
}

export function useRefundPayment() {
  const invalidate = useInvalidateCashier();
  return useMutation({
    mutationFn: ({ paymentId, ...body }: RefundBody & { paymentId: string }) =>
      api.post<RefundResultDTO>(`/api/payments/${encodeURIComponent(paymentId)}/refund`, body),
    onSuccess: (r) => invalidate(r.refund.visitId),
  });
}

export function useOpenShift() {
  const invalidate = useInvalidateCashier();
  return useMutation({
    mutationFn: (input: OpenShiftInput) => api.post<ShiftDTO>('/api/shifts/open', input),
    onSuccess: () => invalidate(),
  });
}

export function useCloseShift() {
  const invalidate = useInvalidateCashier();
  return useMutation({
    mutationFn: ({ shiftId, ...body }: CloseShiftInput & { shiftId: string }) =>
      api.post<CloseShiftResultDTO>(`/api/shifts/${encodeURIComponent(shiftId)}/close`, body),
    onSuccess: () => invalidate(),
  });
}

/** Chekni qayta chop etish uchun maʼlumot */
export function fetchPaymentReceipt(paymentId: string): Promise<ReceiptViewData> {
  return api.get<ReceiptViewData>(`/api/payments/${encodeURIComponent(paymentId)}/receipt`);
}

/** API xatosi → joriy tildagi matn (kassa kodlari, umumiy kodlar, tarmoq) */
export function cashierErrorMessage(err: unknown, t: TFunction): string {
  if (err instanceof ApiClientError) {
    const detailCode = cashierErrorCode(err.details);
    if (detailCode) return t(`cashier.errors.${detailCode}`);
    const d = err.details as { code?: unknown } | undefined;
    if (d && typeof d === 'object' && d.code === 'SHIFT_ALREADY_OPEN')
      return t('cashier.errors.SHIFT_ALREADY_OPEN');
    switch (err.code) {
      case 'NO_OPEN_SHIFT':
      case 'VISIT_CLOSED':
      case 'SHIFT_CLOSED':
      case 'NOT_FOUND':
      case 'FORBIDDEN':
      case 'VALIDATION':
        return t(`cashier.errors.${err.code}`);
      case 'UNAUTHORIZED':
        return t('common.errorPage.title');
      default:
        return err.message || t('cashier.errors.generic');
    }
  }
  if (err instanceof TypeError) return t('cashier.errors.network');
  return t('cashier.errors.generic');
}

/** Xato "smena ochilmagan"mi? (UI smena ochish oynasini taklif qiladi) */
export function isNoOpenShiftError(err: unknown): boolean {
  return err instanceof ApiClientError && err.code === 'NO_OPEN_SHIFT';
}
