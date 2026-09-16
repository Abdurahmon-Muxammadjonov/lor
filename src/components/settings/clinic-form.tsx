'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Building2, Clock3, Contact, Receipt, Ticket } from 'lucide-react';
import { useLocale } from '@/i18n/client';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  CHILD_AGE_MAX,
  CHILD_AGE_MIN,
  ClinicProfileSchema,
  ROUND_TO_VALUES,
  SLOT_MAX,
  SLOT_MIN,
  TIMEZONES,
  type ClinicProfileDTO,
  type ClinicProfileInput,
  type ClinicProfilePatch,
} from '@/lib/settings/schemas';
import { formatPhone } from '@/lib/utils';
import { Field, FormCard, InputWithUnit, SectionHeading, fieldAria } from './form-field';
import { SaveBar } from './save-bar';
import { IntegrationsCard } from './integrations-card';
import { settingsErrorMessage, useClinicProfile, useUpdateClinicProfile } from './use-settings';

export interface ClinicFormProps {
  canWrite: boolean;
}

const FORM_ID = 'settings-clinic-form';

function toValues(p: ClinicProfileDTO): ClinicProfileInput {
  const roundTo = (ROUND_TO_VALUES as readonly number[]).includes(p.roundTo) ? (p.roundTo as ClinicProfileInput['roundTo']) : 100;
  const timezone = (TIMEZONES as readonly string[]).includes(p.timezone) ? (p.timezone as ClinicProfileInput['timezone']) : 'Asia/Tashkent';
  return {
    name: p.name,
    phone: formatPhone(p.phone) || p.phone,
    email: p.email,
    address: p.address,
    city: p.city,
    logoUrl: p.logoUrl,
    childAgeLimit: p.childAgeLimit,
    roundTo,
    workStart: p.workStart,
    workEnd: p.workEnd,
    slotMinutes: p.slotMinutes,
    ticketFooter: p.ticketFooter,
    timezone,
  };
}

/** Faqat oʻzgargan maydonlar (PATCH) */
function toPatch(values: ClinicProfileInput, base: ClinicProfileInput): ClinicProfilePatch {
  const patch: ClinicProfilePatch = {};
  for (const key of Object.keys(values) as (keyof ClinicProfileInput)[]) {
    if (values[key] !== base[key]) {
      (patch as Record<string, unknown>)[key] = values[key];
    }
  }
  return patch;
}

