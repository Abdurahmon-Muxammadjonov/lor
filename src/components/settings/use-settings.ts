'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError, qs } from '@/lib/api/client';
import type { TFunction } from '@/i18n/t';
import { useInvalidatePrinterSettings } from '@/lib/printer/use-printer-settings';
import type {
  AuditListDTO,
  AuditQuery,
  ClinicProfileDTO,
  ClinicProfilePatch,
  IntegrationStatusDTO,
  KioskKeyDTO,
  PrinterPatch,
  QueuePatch,
  RolesMatrixDTO,
  SectionValues,
  SettingsSection,
  SmsPatch,
  SmsSettingsDTO,
  SmsTestInput,
  TelegramPatch,
  TelegramSettingsDTO,
  TelegramTestInput,
} from '@/lib/settings/schemas';

/**
 * Sozlamalar sahifasi uchun TanStack Query hooklari.
 * Kalitlar: ['settings','clinic'] · ['settings','printer'] (printer lib bilan bir xil) · ['settings','sms'] · ['settings','telegram']
 *           · ['settings','queue'] · ['settings','roles'] · ['settings','integrations'] · ['settings','audit', params]
 */

export const SETTINGS_KEYS = {
  clinic: ['settings', 'clinic'] as const,
  printer: ['settings', 'printer'] as const,
  sms: ['settings', 'sms'] as const,
  telegram: ['settings', 'telegram'] as const,
  queue: ['settings', 'queue'] as const,
  roles: ['settings', 'roles'] as const,
  integrations: ['settings', 'integrations'] as const,
  audit: (params: Partial<AuditQuery>) => ['settings', 'audit', params] as const,
};

/** API xatosini foydalanuvchiga koʻrsatiladigan matnga keltirish (integratsiya xatolari — ikki tilli details) */
export function settingsErrorMessage(err: unknown, t: TFunction, locale: 'uz' | 'ru' = 'uz'): string {
  if (err instanceof ApiClientError) {
    if (err.code === 'INTEGRATION_ERROR') {
      const d = err.details;
      if (d && typeof d === 'object' && 'messages' in d) {
        const m = (d as { messages?: { uz?: string; ru?: string } }).messages;
        const text = m?.[locale];
        if (text) return text;
      }
      return err.message;
    }
    if (err.code === 'VALIDATION') return t('settings.toast.validation');
    if (err.code === 'FORBIDDEN') return t('common.denied.title');
    return err.message || t('common.error');
  }
  if (err instanceof Error && err.message) return err.message;
  return t('common.error');
}

export function useClinicProfile(enabled = true) {
  return useQuery({
    queryKey: SETTINGS_KEYS.clinic,
    queryFn: () => api.get<ClinicProfileDTO>('/api/settings/clinic'),
    enabled,
    staleTime: 60_000,
  });
}

export function useUpdateClinicProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: ClinicProfilePatch) => api.patch<ClinicProfileDTO>('/api/settings/clinic', patch),
    onSuccess: (data) => {
      qc.setQueryData(SETTINGS_KEYS.clinic, data);
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

export function usePrinterSection(enabled = true) {
  return useQuery({
    queryKey: SETTINGS_KEYS.printer,
    queryFn: () => api.get<SectionValues['printer']>('/api/settings/printer'),
    enabled,
    staleTime: 60_000,
  });
}

export function useUpdatePrinterSection() {
  const qc = useQueryClient();
  const invalidatePrinter = useInvalidatePrinterSettings();
  return useMutation({
    mutationFn: (patch: PrinterPatch) => api.patch<SectionValues['printer']>('/api/settings/printer', patch),
    onSuccess: async (data) => {
      qc.setQueryData(SETTINGS_KEYS.printer, data);
      await invalidatePrinter();
    },
  });
}

export function useSmsSection(enabled = true) {
  return useQuery({
    queryKey: SETTINGS_KEYS.sms,
    queryFn: () => api.get<SmsSettingsDTO>('/api/settings/sms'),
    enabled,
    staleTime: 60_000,
  });
}

export function useUpdateSmsSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: SmsPatch) => api.patch<SmsSettingsDTO>('/api/settings/sms', patch),
    onSuccess: (data) => qc.setQueryData(SETTINGS_KEYS.sms, data),
  });
}

export function useSmsTest() {
  return useMutation({
    mutationFn: (input: SmsTestInput) => api.post<{ id: string; status: string; providerId: string | null; text: string }>('/api/settings/sms/test', input),
  });
}

export function useTelegramSection(enabled = true) {
  return useQuery({
    queryKey: SETTINGS_KEYS.telegram,
    queryFn: () => api.get<TelegramSettingsDTO>('/api/settings/telegram'),
    enabled,
    staleTime: 60_000,
  });
}

export function useUpdateTelegramSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: TelegramPatch) => api.patch<TelegramSettingsDTO>('/api/settings/telegram', patch),
    onSuccess: (data) => qc.setQueryData(SETTINGS_KEYS.telegram, data),
  });
}

export function useTelegramTest() {
  return useMutation({
    mutationFn: (input: TelegramTestInput) =>
      api.post<{ sent: number; failed: number; chatIds: string[]; errors: string[] }>('/api/settings/telegram/test', input),
  });
}

export function useQueueSection(enabled = true) {
  return useQuery({
    queryKey: SETTINGS_KEYS.queue,
    queryFn: () => api.get<SectionValues['queue']>('/api/settings/queue'),
    enabled,
    staleTime: 60_000,
  });
}

export function useUpdateQueueSection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: QueuePatch) => api.patch<SectionValues['queue']>('/api/settings/queue', patch),
    onSuccess: (data) => {
      qc.setQueryData(SETTINGS_KEYS.queue, data);
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

export function useRegenerateKioskKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<KioskKeyDTO>('/api/settings/kiosk-key'),
    onSuccess: (data) => {
      qc.setQueryData<ClinicProfileDTO | undefined>(SETTINGS_KEYS.clinic, (prev) => (prev ? { ...prev, kioskKey: data.kioskKey } : prev));
      void qc.invalidateQueries({ queryKey: SETTINGS_KEYS.clinic });
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

export function useRolesMatrix(enabled = true) {
  return useQuery({
    queryKey: SETTINGS_KEYS.roles,
    queryFn: () => api.get<RolesMatrixDTO>('/api/settings/roles'),
    enabled,
    staleTime: 10 * 60_000,
  });
}

export function useIntegrationStatus(enabled = true) {
  return useQuery({
    queryKey: SETTINGS_KEYS.integrations,
    queryFn: () => api.get<IntegrationStatusDTO>('/api/settings/integrations'),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useAuditLog(params: Partial<AuditQuery>, enabled = true) {
  return useQuery({
    queryKey: SETTINGS_KEYS.audit(params),
    queryFn: () => api.get<AuditListDTO>('/api/settings/audit' + qs(params)),
    enabled,
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });
}

export type { SettingsSection };
