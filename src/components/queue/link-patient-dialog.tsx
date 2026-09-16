'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Link2 } from 'lucide-react';
import { useT } from '@/i18n/client';
import { ApiClientError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useLinkPatient } from '@/lib/queue/queries';
import type { QueueRowDTO } from '@/lib/queue/types';
import { PatientPicker, type PatientLite } from './patient-picker';

export interface LinkPatientDialogProps {
  row: QueueRowDTO | null;
  onOpenChange: (open: boolean) => void;
  /** Biriktirilgach (masalan qabulni boshlash uchun) */
  onLinked?: (row: QueueRowDTO) => void;
}

/** Talonga bemorni biriktirish (POST /api/queue/[id]/patient) */
export function LinkPatientDialog({ row, onOpenChange, onLinked }: LinkPatientDialogProps) {
  const t = useT();
  const ids = React.useId();
  const link = useLinkPatient();
  const [patient, setPatient] = React.useState<PatientLite | null>(null);
  const open = row !== null;

  React.useEffect(() => {
    if (open) setPatient(null);
  }, [open, row?.id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!row || !patient) return;
    try {
      const updated = await link.mutateAsync({ id: row.id, patientId: patient.id });
      toast.success(t('queue.toast.patientLinked'));
      onOpenChange(false);
      onLinked?.(updated);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : t('queue.errors.generic'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !link.isPending && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {t('queue.dialog.link.title')} {row ? <span className="tabular text-accent">· {row.number}</span> : null}
            </DialogTitle>
            <DialogDescription>{t('queue.dialog.link.description')}</DialogDescription>
          </DialogHeader>
          {row?.patient ? (
            <p className="text-sm text-text-muted">
              {t('queue.dialog.link.current')}: <span className="font-medium text-text">{row.patient.fullName}</span>{' '}
              <span className="tabular">({row.patient.cardNumber})</span>
            </p>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor={`${ids}-patient`} required>
              {t('common.patient')}
            </Label>
            <PatientPicker id={`${ids}-patient`} value={patient} onChange={setPatient} disabled={link.isPending} autoOpen />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={link.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" loading={link.isPending} disabled={!patient}>
              <Link2 aria-hidden="true" />
              {t('queue.dialog.link.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
