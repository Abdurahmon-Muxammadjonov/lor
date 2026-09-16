'use client';

import * as React from 'react';
import Link from 'next/link';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { CalendarDays, ExternalLink, Lock, MessageSquareText, Stethoscope } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale } from '@/i18n/client';
import { api } from '@/lib/api/client';
import { fmtWeekday } from '@/lib/date';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/shared/status-badge';
import {
  atTz,
  durationMinutes,
  formatDateKey,
  isLockedForMove,
  keyToLocalDate,
  localDateToKey,
  tzDateKey,
  tzTime,
} from '@/lib/appointments/availability';
import {
  AppointmentFormSchema,
  type AppointmentFormValues,
  type AppointmentStatusCode,
  type UpdateAppointmentInput,
} from '@/lib/appointments/schemas';
import type { AppointmentDTO, ClinicCalendarConfig, DoctorOption } from '@/lib/appointments/types';
import { appointmentErrorMessage, durationOptions } from './constants';
import { PatientPicker, type PatientLite } from './patient-picker';
import { SlotGrid } from './slot-grid';
import { appointmentKeys } from './use-appointments';

export type AppointmentDialogMode =
  | {
      kind: 'create';
      doctorId?: string | null;
      date: string;
      time?: string | null;
      patient?: PatientLite | null;
    }
  | { kind: 'edit'; appointment: AppointmentDTO };

export interface AppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: AppointmentDialogMode | null;
  doctors: DoctorOption[];
  clinic: ClinicCalendarConfig;
  todayKey: string;
  onSaved?: (a: AppointmentDTO) => void;
}

type SavedResponse = AppointmentDTO & { smsQueued?: boolean };

function defaultsFor(
  mode: AppointmentDialogMode | null,
  clinic: ClinicCalendarConfig,
  todayKey: string,
): AppointmentFormValues {
  if (mode?.kind === 'edit') {
    const a = mode.appointment;
    return {
      patientId: a.patientId,
      doctorId: a.doctorId,
      date: tzDateKey(new Date(a.startAt)),
      time: tzTime(a.startAt),
      durationMin: durationMinutes(a.startAt, a.endAt),
      note: a.note ?? '',
    };
  }
  return {
    patientId: mode?.patient?.id ?? '',
    doctorId: mode?.doctorId ?? '',
    date: mode?.date ?? todayKey,
    time: mode?.time ?? '',
    durationMin: clinic.slotMinutes,
    note: '',
  };
}

function patientFor(mode: AppointmentDialogMode | null): PatientLite | null {
  if (!mode) return null;
  if (mode.kind === 'edit') {
    const p = mode.appointment.patient;
    return {
      id: p.id,
      fullName: p.fullName,
      cardNumber: p.cardNumber,
      phone: p.phone,
      gender: p.gender,
      smsConsent: p.smsConsent,
    };
  }
  return mode.patient ?? null;
}

/**
 * Yangi yozilish / tahrirlash dialogi: bemor (qidiruv), shifokor, sana, davomiylik, boʻsh vaqtlar toʻri, izoh.
 * Tahrirlashda ARRIVED/DONE/CANCELLED/NO_SHOW holatida faqat izoh oʻzgartiriladi.
 */
