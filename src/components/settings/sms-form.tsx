'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { MessageSquareText, Send, Sparkles } from 'lucide-react';
import { useLocale } from '@/i18n/client';
import { cn, formatPhone } from '@/lib/utils';
import { fmtDate, fmtTime } from '@/lib/date';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  SMS_PLACEHOLDERS,
  SmsFormSchema,
  SmsTestSchema,
  type SmsFormValues,
  type SmsPatch,
  type SmsPlaceholder,
  type SmsTestInput,
} from '@/lib/settings/schemas';
import { insertPlaceholder, renderSmsTemplate, smsSegments } from '@/lib/settings/sms-preview';
import { ConfigBadge } from './config-badge';
import { Field, FormCard, InputWithUnit, SectionHeading, SwitchRow, fieldAria } from './form-field';
import { SaveBar } from './save-bar';
import { settingsErrorMessage, useClinicProfile, useSmsSection, useSmsTest, useUpdateSmsSection } from './use-settings';

export interface SmsFormProps {
  canWrite: boolean;
  clinicName?: string;
}

const FORM_ID = 'settings-sms-form';

const TEMPLATE_FIELDS = ['confirmTemplate', 'reminderTemplate', 'birthdayTemplate'] as const;
type TemplateField = (typeof TEMPLATE_FIELDS)[number];

const TEMPLATE_LABEL: Record<TemplateField, string> = {
  confirmTemplate: 'settings.sms.confirmTemplate',
  reminderTemplate: 'settings.sms.reminderTemplate',
  birthdayTemplate: 'settings.sms.birthdayTemplate',
};

function toPatch(values: SmsFormValues, base: SmsFormValues): SmsPatch {
  const patch: SmsPatch = {};
  for (const key of Object.keys(values) as (keyof SmsFormValues)[]) {
    if (values[key] !== base[key]) (patch as Record<string, unknown>)[key] = values[key];
  }
  return patch;
}

