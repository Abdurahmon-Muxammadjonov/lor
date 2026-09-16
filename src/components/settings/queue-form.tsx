'use client';

import * as React from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ExternalLink, Hash, KeyRound, LayoutGrid, MonitorPlay, RefreshCw } from 'lucide-react';
import { useLocale } from '@/i18n/client';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { CopyButton } from '@/components/shared/copy-button';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import {
  QUEUE_TYPES,
  QueueFormSchema,
  kioskLinks,
  type QueueFormValues,
  type QueuePatch,
  type QueueTypeKey,
} from '@/lib/settings/schemas';
import { Field, FormCard, InputWithUnit, SectionHeading, SwitchRow, fieldAria } from './form-field';
import { SaveBar } from './save-bar';
import { settingsErrorMessage, useClinicProfile, useQueueSection, useRegenerateKioskKey, useUpdateQueueSection } from './use-settings';

export interface QueueFormProps {
  canWrite: boolean;
}

const FORM_ID = 'settings-queue-form';

function toPatch(values: QueueFormValues, base: QueueFormValues): QueuePatch {
  const patch: QueuePatch = {};
  for (const key of Object.keys(values) as (keyof QueueFormValues)[]) {
    if (JSON.stringify(values[key]) !== JSON.stringify(base[key])) (patch as Record<string, unknown>)[key] = values[key];
  }
  return patch;
}