export function AppointmentDialog({
  open,
  onOpenChange,
  mode,
  doctors,
  clinic,
  todayKey,
  onSaved,
}: AppointmentDialogProps) {
  const { t, locale } = useLocale();
  const qc = useQueryClient();
  const isEdit = mode?.kind === 'edit';
  const editing = mode?.kind === 'edit' ? mode.appointment : null;
  const status = editing ? (editing.status as AppointmentStatusCode) : null;
  const locked = status ? isLockedForMove(status) : false;
  const [patient, setPatient] = React.useState<PatientLite | null>(() => patientFor(mode));
  const [dateOpen, setDateOpen] = React.useState(false);
  const ids = React.useId();

  const form = useForm<AppointmentFormValues>({
    resolver: zodResolver(AppointmentFormSchema),
    defaultValues: defaultsFor(mode, clinic, todayKey),
    mode: 'onSubmit',
  });
  const { register, handleSubmit, control, watch, setValue, reset, formState } = form;
  const { errors, isSubmitting } = formState;

  // Har ochilishda formani rejimga mos boshlangʻich qiymatlar bilan tiklash
  React.useEffect(() => {
    if (!open) return;
    reset(defaultsFor(mode, clinic, todayKey));
    setPatient(patientFor(mode));
  }, [open, mode, clinic, todayKey, reset]);

  React.useEffect(() => {
    setValue('patientId', patient?.id ?? '', { shouldValidate: formState.isSubmitted });
  }, [patient, setValue, formState.isSubmitted]);

  const doctorId = watch('doctorId');
  const date = watch('date');
  const time = watch('time');
  const durationMin = watch('durationMin');
  const note = watch('note');

  const durations = React.useMemo(() => durationOptions(clinic.slotMinutes), [clinic.slotMinutes]);
  const minDate = keyToLocalDate(todayKey);

  const save = useMutation<SavedResponse, Error, AppointmentFormValues>({
    mutationFn: async (v) => {
      const startAt = atTz(v.date, v.time).toISOString();
      const noteValue = v.note.trim() || null;
      if (!editing) {
        return api.post<SavedResponse>('/api/appointments', {
          patientId: v.patientId,
          doctorId: v.doctorId,
          startAt,
          durationMin: v.durationMin,
          note: noteValue,
        });
      }
      const patch: UpdateAppointmentInput = {};
      if (!locked) {
        if (startAt !== new Date(editing.startAt).toISOString()) patch.startAt = startAt;
        if (v.doctorId !== editing.doctorId) patch.doctorId = v.doctorId;
        if (v.durationMin !== durationMinutes(editing.startAt, editing.endAt))
          patch.durationMin = v.durationMin;
      }
      if (noteValue !== (editing.note ?? null)) patch.note = noteValue;
      if (Object.keys(patch).length === 0) return editing;
      return api.patch<SavedResponse>(`/api/appointments/${editing.id}`, patch);
    },
    onSuccess: async (res) => {
      if (!editing)
        toast.success(res.smsQueued ? t('appointments.toast.createdSms') : t('appointments.toast.created'));
      else if (res !== editing) toast.success(t('appointments.toast.updated'));
      await qc.invalidateQueries({ queryKey: appointmentKeys.all });
      onSaved?.(res);
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error(appointmentErrorMessage(t, err));
      void qc.invalidateQueries({ queryKey: ['appointments', 'slots'] });
    },
  });

  const busy = isSubmitting || save.isPending;
  const dateLabel = date
    ? `${formatDateKey(date)} · ${fmtWeekday(keyToLocalDate(date), locale)}`
    : t('appointments.dialog.date');

  const smsHint = (() => {
    if (isEdit) return null;
    if (!clinic.smsEnabled) return { key: 'appointments.dialog.smsDisabled', muted: true };
    if (patient && patient.smsConsent === false)
      return { key: 'appointments.dialog.smsNoConsent', muted: true };
    return { key: 'appointments.dialog.smsWillBeSent', muted: false };
  })();

  return (
    <Dialog open={open} onOpenChange={(o) => (busy ? undefined : onOpenChange(o))}>
      <DialogContent className="max-w-xl gap-0 p-0 sm:max-w-2xl">
        <form
          onSubmit={handleSubmit((v) => save.mutate(v))}
          noValidate
          className="flex max-h-[calc(100dvh-2rem)] flex-col"
        >
          <DialogHeader className="border-b border-line px-6 py-4 pr-12 text-left">
            <div className="flex flex-wrap items-center gap-2">
              <DialogTitle>
                {isEdit ? t('appointments.dialog.editTitle') : t('appointments.dialog.createTitle')}
              </DialogTitle>
              {status ? <StatusBadge kind="appointment" status={status} /> : null}
            </div>
            <DialogDescription>
              {isEdit ? t('appointments.dialog.editDescription') : t('appointments.dialog.createDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="scrollbar-thin flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {/* Bemor */}
            <div className="space-y-1.5">
              <Label htmlFor={`${ids}-patient`} required={!isEdit}>
                {t('appointments.dialog.patient')}
              </Label>
              <PatientPicker
                id={`${ids}-patient`}
                value={patient}
                onChange={setPatient}
                locked={isEdit}
                disabled={busy}
                invalid={!!errors.patientId}
              />
              {errors.patientId ? (
                <p role="alert" className="text-xs text-danger">
                  {t(errors.patientId.message ?? 'common.validation.required')}
                </p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Shifokor */}
              <div className="space-y-1.5">
                <Label htmlFor={`${ids}-doctor`} required>
                  {t('appointments.dialog.doctor')}
                </Label>
                <Controller
                  control={control}
                  name="doctorId"
                  render={({ field }) => (
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v);
                        // Shifokor oʻzgarsa boʻsh vaqtlar boshqa — tanlangan vaqt tozalanadi (asl shifokorga qaytsa tiklanadi)
                        setValue('time', editing && v === editing.doctorId ? tzTime(editing.startAt) : '', {
                          shouldValidate: false,
                        });
                      }}
                      disabled={busy || locked}
                    >
                      <SelectTrigger id={`${ids}-doctor`} aria-invalid={!!errors.doctorId} className="h-10">
                        <SelectValue placeholder={t('appointments.dialog.selectDoctor')} />
                      </SelectTrigger>
                      <SelectContent>
                        {doctors.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            <span className="inline-flex items-center gap-2">
                              <span
                                aria-hidden="true"
                                className="size-2.5 rounded-full"
                                style={{ backgroundColor: d.color }}
                              />
                              <span className="truncate">{d.fullName}</span>
                              {d.room ? <span className="text-xs text-text-muted">· {d.room}</span> : null}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.doctorId ? (
                  <p role="alert" className="text-xs text-danger">
                    {t(errors.doctorId.message ?? 'common.validation.required')}
                  </p>
                ) : null}
              </div>

              {/* Sana */}
              <div className="space-y-1.5">
                <Label htmlFor={`${ids}-date`} required>
                  {t('appointments.dialog.date')}
                </Label>
                <Popover open={dateOpen} onOpenChange={setDateOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      id={`${ids}-date`}
                      disabled={busy || locked}
                      data-invalid={errors.date ? 'true' : undefined}
                      aria-describedby={errors.date ? `${ids}-date-error` : undefined}
                      className={cn(
                        'flex h-10 w-full items-center gap-2 rounded-md border border-line bg-bg-elevated px-3 text-left text-sm text-text shadow-sm transition-[border-color,box-shadow]',
                        'hover:border-[#2B3A57] focus:outline-none focus-visible:border-accent focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-50',
                      )}
                    >
                      <CalendarDays className="size-4 shrink-0 text-accent" aria-hidden="true" />
                      <span className="truncate capitalize">{dateLabel}</span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-auto p-2">
                    <Calendar
                      value={date ? keyToLocalDate(date) : undefined}
                      min={minDate}
                      onChange={(d) => {
                        const key = localDateToKey(d);
                        setValue('date', key, { shouldValidate: true });
                        setValue(
                          'time',
                          editing && key === tzDateKey(new Date(editing.startAt))
                            ? tzTime(editing.startAt)
                            : '',
                          { shouldValidate: false },
                        );
                        setDateOpen(false);
                      }}
                    />
                  </PopoverContent>
                </Popover>
                {errors.date ? (
                  <p id={`${ids}-date-error`} role="alert" className="text-xs text-danger">
                    {t(errors.date.message ?? 'common.validation.date')}
                  </p>
                ) : null}
              </div>
            </div>

            {/* Davomiylik */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${ids}-duration`}>{t('appointments.dialog.duration')}</Label>
                <Controller
                  control={control}
                  name="durationMin"
                  render={({ field }) => (
                    <Select
                      value={String(field.value)}
                      onValueChange={(v) => field.onChange(Number(v))}
                      disabled={busy || locked}
                    >
                      <SelectTrigger id={`${ids}-duration`} className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {durations.map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {t('appointments.card.minutes', { n })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              {locked ? (
                <p className="flex items-center gap-2 self-end rounded-md border border-line bg-card/60 px-3 py-2 text-xs text-text-muted">
                  <Lock className="size-3.5 shrink-0" aria-hidden="true" />
                  {t('appointments.dialog.lockedHint')}
                </p>
              ) : time ? (
                <p className="self-end text-sm text-text-muted">
                  {t('appointments.dialog.selectedTime', {
                    time: `${time}–${tzTime(new Date(atTz(date || todayKey, time).getTime() + durationMin * 60000))}`,
                  })}
                </p>
              ) : null}
            </div>

            {/* Boʻsh vaqtlar */}
            {!locked ? (
              <div className="space-y-1.5">
                <Label id={`${ids}-slots`} required>
                  {t('appointments.dialog.freeSlots')}
                </Label>
                <SlotGrid
                  doctorId={doctorId || null}
                  date={date}
                  durationMin={durationMin}
                  excludeId={editing?.id}
                  value={time || null}
                  currentTime={editing ? tzTime(editing.startAt) : null}
                  onChange={(v) => setValue('time', v, { shouldValidate: true })}
                  disabled={busy}
                  labelId={`${ids}-slots`}
                />
                {errors.time ? (
                  <p role="alert" className="text-xs text-danger">
                    {t(errors.time.message ?? 'appointments.validation.time')}
                  </p>
                ) : null}
              </div>
            ) : null}

            {/* Izoh */}
            <div className="space-y-1.5">
              <Label htmlFor={`${ids}-note`}>{t('appointments.dialog.note')}</Label>
              <Textarea
                id={`${ids}-note`}
                rows={2}
                maxLength={500}
                placeholder={t('appointments.dialog.notePlaceholder')}
                disabled={busy}
                aria-invalid={!!errors.note}
                {...register('note')}
              />
              <div className="flex justify-between text-[11px] text-text-muted">
                {errors.note ? (
                  <span role="alert" className="text-danger">
                    {t(errors.note.message ?? 'common.validation.max', { n: 500 })}
                  </span>
                ) : (
                  <span />
                )}
                <span className="tabular">{note.length}/500</span>
              </div>
            </div>

            {smsHint ? (
              <p
                className={cn(
                  'flex items-center gap-2 text-xs',
                  smsHint.muted ? 'text-text-muted' : 'text-[#00FFB2]',
                )}
              >
                <MessageSquareText className="size-3.5 shrink-0" aria-hidden="true" />
                {t(smsHint.key)}
              </p>
            ) : null}

            {editing ? (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-text-muted">
                {editing.createdBy ? (
                  <span>
                    {t('appointments.card.createdBy')}:{' '}
                    <span className="text-text">{editing.createdBy.fullName}</span>
                  </span>
                ) : null}
                <span>
                  {t('appointments.card.createdAt')}:{' '}
                  <span className="tabular text-text">
                    {formatDateKey(tzDateKey(new Date(editing.createdAt)))} {tzTime(editing.createdAt)}
                  </span>
                </span>
                {editing.visit ? (
                  <Link
                    href={`/dashboard/visits/${editing.visit.id}`}
                    className="inline-flex items-center gap-1 text-accent hover:underline"
                  >
                    <Stethoscope className="size-3.5" aria-hidden="true" />
                    {t('appointments.dialog.openVisit')}
                    <ExternalLink className="size-3" aria-hidden="true" />
                  </Link>
                ) : null}
              </div>
            ) : null}
          </div>

          <DialogFooter className="border-t border-line px-6 py-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="gradient" loading={busy}>
              {isEdit ? t('common.saveChanges') : t('common.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
