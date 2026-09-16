'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiClientError } from '@/lib/api/client';
import type { TFunction } from '@/i18n/t';
import type { BulkInput, CategoryInput, ServiceInput, ServiceUpdateInput } from '@/lib/services/schemas';
import type {
  BulkResultDTO,
  CategoriesListDTO,
  CategoryDTO,
  DeleteResultDTO,
  ReorderResultDTO,
  ServiceDTO,
  ServiceHistoryDTO,
  ServicesListDTO,
} from '@/lib/services/types';

/**
 * Xizmatlar moduli uchun TanStack Query kalitlari va mutatsiyalar.
 * Roʻyxat bir marta toʻliq (`?all=1`) yuklanadi — filtrlash mijozda (63 ta xizmat uchun yetarli).
 */
export const servicesKeys = {
  all: ['services'] as const,
  list: ['services', { all: true }] as const,
  history: (id: string) => ['services', 'history', id] as const,
  categories: ['categories'] as const,
};

/** API xatosini foydalanuvchiga tushunarli matnga keltiradi (maʼlum kodlar — i18n, qolgani — server matni) */
export function serviceErrorMessage(err: unknown, t: TFunction): string {
  if (err instanceof ApiClientError) {
    const field =
      err.details && typeof err.details === 'object' && 'field' in err.details
        ? String((err.details as { field?: unknown }).field)
        : null;
    if (err.code === 'CONFLICT' && field === 'code') return t('services.errors.codeExists');
    if (err.code === 'CONFLICT' && field === 'name') return t('services.errors.nameExists');
    if (err.code === 'FORBIDDEN') return t('services.errors.forbidden');
    if (err.code === 'NOT_FOUND') return t('services.errors.notFound');
    return err.message || t('common.error');
  }
  if (err instanceof Error && err.message) return err.message;
  return t('common.error');
}

export function useServicesQuery() {
  return useQuery({
    queryKey: servicesKeys.list,
    queryFn: async () => (await api.get<ServicesListDTO>('/api/services?all=1')).items,
  });
}

export function useCategoriesQuery() {
  return useQuery({
    queryKey: servicesKeys.categories,
    queryFn: async () => (await api.get<CategoriesListDTO>('/api/categories')).items,
  });
}

export function useServiceHistoryQuery(id: string | null) {
  return useQuery({
    queryKey: servicesKeys.history(id ?? 'none'),
    queryFn: async () => (await api.get<ServiceHistoryDTO>(`/api/services/${id}/history?limit=100`)).items,
    enabled: Boolean(id),
  });
}

export interface PatchServiceVars {
  id: string;
  patch: ServiceUpdateInput;
}

/** PATCH — optimistik: roʻyxat keshida darhol yangilanadi, xato boʻlsa qaytariladi */
export function usePatchService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: PatchServiceVars) => api.patch<ServiceDTO>(`/api/services/${id}`, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: servicesKeys.list });
      const prev = qc.getQueryData<ServiceDTO[]>(servicesKeys.list);
      if (prev) {
        qc.setQueryData<ServiceDTO[]>(
          servicesKeys.list,
          prev.map((s) => (s.id === id ? applyOptimisticPatch(s, patch) : s)),
        );
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(servicesKeys.list, ctx.prev);
    },
    onSuccess: (row) => {
      qc.setQueryData<ServiceDTO[]>(servicesKeys.list, (cur) => cur?.map((s) => (s.id === row.id ? row : s)) ?? cur);
      void qc.invalidateQueries({ queryKey: servicesKeys.history(row.id) });
    },
    onSettled: (_row, _err, vars) => {
      if (vars.patch.isActive !== undefined || vars.patch.categoryId !== undefined) {
        void qc.invalidateQueries({ queryKey: servicesKeys.categories });
      }
    },
  });
}

