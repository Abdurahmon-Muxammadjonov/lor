'use client';

import * as React from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { Coffee, CopyCheck, X } from 'lucide-react';
import { useT } from '@/i18n/client';
import { cn } from '@/lib/utils';
import { DAY_ORDER, WEEKDAYS, dayMinutes, type DayKey } from '@/lib/staff/schedule';
import type { UserCreateInput } from '@/lib/staff/schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

type FormValues = UserCreateInput;

function fieldError(errors: unknown, k: DayKey, field: 'start' | 'end' | 'breakStart' | 'breakEnd'): string | undefined {
  const sched = (errors as { schedule?: Record<string, Record<string, { message?: string } | undefined> | undefined> } | undefined)?.schedule;
  return sched?.[String(k)]?.[field]?.message;
}

/**
 * Haftalik ish jadvali muharriri (7 qator): ish kuni switch, boshlanish/tugash, tanaffus.
 * `FormProvider` ichida ishlaydi (`schedule.<0–6>.*` maydonlari).
 */
export function ScheduleEditor({ disabled = false }: { disabled?: boolean }) {
  const t = useT();
  const { control, register, setValue, getValues, formState } = useFormContext<FormValues>();
  const schedule = useWatch({ control, name: 'schedule' });

  const totalMinutes = DAY_ORDER.reduce<number>((sum, k) => {
    const d = schedule?.[k];
    if (!d) return sum;
    return (
      sum +
      dayMinutes({
        enabled: d.enabled,
        start: d.start,
        end: d.end,
        breakStart: d.breakStart || undefined,
        breakEnd: d.breakEnd || undefined,
      })
    );
  }, 0);
  const hours = Math.round((totalMinutes / 60) * 2) / 2;

  const applyMondayToWeekdays = () => {
    const mon = getValues('schedule.1');
    for (const k of WEEKDAYS) {
      if (k === 1) continue;
      setValue(`schedule.${k}`, { ...mon }, { shouldDirty: true, shouldValidate: true });
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-text-muted">{t('staff.form.weekHours', { h: hours })}</p>
        <Button type="button" variant="ghost" size="sm" onClick={applyMondayToWeekdays} disabled={disabled}>
          <CopyCheck aria-hidden="true" />
          {t('staff.form.applyToWeekdays')}
        </Button>
      </div>

      <ul className="divide-y divide-line rounded-lg border border-line bg-popover/60">
        {DAY_ORDER.map((k) => {
          const day = schedule?.[k];
          const enabled = day?.enabled ?? false;
          const hasBreak = Boolean(day?.breakStart || day?.breakEnd);
          const idBase = `sched-${k}`;
          const errStart = fieldError(formState.errors, k, 'start');
          const errEnd = fieldError(formState.errors, k, 'end');
          const errBs = fieldError(formState.errors, k, 'breakStart');
          const errBe = fieldError(formState.errors, k, 'breakEnd');
          const rowError = errStart ?? errEnd ?? errBs ?? errBe;
          return (
            <li key={k} className={cn('grid gap-2 px-3 py-2.5 sm:grid-cols-[7.5rem,1fr] sm:items-center', !enabled && 'opacity-80')}>
              <div className="flex items-center justify-between gap-3 sm:justify-start">
                <Label htmlFor={`${idBase}-enabled`} className="w-24 text-sm font-semibold">
                  <span className="sm:hidden">{t(`staff.days.long.${k}`)}</span>
                  <span className="hidden sm:inline">{t(`staff.days.short.${k}`)}</span>
                </Label>
                <Controller
                  control={control}
                  name={`schedule.${k}.enabled`}
                  render={({ field }) => (
                    <Switch
                      id={`${idBase}-enabled`}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={disabled}
                      aria-label={`${t(`staff.days.long.${k}`)} — ${t('staff.form.enabled')}`}
                    />
                  )}
                />
              </div>

              {enabled ? (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor={`${idBase}-start`} className="sr-only">
                      {t('staff.form.start')}
                    </Label>
                    <Input
                      id={`${idBase}-start`}
                      type="time"
                      step={300}
                      className="h-9 w-[6.6rem] tabular"
                      disabled={disabled}
                      aria-invalid={errStart ? true : undefined}
                      {...register(`schedule.${k}.start`)}
                    />
                    <span aria-hidden="true" className="text-text-muted">
                      –
                    </span>
                    <Label htmlFor={`${idBase}-end`} className="sr-only">
                      {t('staff.form.end')}
                    </Label>
                    <Input
                      id={`${idBase}-end`}
                      type="time"
                      step={300}
                      className="h-9 w-[6.6rem] tabular"
                      disabled={disabled}
                      aria-invalid={errEnd ? true : undefined}
                      {...register(`schedule.${k}.end`)}
                    />
                  </div>

                  {hasBreak ? (
                    <div className="flex items-center gap-1.5">
                      <Coffee className="size-4 text-text-muted" aria-hidden="true" />
                      <Label htmlFor={`${idBase}-bs`} className="sr-only">
                        {t('staff.form.breakStart')}
                      </Label>
                      <Input
                        id={`${idBase}-bs`}
                        type="time"
                        step={300}
                        className="h-9 w-[6.6rem] tabular"
                        disabled={disabled}
                        aria-invalid={errBs ? true : undefined}
                        {...register(`schedule.${k}.breakStart`)}
                      />
                      <span aria-hidden="true" className="text-text-muted">
                        –
                      </span>
                      <Label htmlFor={`${idBase}-be`} className="sr-only">
                        {t('staff.form.breakEnd')}
                      </Label>
                      <Input
                        id={`${idBase}-be`}
                        type="time"
                        step={300}
                        className="h-9 w-[6.6rem] tabular"
                        disabled={disabled}
                        aria-invalid={errBe ? true : undefined}
                        {...register(`schedule.${k}.breakEnd`)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        aria-label={t('staff.form.removeBreak')}
                        disabled={disabled}
                        onClick={() => {
                          setValue(`schedule.${k}.breakStart`, '', { shouldDirty: true, shouldValidate: true });
                          setValue(`schedule.${k}.breakEnd`, '', { shouldDirty: true, shouldValidate: true });
                        }}
                      >
                        <X aria-hidden="true" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs"
                      disabled={disabled}
                      onClick={() => {
                        setValue(`schedule.${k}.breakStart`, '13:00', { shouldDirty: true, shouldValidate: true });
                        setValue(`schedule.${k}.breakEnd`, '14:00', { shouldDirty: true, shouldValidate: true });
                      }}
                    >
                      <Coffee aria-hidden="true" />
                      {t('staff.form.addBreak')}
                    </Button>
                  )}

                  {rowError ? (
                    <p role="alert" className="basis-full text-xs text-danger">
                      {t(rowError)}
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-text-muted">{t('staff.form.dayOff')}</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