/** Navbat boʻlimi: prefikslar, kiosk tugmalari, tablo ovozi, koʻrsatish vaqti va kiosk kaliti */
export function QueueForm({ canWrite }: QueueFormProps) {
  const { t, locale } = useLocale();
  const query = useQueueSection();
  const update = useUpdateQueueSection();

  const form = useForm<QueueFormValues>({
    resolver: zodResolver(QueueFormSchema),
    mode: 'onTouched',
    defaultValues: query.data,
  });
  const { register, control, handleSubmit, reset, formState } = form;
  const { errors, isDirty, isSubmitting } = formState;

  React.useEffect(() => {
    if (query.data && !isDirty) reset(query.data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);

  React.useEffect(() => {
    if (query.isError) toast.error(settingsErrorMessage(query.error, t, locale), { id: 'settings-queue-load' });
  }, [query.isError, query.error, t, locale]);

  const onSubmit = handleSubmit(async (vals) => {
    if (!query.data) return;
    const patch = toPatch(vals, query.data);
    if (Object.keys(patch).length === 0) {
      reset(vals);
      return;
    }
    try {
      const saved = await update.mutateAsync(patch);
      reset(saved);
      toast.success(t('settings.toast.saved'));
    } catch (e) {
      toast.error(settingsErrorMessage(e, t, locale));
    }
  });

  const disabled = !canWrite || update.isPending;
  const hasErrors = Object.keys(errors).length > 0;

  if (query.isPending) return <QueueFormSkeleton />;
  if (!query.data) return null;

  return (
    <form id={FORM_ID} onSubmit={onSubmit} noValidate className="space-y-5">
      <fieldset disabled={disabled} className="space-y-5">
        <FormCard title={t('settings.queue.title')} description={t('settings.queue.description')}>
          <div className="grid gap-5 md:grid-cols-2">
            <SectionHeading>
              <Hash className="mr-1 inline size-3.5" aria-hidden="true" />
              {t('settings.queue.prefixes')}
            </SectionHeading>
            <div className="md:col-span-2">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {QUEUE_TYPES.map((type) => (
                  <Field
                    key={type}
                    id={`queue-prefix-${type}`}
                    label={t(`common.queueType.${type}`)}
                    required
                    error={errors.prefixes?.[type]?.message}
                  >
                    <Input
                      id={`queue-prefix-${type}`}
                      maxLength={1}
                      autoCapitalize="characters"
                      spellCheck={false}
                      className="tabular text-center font-heading text-lg font-bold uppercase"
                      {...register(`prefixes.${type}` as const)}
                      {...fieldAria(`queue-prefix-${type}`, errors.prefixes?.[type]?.message)}
                    />
                  </Field>
                ))}
              </div>
              <p className="mt-2 text-xs text-text-muted">{t('settings.queue.prefixHint')}</p>
            </div>

            <SectionHeading>
              <LayoutGrid className="mr-1 inline size-3.5" aria-hidden="true" />
              {t('settings.queue.enabledTypes')}
            </SectionHeading>
            <div className="md:col-span-2">
              <Controller
                control={control}
                name="enabledTypes"
                render={({ field, fieldState }) => (
                  <fieldset>
                    <legend className="sr-only">{t('settings.queue.enabledTypes')}</legend>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      {QUEUE_TYPES.map((type) => {
                        const checked = field.value.includes(type);
                        return (
                          <label
                            key={type}
                            htmlFor={`queue-type-${type}`}
                            className={cn(
                              'flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors',
                              checked ? 'border-primary/40 bg-primary/10 text-text' : 'border-line bg-bg-elevated/60 text-text-muted hover:text-text',
                              disabled && 'cursor-not-allowed opacity-60',
                            )}
                          >
                            <Checkbox
                              id={`queue-type-${type}`}
                              checked={checked}
                              disabled={disabled}
                              onCheckedChange={(v) => {
                                const next = v === true ? [...field.value, type] : field.value.filter((x: QueueTypeKey) => x !== type);
                                field.onChange(QUEUE_TYPES.filter((x) => next.includes(x)));
                              }}
                            />
                            {t(`common.queueType.${type}`)}
                          </label>
                        );
                      })}
                    </div>
                    {fieldState.error?.message ? (
                      <p role="alert" className="mt-2 text-xs font-medium text-danger">
                        {t(fieldState.error.message)}
                      </p>
                    ) : (
                      <p className="mt-2 text-xs text-text-muted">{t('settings.queue.enabledHint')}</p>
                    )}
                  </fieldset>
                )}
              />
            </div>

            <SectionHeading>
              <MonitorPlay className="mr-1 inline size-3.5" aria-hidden="true" />
              {t('settings.queue.display')}
            </SectionHeading>
            <Controller
              control={control}
              name="displaySound"
              render={({ field }) => (
                <SwitchRow
                  id="queue-display-sound"
                  label={t('settings.queue.displaySound')}
                  hint={t('settings.queue.displaySoundHint')}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={disabled}
                />
              )}
            />
            <Controller
              control={control}
              name="displayVoice"
              render={({ field }) => (
                <SwitchRow
                  id="queue-display-voice"
                  label={t('settings.queue.displayVoice')}
                  hint={t('settings.queue.displayVoiceHint')}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={disabled}
                />
              )}
            />
            <Field
              id="queue-show-seconds"
              label={t('settings.queue.kioskShowSeconds')}
              error={errors.kioskShowSeconds?.message}
              hint={t('settings.queue.kioskHint')}
            >
              <InputWithUnit unit={t('settings.queue.secondsUnit')}>
                <Input
                  id="queue-show-seconds"
                  type="number"
                  inputMode="numeric"
                  min={2}
                  max={30}
                  step={1}
                  className="tabular"
                  {...register('kioskShowSeconds', { valueAsNumber: true })}
                  {...fieldAria('queue-show-seconds', errors.kioskShowSeconds?.message, true)}
                />
              </InputWithUnit>
            </Field>
          </div>
        </FormCard>
      </fieldset>

      <KioskKeyCard canWrite={canWrite} />

      {canWrite ? <SaveBar dirty={isDirty} saving={isSubmitting || update.isPending} hasErrors={hasErrors} onDiscard={() => reset()} formId={FORM_ID} /> : null}
    </form>
  );
}

/** Kiosk kaliti: nusxalash, kiosk/tablo havolalari va kalitni yangilash (tasdiq bilan) */
function KioskKeyCard({ canWrite }: { canWrite: boolean }) {
  const { t, locale } = useLocale();
  const clinic = useClinicProfile();
  const regenerate = useRegenerateKioskKey();
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [origin, setOrigin] = React.useState('');

  React.useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const kioskKey = clinic.data?.kioskKey ?? '';
  const links = kioskLinks(kioskKey, origin);

  const onRegenerate = async () => {
    try {
      await regenerate.mutateAsync();
      toast.success(t('settings.queue.kiosk.regenerated'));
    } catch (e) {
      toast.error(settingsErrorMessage(e, t, locale));
    }
  };

  return (
    <FormCard
      title={t('settings.queue.kiosk.title')}
      description={t('settings.queue.kiosk.description')}
      actions={
        canWrite ? (
          <Button type="button" variant="outline" onClick={() => setConfirmOpen(true)} disabled={regenerate.isPending || !kioskKey}>
            <RefreshCw aria-hidden="true" />
            {t('settings.queue.kiosk.regenerate')}
          </Button>
        ) : null
      }
    >
      {clinic.isPending ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="kiosk-key">
              <KeyRound className="mr-1 inline size-3.5" aria-hidden="true" />
              {t('settings.queue.kiosk.key')}
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input id="kiosk-key" readOnly value={kioskKey} className="font-mono sm:flex-1" onFocus={(e) => e.currentTarget.select()} />
              <CopyButton text={kioskKey} variant="secondary" label={t('common.copy')} className="sm:w-auto" />
            </div>
          </div>

          <KioskLinkRow label={t('settings.queue.kiosk.kioskLink')} href={links.kioskUrl} openLabel={t('settings.queue.kiosk.open')} />
          <KioskLinkRow label={t('settings.queue.kiosk.displayLink')} href={links.displayUrl} openLabel={t('settings.queue.kiosk.open')} />
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('settings.queue.kiosk.regenerateTitle')}
        description={t('settings.queue.kiosk.regenerateDescription')}
        confirmText={t('settings.queue.kiosk.regenerate')}
        destructive
        onConfirm={onRegenerate}
      />
    </FormCard>
  );
}

function KioskLinkRow({ label, href, openLabel }: { label: string; href: string; openLabel: string }) {
  return (
    <div className="space-y-1.5">
      <span className="text-sm font-medium text-text">{label}</span>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input readOnly value={href} className="font-mono text-xs sm:flex-1" onFocus={(e) => e.currentTarget.select()} aria-label={label} />
        <div className="flex gap-2">
          <CopyButton text={href} variant="secondary" />
          <Button asChild type="button" variant="outline">
            <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`${label} — ${openLabel}`}>
              <ExternalLink aria-hidden="true" />
              {openLabel}
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

export function QueueFormSkeleton() {
  return (
    <div className="card-surface space-y-5 p-6" aria-busy="true" aria-hidden="true">
      <Skeleton className="h-6 w-44" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-full rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-16 w-full rounded-lg" />
    </div>
  );
}
