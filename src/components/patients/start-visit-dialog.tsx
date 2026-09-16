'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Stethoscope } from 'lucide-react';
import type { Role } from '@prisma/client';
import { useT } from '@/i18n/client';
import { useLocalStorage } from '@/hooks/use-local-storage';
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
import { DoctorSelect } from './doctor-select';
import { patientErrorMessage, useActiveDoctors, useStartVisitMutation } from './use-patients';

export interface Viewer {
  id: string;
  role: Role;
  fullName: string;
}

export interface PatientRef {
  id: string;
  fullName: string;
}

const LAST_DOCTOR_KEY = 'lor:patients:last-doctor';

export interface StartVisitDialogProps {
  patient: PatientRef | null;
  onOpenChange: (open: boolean) => void;
  onStarted?: (visitId: string) => void;
}

/** Shifokorni tanlab yangi qabul ochish (ADMIN / RECEPTION uchun) */
export function StartVisitDialog({ patient, onOpenChange, onStarted }: StartVisitDialogProps) {
  const t = useT();
  const router = useRouter();
  const open = patient !== null;
  const doctors = useActiveDoctors(open);
  const [lastDoctor, setLastDoctor] = useLocalStorage<string>(LAST_DOCTOR_KEY, '');
  const [doctorId, setDoctorId] = React.useState('');
  const [touched, setTouched] = React.useState(false);
  const mutation = useStartVisitMutation();

  // Ochilganda: oxirgi tanlangan yoki yagona shifokor
  React.useEffect(() => {
    if (!open) {
      setDoctorId('');
      setTouched(false);
      return;
    }
    const list = doctors.data ?? [];
    if (doctorId && list.some((d) => d.id === doctorId)) return;
    if (lastDoctor && list.some((d) => d.id === lastDoctor)) setDoctorId(lastDoctor);
    else if (list.length === 1 && list[0]) setDoctorId(list[0].id);
  }, [open, doctors.data, lastDoctor, doctorId]);

  const submit = async () => {
    if (!patient) return;
    setTouched(true);
    if (!doctorId) return;
    try {
      const visit = await mutation.mutateAsync({ patientId: patient.id, doctorId });
      setLastDoctor(doctorId);
      toast.success(t('patients.toast.visitCreated'));
      onOpenChange(false);
      onStarted?.(visit.id);
      router.push(`/dashboard/visits/${visit.id}`);
    } catch (err) {
      toast.error(patientErrorMessage(err, t));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !mutation.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Stethoscope className="size-5 text-accent" aria-hidden="true" />
            {t('patients.visitDialog.title')}
          </DialogTitle>
          <DialogDescription>
            {t('patients.visitDialog.description', { name: patient?.fullName ?? '' })}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="start-visit-doctor" required>
            {t('patients.visitDialog.doctor')}
          </Label>
          <DoctorSelect
            id="start-visit-doctor"
            doctors={doctors.data}
            loading={doctors.isLoading}
            value={doctorId}
            onChange={setDoctorId}
            invalid={touched && !doctorId}
            disabled={mutation.isPending}
          />
          {doctors.isError ? (
            <p className="text-xs text-danger">{patientErrorMessage(doctors.error, t)}</p>
          ) : null}
          {touched && !doctorId ? (
            <p className="text-xs text-danger">{t('patients.visitDialog.selectDoctor')}</p>
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
          <Button
            type="button"
            variant="gradient"
            onClick={submit}
            loading={mutation.isPending}
            disabled={!doctors.data?.length}
          >
            <Stethoscope aria-hidden="true" />
            {t('patients.visitDialog.start')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Qabulni boshlash oqimi: DOCTOR — oʻz nomidan darhol (POST /api/visits), qolganlar — shifokor tanlash dialogi.
 * `start(patient)` chaqiriladi, `dialog` daraxtga bir marta qoʻyiladi.
 */
export function useStartVisit(viewer: Viewer): {
  start: (p: PatientRef) => void;
  pending: boolean;
  dialog: React.ReactElement;
} {
  const t = useT();
  const router = useRouter();
  const [target, setTarget] = React.useState<PatientRef | null>(null);
  const mutation = useStartVisitMutation();

  const start = React.useCallback(
    (p: PatientRef) => {
      if (viewer.role !== 'DOCTOR') {
        setTarget(p);
        return;
      }
      const id = toast.loading(t('patients.toast.starting'));
      mutation
        .mutateAsync({ patientId: p.id, doctorId: viewer.id })
        .then((visit) => {
          toast.success(t('patients.toast.visitCreated'), { id });
          router.push(`/dashboard/visits/${visit.id}`);
        })
        .catch((err: unknown) => {
          toast.error(patientErrorMessage(err, t), { id });
        });
    },
    [viewer.role, viewer.id, mutation, router, t],
  );

  const dialog = <StartVisitDialog patient={target} onOpenChange={(o) => !o && setTarget(null)} />;
  return { start, pending: mutation.isPending, dialog };
}
