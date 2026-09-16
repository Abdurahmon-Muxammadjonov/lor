'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Ticket } from 'lucide-react';
import { useT } from '@/i18n/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ANY_DOCTOR, DoctorSelect } from './doctor-select';
import type { PatientRef } from './start-visit-dialog';
import { patientErrorMessage, useActiveDoctors, useEnqueueMutation } from './use-patients';

export interface QueueDialogProps {
  patient: PatientRef | null;
  onOpenChange: (open: boolean) => void;
}

/** Bemorni shifokor navbatiga qoʻshish (POST /api/queue type=DOCTOR) → talon raqami toast */
export function QueueDialog({ patient, onOpenChange }: QueueDialogProps) {
  const t = useT();
  const open = patient !== null;
  const doctors = useActiveDoctors(open);
  const [doctorId, setDoctorId] = React.useState(ANY_DOCTOR);
  const mutation = useEnqueueMutation();

  React.useEffect(() => {
    if (!open) setDoctorId(ANY_DOCTOR);
  }, [open]);

  const submit = async () => {
    if (!patient) return;
    try {
      const entry = await mutation.mutateAsync({
        patientId: patient.id,
        doctorId: doctorId === ANY_DOCTOR ? undefined : doctorId,
      });
      toast.success(t('patients.toast.queued', { number: entry.number }), {
        duration: 8000,
        action: {
          label: t('patients.toast.openTicket'),
          onClick: () => window.open(`/print/ticket/${entry.id}`, '_blank', 'noopener'),
        },
      });
      onOpenChange(false);
    } catch (err) {
      toast.error(patientErrorMessage(err, t));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !mutation.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ticket className="size-5 text-accent" aria-hidden="true" />
            {t('patients.queueDialog.title')}
          </DialogTitle>
          <DialogDescription>
            {t('patients.queueDialog.description', { name: patient?.fullName ?? '' })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="queue-doctor">{t('patients.queueDialog.doctor')}</Label>
          <DoctorSelect
            id="queue-doctor"
            doctors={doctors.data}
            loading={doctors.isLoading}
            value={doctorId}
            onChange={setDoctorId}
            anyLabel={t('patients.queueDialog.anyDoctor')}
            disabled={mutation.isPending}
          />
          {doctors.isError ? (
            <p className="text-xs text-danger">{patientErrorMessage(doctors.error, t)}</p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={mutation.isPending}
          >
            {t('common.cancel')}
          </Button>
          <Button type="button" onClick={submit} loading={mutation.isPending}>
            <Ticket aria-hidden="true" />
            {t('patients.queueDialog.add')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** `enqueue(patient)` + daraxtga qoʻyiladigan `dialog` */
export function useEnqueue(): { enqueue: (p: PatientRef) => void; dialog: React.ReactElement } {
  const [target, setTarget] = React.useState<PatientRef | null>(null);
  const enqueue = React.useCallback((p: PatientRef) => setTarget(p), []);
  const dialog = <QueueDialog patient={target} onOpenChange={(o) => !o && setTarget(null)} />;
  return { enqueue, dialog };
}