/** Optimistik yangilash: faqat oddiy maydonlar (narxlar butun number, matnlar string) */
function applyOptimisticPatch(s: ServiceDTO, patch: ServiceUpdateInput): ServiceDTO {
  const next: ServiceDTO = { ...s };
  const toInt = (v: number | string | undefined) => {
    if (v === undefined) return undefined;
    const n = typeof v === 'string' ? Number(v.replace(/\s/g, '')) : v;
    return Number.isFinite(n) ? Math.round(n) : undefined;
  };
  const money = (k: 'priceAdultNoMed' | 'priceAdultMed' | 'priceChildNoMed' | 'priceChildMed') => {
    const v = toInt(patch[k]);
    if (v !== undefined) next[k] = v;
  };
  money('priceAdultNoMed');
  money('priceAdultMed');
  money('priceChildNoMed');
  money('priceChildMed');
  if (patch.allowHalf !== undefined) next.allowHalf = patch.allowHalf;
  if (patch.medicineOptional !== undefined) next.medicineOptional = patch.medicineOptional;
  if (patch.isActive !== undefined) next.isActive = patch.isActive;
  if (patch.name !== undefined) next.name = patch.name;
  if (patch.nameRu !== undefined) next.nameRu = patch.nameRu;
  if (patch.code !== undefined) next.code = patch.code.toUpperCase();
  if (patch.unit !== undefined) next.unit = patch.unit;
  if (patch.durationMin !== undefined) {
    const d = toInt(patch.durationMin);
    if (d !== undefined) next.durationMin = d;
  }
  if (patch.defaultOrgan !== undefined) next.defaultOrgan = patch.defaultOrgan ?? null;
  return next;
}

export function useCreateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ServiceInput) => api.post<ServiceDTO>('/api/services', input),
    onSuccess: (row) => {
      qc.setQueryData<ServiceDTO[]>(servicesKeys.list, (cur) => (cur ? [...cur, row] : cur));
      void qc.invalidateQueries({ queryKey: servicesKeys.all });
      void qc.invalidateQueries({ queryKey: servicesKeys.categories });
    },
  });
}

export function useDeleteService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<DeleteResultDTO>(`/api/services/${id}`),
    onSuccess: (res) => {
      qc.setQueryData<ServiceDTO[]>(servicesKeys.list, (cur) => cur?.filter((s) => s.id !== res.id) ?? cur);
      void qc.invalidateQueries({ queryKey: servicesKeys.categories });
    },
  });
}

export function useBulkServices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BulkInput) => api.post<BulkResultDTO>('/api/services/bulk', input),
    onSuccess: (res) => {
      if (!res.preview) void qc.invalidateQueries({ queryKey: servicesKeys.all });
    },
  });
}

export function useReorderServices() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api.post<ReorderResultDTO>('/api/services/reorder', { ids }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: servicesKeys.list }),
  });
}

// ── Kategoriyalar ──

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CategoryInput) => api.post<CategoryDTO>('/api/categories', input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: servicesKeys.categories }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<CategoryInput> }) =>
      api.patch<CategoryDTO>(`/api/categories/${id}`, patch),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: servicesKeys.categories });
      void qc.invalidateQueries({ queryKey: servicesKeys.list });
    },
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<DeleteResultDTO>(`/api/categories/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: servicesKeys.categories }),
  });
}

export function useReorderCategories() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api.post<ReorderResultDTO>('/api/categories/reorder', { ids }),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: servicesKeys.categories });
      const prev = qc.getQueryData<CategoryDTO[]>(servicesKeys.categories);
      if (prev) {
        const pos = new Map(ids.map((id, i) => [id, i]));
        qc.setQueryData<CategoryDTO[]>(
          servicesKeys.categories,
          [...prev]
            .map((c) => ({ ...c, order: (pos.get(c.id) ?? c.order - 1) + 1 }))
            .sort((a, b) => a.order - b.order),
        );
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(servicesKeys.categories, ctx.prev);
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: servicesKeys.categories });
      void qc.invalidateQueries({ queryKey: servicesKeys.list });
    },
  });
}
