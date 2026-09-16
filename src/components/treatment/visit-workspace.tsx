'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { can } from '@/lib/permissions';
import type { SessionUser } from '@/lib/auth/session';
import type { DiscountType } from '@/lib/calc';
import { useLocale } from '@/i18n/client';
import type { TreatmentServiceDTO, VisitDetailDTO } from '@/lib/visits/dto';
import type { AddLineInput, UpdateVisitInput } from '@/lib/visits/schemas';
import type { TreatmentLineDTO } from '@/lib/visits/types';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { AddTreatmentDialog } from './add-treatment-dialog';
import { DiagnosisForm } from './diagnosis-form';
import { TreatmentLinesTable } from './treatment-lines-table';
import { VisitHeader } from './visit-header';
import { VisitSummary } from './visit-summary';
import { visitApi, visitErrorMessage, visitKey } from './visit-api';
import { lineName } from './visit-utils';

export interface VisitWorkspaceProps {
  visit: VisitDetailDTO;
  services: TreatmentServiceDTO[];
  user: SessionUser;
}

type DialogState = { open: boolean; mode: 'add' | 'edit'; line: TreatmentLineDTO | null };

/**
 * Qabul ish maydoni: chap (2/3) — sarlavha, tashxis, qatorlar; oʻng (1/3) — yopishqoq hisob-kitob.
 * `useQuery(['visit', id])` server maʼlumoti bilan gidratlanadi; har mutatsiya javobi keshga yoziladi.
 */
