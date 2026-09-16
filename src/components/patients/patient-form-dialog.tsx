'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  TriangleAlert,
  CircleCheckBig,
  ExternalLink,
  Stethoscope,
  UserPlus,
  UserRoundPen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/client';
import { ApiClientError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Segmented } from '@/components/ui/segmented';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  EMPTY_PATIENT_FORM,
  PatientFormSchema,
  toPatientPayload,
  type PatientFormValues,
  type PatientPayload,
} from '@/lib/patients/schemas';
import { checkBirthDate, keyToDisplay, patientTypeFor, toDateKey } from '@/lib/patients/age';
import { formatAge } from '@/lib/patients/format';
import { formatPhoneMask } from '@/lib/patients/phone-mask';
import {
  isDuplicatePhoneDetails,
  type DuplicatePhoneDetails,
  type PatientRowDTO,
} from '@/lib/patients/types';
import { BirthDateField } from './birth-date-field';
import { PhoneInput } from './phone-input';
import type { PatientRef } from './start-visit-dialog';
import { patientErrorMessage, useCreatePatient, useUpdatePatient } from './use-patients';

export interface PatientFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  /** Tahrirlash rejimida — joriy qiymatlar */
  patient?: PatientRowDTO | null;
  childAgeLimit: number;
  /** "Qabulni boshlash" tugmalari (visits.create ruxsati) */
  canStartVisit?: boolean;
  onCreated?: (row: PatientRowDTO) => void;
  onUpdated?: (row: PatientRowDTO) => void;
  onStartVisit?: (p: PatientRef) => void;
}

type Stage = 'form' | 'done';
type Intent = 'save' | 'visit';

const FORM_FIELDS: (keyof PatientFormValues)[] = [
  'fullName',
  'birthDate',
  'gender',
  'phone',
  'phone2',
  'address',
  'allergies',
  'chronic',
  'notes',
  'source',
  'smsConsent',
];

function isFormField(k: string): k is keyof PatientFormValues {
  return (FORM_FIELDS as string[]).includes(k);
}

export function patientToFormValues(p: PatientRowDTO): PatientFormValues {
  return {
    fullName: p.fullName,
    birthDate: keyToDisplay(toDateKey(p.birthDate)),
    gender: p.gender,
    phone: formatPhoneMask(p.phone),
    phone2: p.phone2 ? formatPhoneMask(p.phone2) : '',
    address: p.address ?? '',
    allergies: p.allergies ?? '',
    chronic: p.chronic ?? '',
    notes: p.notes ?? '',
    source: p.source ?? '',
    smsConsent: p.smsConsent,
  };
}

interface FieldProps {
  id: string;
  label: React.ReactNode;
  required?: boolean;
  error?: string;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

function Field({ id, label, required, error, hint, className, children }: FieldProps) {
  const t = useT();
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-danger">
          {t(error)}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="col-span-full flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
      <span>{children}</span>
      <span aria-hidden="true" className="h-px flex-1 bg-line" />
    </h3>
  );
}

/**
 * Bemor formasi (yaratish / tahrirlash): RHF + zod, tugʻilgan sana (maska + kalendar), telefon maskasi,
 * takroriy telefon ziddiyati (409) → mavjud bemor havolasi + "Baribir qoʻshish", yaratilgach — qabulni boshlash taklifi.
 */