/** SMS boʻlimi: yoqish, yuboruvchi nomi, 3 ta shablon (oʻrin egallovchilar bilan) va test yuborish */
export function SmsForm({ canWrite, clinicName }: SmsFormProps) {
  const { t, locale } = useLocale();
  const query = useSmsSection();
  const update = useUpdateSmsSection();
  const clinic = useClinicProfile();
  const [testOpen, setTestOpen] = React.useState(false);

  const form = useForm<SmsFormValues>({
    resolver: zodResolver(SmsFormSchema),
    mode: 'onTouched',
    defaultValues: query.data?.sms,
  });
  const { register, control, handleSubmit, reset, watch, setValue, getValues, formState } = form;
  const { errors, isDirty, isSubmitting } = formState;

  React.useEffect(() => {
    if (query.data && !isDirty) reset(query.data.sms);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);

  React.useEffect(() => {
    if (query.isError) toast.error(settingsErrorMessage(query.error, t, locale), { id: 'settings-sms-load' });
  }, [query.isError, query.error, t, locale]);

  const values = watch();
  const [now] = React.useState(() => new Date());

  const previewVars = React.useMemo(
    () => ({
      clinic: clinic.data?.name ?? clinicName ?? '',
      name: t('settings.sms.previewVars.name'),
      date: fmtDate(now, locale),
      time: fmtTime(now, locale),
      doctor: t('settings.sms.previewVars.doctor'),
      phone: clinic.data ? formatPhone(clinic.data.phone) || clinic.data.phone : '',
    }),
    [clinic.data, clinicName, t, locale, now],
  );

  // Oʻrin egallovchini oxirgi faol shablon maydoniga kursor oʻrniga qoʻyish
  const refs = React.useRef<Partial<Record<TemplateField, HTMLTextAreaElement | null>>>({});
  const [activeField, setActiveField] = React.useState<TemplateField>('confirmTemplate');

  const insert = (key: SmsPlaceholder) => {
    const el = refs.current[activeField] ?? null;
    const current = getValues(activeField) ?? '';
    const start = el?.selectionStart ?? current.length;
    const end = el?.selectionEnd ?? start;
    const next = insertPlaceholder(current, key, start, end);
    setValue(activeField, next.text, { shouldDirty: true, shouldValidate: true });
    window.requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(next.caret, next.caret);
    });
  };

  const onSubmit = handleSubmit(async (vals) => {
    if (!query.data) return;
    const patch = toPatch(vals, query.data.sms);
    if (Object.keys(patch).length === 0) {
      reset(vals);
      return;
    }
    try {
      const saved = await update.mutateAsync(patch);
      reset(saved.sms);
      toast.success(t('settings.toast.saved'));
    } catch (e) {
      toast.error(settingsErrorMessage(e, t, locale));
    }
  });

  const disabled = !canWrite || update.isPending;
  const hasErrors = Object.keys(errors).length > 0;

  if (query.isPending) return <SmsFormSkeleton />;
  if (!query.data) return null;

  const configured = query.data.configured;

  return (
    <form id={FORM_ID} onSubmit={onSubmit} noValidate className="space-y-5">
      <fieldset disabled={disabled} className="space-y-5">
        <FormCard
          title={t('settings.sms.title')}
          description={t('settings.sms.description')}
          actions={
            <>
              <Badge variant="outline">Eskiz.uz</Badge>
              <ConfigBadge configured={configured} />
            </>
          }
        >
          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-3 md:col-span-2">
              <Controller
                control={control}
                name="enabled"
                render={({ field }) => (
                  <SwitchRow
                    id="sms-enabled"
                    label={t('settings.sms.enabled')}
                    hint={t('settings.sms.enabledHint')}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={disabled}
                  />
                )}
              />
              {!configured ? (
                <p className="text-xs text-warning" role="status">
                  {t('settings.sms.envHint')} — {t('settings.status.envHint')}
                </p>
              ) : null}
            </div>

            <Field id="sms-from" label={t('settings.sms.from')} error={errors.from?.message} hint={t('settings.sms.fromHint')}>
              <Input id="sms-from" maxLength={20} className="font-mono" {...register('from')} {...fieldAria('sms-from', errors.from?.message, true)} />
            </Field>
            <Field
              id="sms-reminder-hours"
              label={t('settings.sms.reminderHoursBefore')}
              error={errors.reminderHoursBefore?.message}
              hint={t('settings.sms.reminderHint')}
            >
              <InputWithUnit unit={t('settings.sms.hoursUnit')}>
                <Input
                  id="sms-reminder-hours"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={72}
                  step={1}
                  className="tabular"
                  {...register('reminderHoursBefore', { valueAsNumber: true })}
                  {...fieldAria('sms-reminder-hours', errors.reminderHoursBefore?.message, true)}
                />
              </InputWithUnit>
            </Field>

            <SectionHeading>
              <MessageSquareText className="mr-1 inline size-3.5" aria-hidden="true" />
              {t('settings.sms.templates')}
            </SectionHeading>

            <div className="md:col-span-2">
              <div className="rounded-lg border border-line bg-bg-elevated/60 p-3">
                <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                  <Sparkles className="size-3.5" aria-hidden="true" />
                  {t('settings.sms.placeholders.title')}
                </div>
                <ul className="flex flex-wrap gap-2">
                  {SMS_PLACEHOLDERS.map((key) => (
                    <li key={key}>
                      <button
                        type="button"
                        onClick={() => insert(key)}
                        disabled={disabled}
                        aria-label={t('settings.sms.placeholders.insert', { key: `{${key}}` })}
                        className={cn(
                          'flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs transition-colors',
                          'hover:border-primary/40 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          'disabled:cursor-not-allowed disabled:opacity-50',
                        )}
                      >
                        <code className="font-mono text-accent">{`{${key}}`}</code>
                        <span className="text-text-muted">{t(`settings.sms.placeholders.${key}`)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {TEMPLATE_FIELDS.map((name) => {
              const reg = register(name);
              const text = values[name] ?? '';
              const preview = renderSmsTemplate(text, previewVars);
              const cost = smsSegments(preview);
              return (
                <div key={name} className="space-y-2 md:col-span-2">
                  <Field id={`sms-${name}`} label={t(TEMPLATE_LABEL[name])} required error={errors[name]?.message}>
                    <Textarea
                      id={`sms-${name}`}
                      rows={2}
                      maxLength={320}
                      className="font-mono text-[13px] leading-5"
                      {...reg}
                      ref={(el) => {
                        reg.ref(el);
                        refs.current[name] = el;
                      }}
                      onFocus={() => setActiveField(name)}
                      {...fieldAria(`sms-${name}`, errors[name]?.message)}
                    />
                  </Field>
                  <div className="rounded-lg border border-line bg-bg-elevated/60 px-3 py-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">{t('settings.sms.preview')}</div>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-text">{preview || '—'}</p>
                    <p className="tabular mt-1 text-xs text-text-muted">
                      {t('settings.sms.segments', { len: cost.length, n: cost.segments, enc: cost.encoding })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </FormCard>
      </fieldset>

      <FormCard
        title={t('settings.sms.test.title')}
        description={t('settings.sms.test.description')}
        actions={
          <Button type="button" variant="gradient" onClick={() => setTestOpen(true)} disabled={!canWrite || !configured}>
            <Send aria-hidden="true" />
            {t('settings.sms.test.send')}
          </Button>
        }
      >
        <p className="text-xs text-text-muted">{t('settings.status.envHint')}</p>
      </FormCard>

      <SmsTestDialog open={testOpen} onOpenChange={setTestOpen} />

      {canWrite ? <SaveBar dirty={isDirty} saving={isSubmitting || update.isPending} hasErrors={hasErrors} onDiscard={() => reset()} formId={FORM_ID} /> : null}
    </form>
  );
}

interface SmsTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Test SMS: bitta raqamga darhol yuboriladi (Eskiz balansidan yechiladi) */
function SmsTestDialog({ open, onOpenChange }: SmsTestDialogProps) {
  const { t, locale } = useLocale();
  const send = useSmsTest();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SmsTestInput>({ resolver: zodResolver(SmsTestSchema), mode: 'onTouched', defaultValues: { phone: '' } });

  React.useEffect(() => {
    if (!open) reset({ phone: '' });
  }, [open, reset]);

  const onSubmit = handleSubmit(async (vals) => {
    try {
      const result = await send.mutateAsync({ phone: vals.phone });
      toast.success(t('settings.sms.test.sent', { phone: formatPhone(vals.phone) || vals.phone }), { description: result.text });
      onOpenChange(false);
    } catch (e) {
      toast.error(settingsErrorMessage(e, t, locale));
    }
  });

  return (
    <Dialog open={open} onOpenChange={(o) => (send.isPending ? undefined : onOpenChange(o))}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('settings.sms.test.title')}</DialogTitle>
          <DialogDescription>{t('settings.sms.test.description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sms-test-phone" required>
              {t('settings.sms.test.phone')}
            </Label>
            <Input
              id="sms-test-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+998 90 123 45 67"
              {...register('phone')}
              {...fieldAria('sms-test-phone', errors.phone?.message)}
            />
            {errors.phone?.message ? (
              <p id="sms-test-phone-error" role="alert" className="text-xs font-medium text-danger">
                {t(errors.phone.message)}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={send.isPending}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="gradient" loading={send.isPending}>
              {send.isPending ? null : <Send aria-hidden="true" />}
              {t('settings.sms.test.send')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function SmsFormSkeleton() {
  return (
    <div className="card-surface space-y-5 p-6" aria-busy="true" aria-hidden="true">
      <Skeleton className="h-6 w-44" />
      <Skeleton className="h-16 w-full rounded-lg" />
      <div className="grid gap-5 md:grid-cols-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-16 w-full" />
        </div>
      ))}
    </div>
  );
}