export function VisitWorkspace({ visit: initialVisit, services, user }: VisitWorkspaceProps) {
  const { locale, t } = useLocale();
  const qc = useQueryClient();
  const id = initialVisit.id;
  const key = visitKey(id);

  const { data: visit } = useQuery({
    queryKey: key,
    queryFn: () => visitApi.get(id),
    initialData: initialVisit,
    staleTime: 15_000,
  });

  const canWrite = can(user.role, 'visits.write');
  const isOpen = visit.status === 'OPEN';
  const canEdit = canWrite && isOpen;
  const canCancel =
    canWrite &&
    isOpen &&
    visit.paidAmount === 0 &&
    (user.role === 'ADMIN' || user.role === 'DOCTOR' || user.role === 'SUPER_ADMIN');

  const [dialog, setDialog] = React.useState<DialogState>({ open: false, mode: 'add', line: null });
  const [deleteTarget, setDeleteTarget] = React.useState<TreatmentLineDTO | null>(null);

  const applyVisit = React.useCallback(
    (next: VisitDetailDTO) => {
      qc.setQueryData(key, next);
      void qc.invalidateQueries({ queryKey: ['visits'] });
      void qc.invalidateQueries({ queryKey: ['patient', next.patientId] });
    },
    [qc, key],
  );

  const fail = React.useCallback((err: unknown) => toast.error(visitErrorMessage(err, t)), [t]);

  const addLine = useMutation({
    mutationFn: (input: AddLineInput) => visitApi.addLine(id, input),
    onSuccess: (next) => {
      applyVisit(next);
      toast.success(t('visits.toasts.lineAdded'));
    },
    onError: fail,
  });
  const updateLine = useMutation({
    mutationFn: ({ lineId, input }: { lineId: string; input: AddLineInput }) =>
      visitApi.updateLine(id, lineId, input),
    onSuccess: (next) => {
      applyVisit(next);
      toast.success(t('visits.toasts.lineUpdated'));
    },
    onError: fail,
  });
  const deleteLine = useMutation({
    mutationFn: (lineId: string) => visitApi.deleteLine(id, lineId),
    onSuccess: (next) => {
      applyVisit(next);
      toast.success(t('visits.toasts.lineDeleted'));
    },
    onError: fail,
  });
  const discount = useMutation({
    mutationFn: ({ type, value }: { type: DiscountType; value: number }) =>
      visitApi.setDiscount(id, { type, value }),
    onSuccess: (next) => {
      applyVisit(next);
      toast.success(t('visits.toasts.discountSaved'));
    },
    onError: fail,
  });
  const complete = useMutation({
    mutationFn: () => visitApi.complete(id),
    onSuccess: (next) => {
      applyVisit(next);
      void qc.invalidateQueries({ queryKey: ['queue'] });
      void qc.invalidateQueries({ queryKey: ['appointments'] });
      toast.success(t('visits.toasts.completed'));
    },
    onError: fail,
  });
  const cancel = useMutation({
    mutationFn: () => visitApi.cancel(id),
    onSuccess: (next) => {
      applyVisit(next);
      void qc.invalidateQueries({ queryKey: ['queue'] });
      toast.success(t('visits.toasts.cancelled'));
    },
    onError: fail,
  });
  const clinical = useMutation({
    mutationFn: (patch: UpdateVisitInput) => visitApi.update(id, patch),
    onSuccess: (next) => {
      // Tashxis matnlarini foydalanuvchi yozayotgan boʻlishi mumkin — faqat serverdan kelgan jamlar/holat yangilanadi
      qc.setQueryData(key, next);
    },
    onError: fail,
  });

  const submitLine = async (input: AddLineInput) => {
    if (dialog.mode === 'edit' && dialog.line) {
      await updateLine.mutateAsync({ lineId: dialog.line.id, input });
    } else {
      await addLine.mutateAsync(input);
    }
  };

  /** Xato toast orqali koʻrsatilgan — tasdiqlash oynalari uchun rad etishni yutamiz */
  const quiet = (p: Promise<unknown>) => p.then(() => undefined).catch(() => undefined);

  const openAdd = () => setDialog({ open: true, mode: 'add', line: null });
  const openEdit = (line: TreatmentLineDTO) => setDialog({ open: true, mode: 'edit', line });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-text-muted">
          <Link href="/dashboard/visits">
            <ArrowLeft aria-hidden="true" />
            {t('visits.title')}
          </Link>
        </Button>
        {canEdit ? (
          <Button type="button" variant="gradient" className="glow md:hidden" onClick={openAdd}>
            <Plus aria-hidden="true" />
            {t('visits.lines.add')}
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3 lg:items-start">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <VisitHeader visit={visit} readOnly={!canWrite} />

          <DiagnosisForm
            visit={visit}
            readOnly={!canEdit}
            onSave={(patch) => clinical.mutateAsync(patch).then(() => undefined)}
          />

          <section className="space-y-3" aria-labelledby="lines-title">
            <div className="flex items-center justify-between gap-3">
              <h2 id="lines-title" className="font-heading text-lg font-semibold text-text">
                {t('visits.lines.title')}
                {visit.lines.length > 0 ? (
                  <span className="ml-2 text-sm font-normal text-text-muted">
                    {t('visits.lines.count', { n: visit.lines.length })}
                  </span>
                ) : null}
              </h2>
              {canEdit ? (
                <Button
                  type="button"
                  variant="gradient"
                  className="glow hidden md:inline-flex"
                  onClick={openAdd}
                >
                  <Plus aria-hidden="true" />
                  {t('visits.lines.add')}
                </Button>
              ) : null}
            </div>
            <TreatmentLinesTable
              lines={visit.lines}
              canEdit={canEdit}
              onAdd={openAdd}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
              deletingId={deleteLine.isPending ? deleteLine.variables : null}
            />
          </section>
        </div>

        <div className="lg:sticky lg:top-20">
          <VisitSummary
            visit={visit}
            canEdit={canEdit}
            canCancel={canCancel}
            discountPending={discount.isPending}
            onDiscount={(type, value) => quiet(discount.mutateAsync({ type, value }))}
            onComplete={() => quiet(complete.mutateAsync())}
            onCancel={() => quiet(cancel.mutateAsync())}
          />
        </div>
      </div>

      <AddTreatmentDialog
        open={dialog.open}
        onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))}
        mode={dialog.mode}
        line={dialog.line}
        services={services}
        visitId={visit.id}
        patient={{ birthDate: visit.patient.birthDate }}
        clinic={{ childAgeLimit: visit.clinic.childAgeLimit }}
        onSubmit={submitLine}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={t('visits.lines.deleteTitle')}
        description={
          deleteTarget
            ? t('visits.lines.deleteDescription', { name: lineName(deleteTarget, locale) })
            : undefined
        }
        destructive
        onConfirm={() => (deleteTarget ? quiet(deleteLine.mutateAsync(deleteTarget.id)) : Promise.resolve())}
      />
    </div>
  );
}
