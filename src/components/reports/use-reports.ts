'use client';

import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';
import { api, qs } from '@/lib/api/client';
import type { Locale } from '@/i18n/config';
import type {
  DebtReminderResultDTO,
  DebtorsReportDTO,
  DoctorOptionDTO,
  DoctorsReportDTO,
  GroupBy,
  MedicineReportDTO,
  PatientTypesReportDTO,
  ReportKind,
  RevenueReportDTO,
  ServicesReportDTO,
  ShiftsReportDTO,
  SummaryDTO,
} from '@/lib/reports/types';

/**
 * Hisobot soʻrovlari (TanStack Query). Kalitlar: ['reports', <boʻlim>, params].
 * `placeholderData: keepPreviousData` — filtr oʻzgarganda oldingi render saqlanadi (skeleton "miltillamaydi").
 */

export interface ReportParams {
  from: string;
  to: string;
  doctorId: string | null;
}

function baseQs(p: ReportParams, extra: Record<string, string | number | boolean | undefined | null> = {}): string {
  return qs({ from: p.from, to: p.to, doctorId: p.doctorId ?? undefined, ...extra });
}

export function useSummary(p: ReportParams) {
  return useQuery({
    queryKey: ['reports', 'summary', p],
    queryFn: () => api.get<SummaryDTO>(`/api/reports/summary${baseQs(p)}`),
    placeholderData: keepPreviousData,
  });
}

export function useRevenueReport(p: ReportParams, groupBy: GroupBy, enabled: boolean) {
  return useQuery({
    queryKey: ['reports', 'revenue', p, groupBy],
    queryFn: () => api.get<RevenueReportDTO>(`/api/reports/revenue${baseQs(p, { groupBy })}`),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useDoctorsReport(p: ReportParams, enabled: boolean) {
  return useQuery({
    queryKey: ['reports', 'doctors', p],
    queryFn: () => api.get<DoctorsReportDTO>(`/api/reports/doctors${baseQs(p)}`),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useServicesReport(p: ReportParams, enabled: boolean) {
  return useQuery({
    queryKey: ['reports', 'services', p],
    queryFn: () => api.get<ServicesReportDTO>(`/api/reports/services${baseQs(p)}`),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function usePatientTypesReport(p: ReportParams, groupBy: GroupBy, enabled: boolean) {
  return useQuery({
    queryKey: ['reports', 'patient-types', p, groupBy],
    queryFn: () => api.get<PatientTypesReportDTO>(`/api/reports/patient-types${baseQs(p, { groupBy })}`),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useMedicineReport(p: ReportParams, enabled: boolean) {
  return useQuery({
    queryKey: ['reports', 'medicine', p],
    queryFn: () => api.get<MedicineReportDTO>(`/api/reports/medicine${baseQs(p)}`),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useShiftsReport(p: ReportParams, enabled: boolean) {
  return useQuery({
    queryKey: ['reports', 'shifts', p],
    queryFn: () => api.get<ShiftsReportDTO>(`/api/reports/shifts${baseQs(p)}`),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useDebtorsReport(p: ReportParams, allTime: boolean, enabled: boolean) {
  return useQuery({
    queryKey: ['reports', 'debtors', p, allTime],
    queryFn: () => api.get<DebtorsReportDTO>(`/api/reports/debtors${baseQs(p, { all: allTime ? 1 : undefined })}`),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** Shifokor filtri uchun roʻyxat (staff moduli: GET /api/users?role=DOCTOR&active=1) */
export function useDoctorOptions(enabled: boolean) {
  return useQuery({
    queryKey: ['users', { role: 'DOCTOR', active: 1 }],
    queryFn: () => api.get<{ items: DoctorOptionDTO[] }>(`/api/users${qs({ role: 'DOCTOR', active: 1 })}`),
    staleTime: 5 * 60_000,
    enabled,
  });
}

export function useDebtReminder() {
  return useMutation({
    mutationFn: (input: { patientId: string; locale: Locale }) => api.post<DebtReminderResultDTO>('/api/reports/debtors/remind', input),
  });
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Content-Disposition dan fayl nomi (UTF-8 → ASCII → fallback) */
export function parseFileName(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(disposition);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {
      /* ASCII nomga oʻtamiz */
    }
  }
  const ascii = /filename="?([^";]+)"?/i.exec(disposition);
  return ascii?.[1] ?? fallback;
}

export interface ExportOptions {
  kind: ReportKind;
  params: ReportParams;
  groupBy: GroupBy;
  allTime?: boolean;
  locale: Locale;
}

/** Excel eksportni yuklab olish: fetch → blob → <a download> (xato boʻlsa JSON xabari bilan Error) */
export async function downloadExport(opts: ExportOptions): Promise<string> {
  const url = `/api/reports/export${baseQs(opts.params, { kind: opts.kind, groupBy: opts.groupBy, all: opts.allTime ? 1 : undefined, locale: opts.locale })}`;
  const res = await fetch(url, {
    credentials: 'same-origin',
    headers: { Accept: XLSX_MIME, 'X-Requested-With': 'lor-crm' },
  });
  if (!res.ok) {
    let message = res.statusText || 'Xatolik';
    try {
      const json = (await res.json()) as { ok: boolean; error?: { message?: string } };
      if (json && !json.ok && json.error?.message) message = json.error.message;
    } catch {
      /* JSON emas */
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const name = parseFileName(res.headers.get('content-disposition'), `report-${opts.kind}-${opts.params.from}_${opts.params.to}.xlsx`);
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 2000);
  return name;
}