export function ClinicForm({ canWrite }: ClinicFormProps) {
  const { t, locale } = useLocale();
  const query = useClinicProfile();
  const update = useUpdateClinicProfile();

  const form = useForm<ClinicProfileInput>({
    resolver: zodResolver(ClinicProfileSchema),
    mode: 'onTouched',
    defaultValues: query.data ? toValues(query.data) : undefined,
  });
  const { register, control, handleSubmit, reset, formState } = form;
  const { errors, isDirty, isSubmitting } = formState;

  // Serverdan kelgan qiymatlar (birinchi yuklash yoki tashqi oʻzgarish) — forma dirty boʻlmasa yangilanadi
  React.useEffect(() => {
    if (query.data && !isDirty) reset(toValues(query.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);

  React.useEffect(() => {
    if (query.isError) toast.error(settingsErrorMessage(query.error, t, locale), { id: 'settings-clinic-load' });
  }, [query.isError, query.error, t, locale]);

  const onSubmit = handleSubmit(async (values) => {
    if (!query.data) return;
    const patch = toPatch(values, toValues(query.data));
    if (Object.keys(patch).length === 0) {
      reset(values);
      return;
    }
    try {
      const saved = await update.mutateAsync(patch);
      reset(toValues(saved));
      toast.success(t('settings.toast.saved'));
    } catch (e) {
      toast.error(settingsErrorMessage(e, t, locale));
    }
  });

  const disabled = !canWrite || update.isPending;
  const hasErrors = Object.keys(errors).length > 0;

  if (query.isPending) return <ClinicFormSkeleton />;
  if (!query.data) return null;

  const profile = query.data;

  return (
    <form id={FORM_ID} onSubmit={onSubmit} noValidate className="space-y-5">
      <fieldset disabled={disabled} className="space-y-5">
        <FormCard
          title={t('settings.clinic.title')}
          description={t('settings.clinic.description')}
          actions={
            <>
              <Badge variant="outline" className="font-mono">
                {profile.slug}
              </Badge>
              <Badge variant="accent">{profile.plan}</Badge>
            </>
          }
        >
          <div className="grid gap-5 md:grid-cols-2">
            <SectionHeading>
              <Building2 className="mr-1 inline size-3.5" aria-hidden="true" />
              {t('settings.clinic.sections.general')}
            </SectionHeading>
            <Field id="clinic-name" label={t('settings.clinic.name')} required error={errors.name?.message} className="md:col-span-2">
              <Input id="clinic-name" autoComplete="organization" maxLength={120} {...register('name')} {...fieldAria('clinic-name', errors.name?.message)} />
            </Field>
            <Field id="clinic-logo" label={t('settings.clinic.logoUrl')} error={errors.logoUrl?.message} hint={t('settings.clinic.logoHint')} className="md:col-span-2">
              <Input id="clinic-logo" type="url" inputMode="url" placeholder="https://" maxLength={500} {...register('logoUrl')} {...fieldAria('clinic-logo', errors.logoUrl?.message, true)} />
            </Field>

            <SectionHeading>
              <Contact className="mr-1 inline size-3.5" aria-hidden="true" />
              {t('settings.clinic.sections.contacts')}
            </SectionHeading>
            <Field id="clinic-phone" label={t('settings.clinic.phone')} required error={errors.phone?.message}>
              <Input id="clinic-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+998 71 200 00 00" {...register('phone')} {...fieldAria('clinic-phone', errors.phone?.message)} />
            </Field>
            <Field id="clinic-email" label={t('settings.clinic.email')} error={errors.email?.message}>
              <Input id="clinic-email" type="email" inputMode="email" autoComplete="email" maxLength={160} {...register('email')} {...fieldAria('clinic-email', errors.email?.message)} />
            </Field>
            <Field id="clinic-city" label={t('settings.clinic.city')} error={errors.city?.message}>
              <Input id="clinic-city" autoComplete="address-level2" maxLength={80} {...register('city')} {...fieldAria('clinic-city', errors.city?.message)} />
            </Field>
            <Field id="clinic-timezone" label={t('settings.clinic.timezone')} error={errors.timezone?.message}>
              <Controller
                control={control}
                name="timezone"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange} disabled={disabled}>
                    <SelectTrigger id="clinic-timezone" {...fieldAria('clinic-timezone', errors.timezone?.message)}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
            <Field id="clinic-address" label={t('settings.clinic.address')} error={errors.address?.message} className="md:col-span-2">
              <Textarea id="clinic-address" rows={2} autoComplete="street-address" maxLength={300} {...register('address')} {...fieldAria('clinic-address', errors.address?.message)} />
            </Field>

            <SectionHeading>
              <Receipt className="mr-1 inline size-3.5" aria-hidden="true" />
              {t('settings.clinic.sections.pricing')}
            </SectionHeading>
            <Field id="clinic-child-age" label={t('settings.clinic.childAgeLimit')} error={errors.childAgeLimit?.message} hint={t('settings.clinic.childAgeHint')}>
              <InputWithUnit unit={t('settings.clinic.childAgeUnit')}>
                <Input
                  id="clinic-child-age"
                  type="number"
                  inputMode="numeric"
                  min={CHILD_AGE_MIN}
                  max={CHILD_AGE_MAX}
                  step={1}
                  className="tabular"
                  {...register('childAgeLimit', { valueAsNumber: true })}
                  {...fieldAria('clinic-child-age', errors.childAgeLimit?.message, true)}
                />
              </InputWithUnit>
            </Field>
            <Field id="clinic-round" label={t('settings.clinic.roundTo')} error={errors.roundTo?.message} hint={t('settings.clinic.roundToHint')}>
              <Controller
                control={control}
                name="roundTo"
                render={({ field }) => (
                  <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))} disabled={disabled}>
                    <SelectTrigger id="clinic-round" {...fieldAria('clinic-round', errors.roundTo?.message, true)}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROUND_TO_VALUES.map((v) => (
                        <SelectItem key={v} value={String(v)}>
                          {t(`settings.clinic.roundToOptions.${v}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>

            <SectionHeading>
              <Clock3 className="mr-1 inline size-3.5" aria-hidden="true" />
              {t('settings.clinic.sections.schedule')}
            </SectionHeading>
            <div className="grid grid-cols-2 gap-4">
              <Field id="clinic-work-start" label={t('settings.clinic.workStart')} error={errors.workStart?.message}>
                <Input id="clinic-work-start" type="time" step={300} className="tabular" {...register('workStart')} {...fieldAria('clinic-work-start', errors.workStart?.message)} />
              </Field>
              <Field id="clinic-work-end" label={t('settings.clinic.workEnd')} error={errors.workEnd?.message}>
                <Input id="clinic-work-end" type="time" step={300} className="tabular" {...register('workEnd')} {...fieldAria('clinic-work-end', errors.workEnd?.message)} />
              </Field>
            </div>
            <Field id="clinic-slot" label={t('settings.clinic.slotMinutes')} error={errors.slotMinutes?.message} hint={t('settings.clinic.slotHint')}>
              <InputWithUnit unit={t('settings.clinic.minutesUnit')}>
                <Input
                  id="clinic-slot"
                  type="number"
                  inputMode="numeric"
                  min={SLOT_MIN}
                  max={SLOT_MAX}
                  step={5}
                  className="tabular"
                  {...register('slotMinutes', { valueAsNumber: true })}
                  {...fieldAria('clinic-slot', errors.slotMinutes?.message, true)}
                />
              </InputWithUnit>
            </Field>

            <SectionHeading>
              <Ticket className="mr-1 inline size-3.5" aria-hidden="true" />
              {t('settings.clinic.sections.ticket')}
            </SectionHeading>
            <Field id="clinic-ticket-footer" label={t('settings.clinic.ticketFooter')} error={errors.ticketFooter?.message} hint={t('settings.clinic.ticketFooterHint')} className="md:col-span-2">
              <Input id="clinic-ticket-footer" maxLength={120} {...register('ticketFooter')} {...fieldAria('clinic-ticket-footer', errors.ticketFooter?.message, true)} />
            </Field>
          </div>
        </FormCard>
      </fieldset>

      <IntegrationsCard />

      {canWrite ? <SaveBar dirty={isDirty} saving={isSubmitting || update.isPending} hasErrors={hasErrors} onDiscard={() => reset()} formId={FORM_ID} /> : null}
    </form>
  );
}

export function ClinicFormSkeleton() {
  return (
    <div className="card-surface space-y-5 p-6" aria-busy="true" aria-hidden="true">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <div className="grid gap-5 md:grid-cols-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-10 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