export function PatientFormDialog({
  open,
  onOpenChange,
  mode,
  patient,
  childAgeLimit,
  canStartVisit = false,
  onCreated,
  onUpdated,
  onStartVisit,
}: PatientFormDialogProps) {
  const t = useT();
  const router = useRouter();
  const create = useCreatePatient();
  const update = useUpdatePatient(patient?.id ?? '');
  const pending = create.isPending || update.isPending;

  const [stage, setStage] = React.useState<Stage>('form');
  const [createdRow, setCreatedRow] = React.useState<PatientRowDTO | null>(null);
  const [duplicate, setDuplicate] = React.useState<DuplicatePhoneDetails | null>(null);
  const intentRef = React.useRef<Intent>('save');

  const form = useForm<PatientFormValues>({
    resolver: zodResolver(PatientFormSchema),
    defaultValues: EMPTY_PATIENT_FORM,
    mode: 'onBlur',
  });
  const { register, control, handleSubmit, reset, setError, setFocus, watch, formState } = form;
  const { errors } = formState;

  // Ochilganda formani tozalash / toʻldirish
  React.useEffect(() => {
    if (!open) return;
    reset(mode === 'edit' && patient ? patientToFormValues(patient) : EMPTY_PATIENT_FORM);
    setStage('form');
    setCreatedRow(null);
    setDuplicate(null);
    intentRef.current = 'save';
    const timer = window.setTimeout(() => setFocus('fullName'), 50);
    return () => window.clearTimeout(timer);
  }, [open, mode, patient, reset, setFocus]);

  const birthValue = watch('birthDate');
  const ageHint = React.useMemo(() => {
    if (!birthValue || checkBirthDate(birthValue) !== null) return null;
    const type = patientTypeFor(birthValue, childAgeLimit);
    return t('patients.form.ageHint', {
      age: formatAge(birthValue, t),
      type: t(`common.patientType.${type}`),
    });
  }, [birthValue, childAgeLimit, t]);

  const applyServerErrors = (err: unknown): boolean => {
    if (!(err instanceof ApiClientError)) return false;
    if (err.code === 'CONFLICT' && isDuplicatePhoneDetails(err.details)) {
      setDuplicate(err.details);
      return true;
    }
    if (
      err.code === 'VALIDATION' &&
      err.details &&
      typeof err.details === 'object' &&
      'fieldErrors' in err.details
    ) {
      const fieldErrors =
        (err.details as { fieldErrors?: Record<string, string[] | undefined> }).fieldErrors ?? {};
      let applied = false;
      for (const [key, msgs] of Object.entries(fieldErrors)) {
        const msg = msgs?.[0];
        if (isFormField(key) && msg) {
          setError(key, { type: 'server', message: msg });
          applied = true;
        }
      }
      return applied;
    }
    return false;
  };

  const submit = async (values: PatientFormValues, force = false) => {
    const payload: PatientPayload = toPatientPayload(values, force);
    setDuplicate(null);
    try {
      if (mode === 'edit' && patient) {
        const row = await update.mutateAsync(payload);
        toast.success(t('patients.toast.updated'));
        onUpdated?.(row);
        onOpenChange(false);
        return;
      }
      const row = await create.mutateAsync(payload);
      toast.success(t('patients.toast.created'));
      onCreated?.(row);
      if (intentRef.current === 'visit' && onStartVisit) {
        onOpenChange(false);
        onStartVisit({ id: row.id, fullName: row.fullName });
        return;
      }
      setCreatedRow(row);
      setStage('done');
    } catch (err) {
      if (!applyServerErrors(err)) toast.error(patientErrorMessage(err, t));
    } finally {
      intentRef.current = 'save';
    }
  };

  const onSubmit = handleSubmit((values) => submit(values, false));
  const forceSubmit = handleSubmit((values) => submit(values, true));

  const close = () => {
    if (pending) return;
    onOpenChange(false);
  };

  const isEdit = mode === 'edit';
  const title = isEdit ? t('patients.form.editTitle') : t('patients.form.createTitle');

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-2xl" onInteractOutside={(e) => pending && e.preventDefault()}>
        {stage === 'done' && createdRow ? (
          <div className="flex flex-col items-center gap-5 py-2 text-center">
            <span className="flex size-16 items-center justify-center rounded-full border border-[#00FFB2]/30 bg-[#00FFB2]/10 text-[#00FFB2] shadow-glow-mint">
              <CircleCheckBig className="size-8" aria-hidden="true" />
            </span>
            <DialogHeader className="items-center text-center sm:text-center">
              <DialogTitle>{t('patients.afterCreate.title')}</DialogTitle>
              <DialogDescription>
                {t('patients.afterCreate.description', {
                  name: createdRow.fullName,
                  card: createdRow.cardNumber,
                })}
              </DialogDescription>
            </DialogHeader>
            <Badge variant="accent" className="tabular text-sm">
              {createdRow.cardNumber}
            </Badge>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
              {canStartVisit && onStartVisit ? (
                <Button
                  type="button"
                  variant="gradient"
                  size="lg"
                  onClick={() => {
                    onOpenChange(false);
                    onStartVisit({ id: createdRow.id, fullName: createdRow.fullName });
                  }}
                >
                  <Stethoscope aria-hidden="true" />
                  {t('patients.afterCreate.startVisit')}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => {
                  onOpenChange(false);
                  router.push(`/dashboard/patients/${createdRow.id}`);
                }}
              >
                <ExternalLink aria-hidden="true" />
                {t('patients.afterCreate.openCard')}
              </Button>
              <Button type="button" variant="ghost" size="lg" onClick={() => onOpenChange(false)}>
                {t('patients.afterCreate.later')}
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} noValidate className="space-y-5">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {isEdit ? (
                  <UserRoundPen className="size-5 text-accent" aria-hidden="true" />
                ) : (
                  <UserPlus className="size-5 text-accent" aria-hidden="true" />
                )}
                {title}
                {isEdit && patient ? (
                  <Badge variant="outline" className="tabular">
                    {patient.cardNumber}
                  </Badge>
                ) : null}
              </DialogTitle>
              <DialogDescription>
                {isEdit ? t('patients.form.editDescription') : t('patients.form.createDescription')}
              </DialogDescription>
            </DialogHeader>

            {duplicate ? (
              <Alert variant="warning">
                <TriangleAlert aria-hidden="true" />
                <AlertTitle>{t('patients.duplicate.title')}</AlertTitle>
                <AlertDescription>
                  <p>
                    {t('patients.duplicate.description', {
                      name: duplicate.existingName,
                      card: duplicate.existingCard,
                    })}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button asChild type="button" variant="outline" size="sm">
                      <Link href={`/dashboard/patients/${duplicate.existingId}`}>
                        <ExternalLink aria-hidden="true" />
                        {t('patients.duplicate.open')}
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => void forceSubmit()}
                      loading={pending}
                    >
                      {t('patients.duplicate.force')}
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <SectionTitle>{t('patients.form.section.main')}</SectionTitle>

              <Field
                id="pf-fullName"
                label={t('patients.form.fullName')}
                required
                error={errors.fullName?.message}
                className="sm:col-span-2"
              >
                <Input
                  id="pf-fullName"
                  autoComplete="off"
                  autoCapitalize="words"
                  placeholder={t('patients.form.fullNamePlaceholder')}
                  aria-invalid={!!errors.fullName || undefined}
                  aria-describedby={errors.fullName ? 'pf-fullName-error' : undefined}
                  disabled={pending}
                  {...register('fullName')}
                />
              </Field>

              <Field
                id="pf-birthDate"
                label={t('patients.form.birthDate')}
                required
                error={errors.birthDate?.message}
                hint={ageHint}
              >
                <Controller
                  control={control}
                  name="birthDate"
                  render={({ field }) => (
                    <BirthDateField
                      id="pf-birthDate"
                      ref={field.ref}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      invalid={!!errors.birthDate}
                      describedBy={
                        errors.birthDate ? 'pf-birthDate-error' : ageHint ? 'pf-birthDate-hint' : undefined
                      }
                      disabled={pending}
                      placeholder={t('patients.form.birthDatePlaceholder')}
                      pickLabel={t('patients.form.pickDate')}
                      yearLabel={t('patients.form.year')}
                      monthLabel={t('patients.form.month')}
                    />
                  )}
                />
              </Field>

              <Field id="pf-gender" label={t('patients.form.gender')} required error={errors.gender?.message}>
                <Controller
                  control={control}
                  name="gender"
                  render={({ field }) => (
                    <Segmented
                      value={field.value}
                      onChange={field.onChange}
                      fullWidth
                      variant="accent"
                      ariaLabel={t('patients.form.gender')}
                      disabled={pending}
                      options={[
                        { value: 'MALE', label: t('common.gender.MALE') },
                        { value: 'FEMALE', label: t('common.gender.FEMALE') },
                      ]}
                    />
                  )}
                />
              </Field>

              <SectionTitle>{t('patients.form.section.contacts')}</SectionTitle>

              <Field id="pf-phone" label={t('patients.form.phone')} required error={errors.phone?.message}>
                <Controller
                  control={control}
                  name="phone"
                  render={({ field }) => (
                    <PhoneInput
                      id="pf-phone"
                      ref={field.ref}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      aria-invalid={!!errors.phone || undefined}
                      aria-describedby={errors.phone ? 'pf-phone-error' : undefined}
                      disabled={pending}
                    />
                  )}
                />
              </Field>

              <Field id="pf-phone2" label={t('patients.form.phone2')} error={errors.phone2?.message}>
                <Controller
                  control={control}
                  name="phone2"
                  render={({ field }) => (
                    <PhoneInput
                      id="pf-phone2"
                      ref={field.ref}
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      aria-invalid={!!errors.phone2 || undefined}
                      aria-describedby={errors.phone2 ? 'pf-phone2-error' : undefined}
                      disabled={pending}
                    />
                  )}
                />
              </Field>

              <Field id="pf-address" label={t('patients.form.address')} error={errors.address?.message}>
                <Input
                  id="pf-address"
                  autoComplete="street-address"
                  placeholder={t('patients.form.addressPlaceholder')}
                  aria-invalid={!!errors.address || undefined}
                  disabled={pending}
                  {...register('address')}
                />
              </Field>

              <Field id="pf-source" label={t('patients.form.source')} error={errors.source?.message}>
                <Input
                  id="pf-source"
                  autoComplete="off"
                  placeholder={t('patients.form.sourcePlaceholder')}
                  aria-invalid={!!errors.source || undefined}
                  disabled={pending}
                  {...register('source')}
                />
              </Field>

              <SectionTitle>{t('patients.form.section.medical')}</SectionTitle>

              <Field id="pf-allergies" label={t('patients.form.allergies')} error={errors.allergies?.message}>
                <Textarea
                  id="pf-allergies"
                  rows={2}
                  placeholder={t('patients.form.allergiesPlaceholder')}
                  aria-invalid={!!errors.allergies || undefined}
                  disabled={pending}
                  className="min-h-[64px]"
                  {...register('allergies')}
                />
              </Field>

              <Field id="pf-chronic" label={t('patients.form.chronic')} error={errors.chronic?.message}>
                <Textarea
                  id="pf-chronic"
                  rows={2}
                  placeholder={t('patients.form.chronicPlaceholder')}
                  aria-invalid={!!errors.chronic || undefined}
                  disabled={pending}
                  className="min-h-[64px]"
                  {...register('chronic')}
                />
              </Field>

              <Field
                id="pf-notes"
                label={t('patients.form.notes')}
                error={errors.notes?.message}
                className="sm:col-span-2"
              >
                <Textarea
                  id="pf-notes"
                  rows={2}
                  placeholder={t('patients.form.notesPlaceholder')}
                  aria-invalid={!!errors.notes || undefined}
                  disabled={pending}
                  className="min-h-[64px]"
                  {...register('notes')}
                />
              </Field>

              <div className="flex items-start gap-3 rounded-lg border border-line bg-bg-elevated p-3 sm:col-span-2">
                <Controller
                  control={control}
                  name="smsConsent"
                  render={({ field }) => (
                    <Switch
                      id="pf-smsConsent"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={pending}
                      aria-describedby="pf-smsConsent-hint"
                    />
                  )}
                />
                <div className="space-y-0.5">
                  <Label htmlFor="pf-smsConsent" className="cursor-pointer">
                    {t('patients.form.smsConsent')}
                  </Label>
                  <p id="pf-smsConsent-hint" className="text-xs text-text-muted">
                    {t('patients.form.smsConsentHint')}
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button type="button" variant="ghost" onClick={close} disabled={pending}>
                {t('common.cancel')}
              </Button>
              {!isEdit && canStartVisit && onStartVisit ? (
                <Button
                  type="submit"
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    intentRef.current = 'visit';
                  }}
                >
                  <Stethoscope aria-hidden="true" />
                  {t('patients.form.createAndVisit')}
                </Button>
              ) : null}
              <Button
                type="submit"
                variant="gradient"
                loading={pending}
                onClick={() => (intentRef.current = 'save')}
              >
                {isEdit ? <UserRoundPen aria-hidden="true" /> : <UserPlus aria-hidden="true" />}
                {isEdit ? t('patients.form.save') : t('patients.form.create')}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
