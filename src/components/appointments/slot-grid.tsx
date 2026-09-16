'use client';

import * as React from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { SlotInfo, SlotReason } from '@/lib/appointments/availability';
import { useFreeSlots } from './use-appointments';

export interface SlotGridProps {
  doctorId: string | null;
  date: string;
  durationMin: number;
  /** Tahrirlashda oʻz vaqti band hisoblanmaydi */
  excludeId?: string;
  /** "HH:mm" */
  value: string | null;
  onChange: (time: string) => void;
  disabled?: boolean;
  /** Tahrirlashdagi joriy vaqt (belgilanadi) */
  currentTime?: string | null;
  labelId?: string;
}

const REASON_KEY: Record<SlotReason, string> = {
  TAKEN: 'appointments.dialog.slotTaken',
  PAST: 'appointments.dialog.slotPast',
  BREAK: 'appointments.dialog.slotBreak',
  DAY_OFF: 'appointments.dialog.slotDayOff',
  OUTSIDE_HOURS: 'appointments.dialog.slotOutside',
};

/** Boʻsh vaqtlar toʻri: /api/appointments/slots dan; band/oʻtgan/tanaffus — oʻchirilgan, sabab title da */
export function SlotGrid({
  doctorId,
  date,
  durationMin,
  excludeId,
  value,
  onChange,
  disabled,
  currentTime,
  labelId,
}: SlotGridProps) {
  const t = useT();
  const enabled = !!doctorId && !!date;
  const slots = useFreeSlots({ doctorId: doctorId ?? '', date, durationMin, excludeId }, enabled);

  if (!doctorId) {
    return (
      <p className="rounded-md border border-dashed border-line px-3 py-4 text-center text-sm text-text-muted">
        {t('appointments.dialog.pickDoctorFirst')}
      </p>
    );
  }
  if (slots.isPending) {
    return (
      <div
        className="grid grid-cols-4 gap-1.5 sm:grid-cols-6"
        aria-busy="true"
        aria-label={t('appointments.dialog.slotsLoading')}
      >
        {Array.from({ length: 12 }, (_, i) => (
          <Skeleton key={i} className="h-8 rounded-md" />
        ))}
      </div>
    );
  }
  if (slots.isError) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-line px-3 py-4 text-center text-sm text-text-muted">
        {t('appointments.dialog.slotsFailed')}
        <Button type="button" variant="outline" size="sm" onClick={() => void slots.refetch()}>
          <RefreshCw aria-hidden="true" />
          {t('common.retry')}
        </Button>
      </div>
    );
  }

  const data = slots.data;
  const day = data.day;
  const visible: SlotInfo[] = data.slots.filter(
    (s) => s.available || s.reason !== 'PAST' || s.time === value || s.time === currentTime,
  );
  const anyAvailable = visible.some((s) => s.available);
  const hasSelectedInList = value ? visible.some((s) => s.time === value) : true;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-text-muted">
        {day.enabled
          ? t('appointments.dialog.scheduleHint', { start: day.start, end: day.end }) +
            (day.breakStart && day.breakEnd
              ? `, ${t('appointments.dialog.scheduleBreak', { start: day.breakStart, end: day.breakEnd })}`
              : '')
          : t('appointments.dialog.slotDayOff')}
      </p>
      {!day.enabled ? null : !anyAvailable && !value ? (
        <p className="rounded-md border border-dashed border-line px-3 py-4 text-center text-sm text-text-muted">
          {t('appointments.dialog.noFreeSlots')}
        </p>
      ) : (
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6" role="radiogroup" aria-labelledby={labelId}>
          {!hasSelectedInList && value ? (
            <SlotButton
              time={value}
              selected
              available={false}
              reason={undefined}
              disabled={!!disabled}
              onSelect={onChange}
              label={t('appointments.dialog.legendSelected')}
            />
          ) : null}
          {visible.map((s) => (
            <SlotButton
              key={s.time}
              time={s.time}
              selected={s.time === value}
              available={s.available || s.time === currentTime}
              reason={s.reason}
              disabled={!!disabled}
              onSelect={onChange}
              label={
                s.time === currentTime
                  ? t('appointments.dialog.slotCurrent')
                  : s.reason
                    ? t(REASON_KEY[s.reason])
                    : undefined
              }
            />
          ))}
        </div>
      )}
      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-muted"
        aria-hidden="true"
      >
        <span className="inline-flex items-center gap-1">
          <span className="size-2.5 rounded-sm border border-line bg-bg-elevated" />
          {t('appointments.dialog.legendFree')}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2.5 rounded-sm bg-surface opacity-50" />
          {t('appointments.dialog.legendTaken')}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="size-2.5 rounded-sm bg-gradient-accent" />
          {t('appointments.dialog.legendSelected')}
        </span>
      </div>
    </div>
  );
}

interface SlotButtonProps {
  time: string;
  selected: boolean;
  available: boolean;
  reason: SlotReason | undefined;
  disabled: boolean;
  onSelect: (time: string) => void;
  label?: string;
}

function SlotButton({ time, selected, available, disabled, onSelect, label }: SlotButtonProps) {
  const off = !available && !selected;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={label ? `${time} — ${label}` : time}
      title={label}
      disabled={disabled || off}
      onClick={() => onSelect(time)}
      className={cn(
        'tabular h-8 rounded-md border text-xs font-medium transition-[background-color,border-color,box-shadow,color]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-bg-elevated',
        selected
          ? 'border-transparent bg-gradient-accent text-bg-base shadow-glow'
          : off
            ? 'cursor-not-allowed border-border/40 bg-card/40 text-muted-foreground/60 line-through'
            : 'border-line bg-bg-elevated text-text hover:border-primary/60 hover:text-accent',
      )}
    >
      {time}
    </button>
  );
}
