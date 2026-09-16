'use client';

import * as React from 'react';
import { DoorOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale } from '@/i18n/client';
import { fmtWeekday } from '@/lib/date';
import { keyToLocalDate } from '@/lib/appointments/availability';
import type { DoctorOption } from '@/lib/appointments/types';
import { withAlpha } from './constants';

/** Kun koʻrinishi: shifokor ustuni sarlavhasi (rang, ism, mutaxassislik, xona, soni) */
export function DoctorColumnHeader({ doctor, count }: { doctor: DoctorOption; count: number }) {
  const { t } = useLocale();
  return (
    <div
      className="flex h-full min-h-[3.75rem] flex-col justify-center gap-0.5 px-2.5 py-2"
      style={{ boxShadow: `inset 0 3px 0 0 ${doctor.color}` }}
    >
      <div className="flex items-center gap-1.5">
        <span
          aria-hidden="true"
          className="size-2.5 shrink-0 rounded-full ring-2 ring-offset-1 ring-offset-bg-elevated"
          style={{
            backgroundColor: doctor.color,
            boxShadow: `0 0 10px ${withAlpha(doctor.color, 0.6)}`,
            ['--tw-ring-color' as string]: withAlpha(doctor.color, 0.35),
          }}
        />
        <span className="truncate font-heading text-sm font-semibold text-text" title={doctor.fullName}>
          {doctor.fullName}
        </span>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-text-muted">
        {doctor.specialty ? <span className="truncate">{doctor.specialty}</span> : null}
        {doctor.room ? (
          <span
            className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-line px-1.5 py-px"
            title={t('common.room')}
          >
            <DoorOpen className="size-3" aria-hidden="true" />
            {doctor.room}
          </span>
        ) : null}
        <span className="tabular ml-auto shrink-0">{t('appointments.grid.count', { n: count })}</span>
      </div>
    </div>
  );
}

/** Hafta koʻrinishi: kun ustuni sarlavhasi (hafta kuni, sana, bugun belgisi) */
export function DayColumnHeader({
  dateKey,
  isToday,
  count,
}: {
  dateKey: string;
  isToday: boolean;
  count: number;
}) {
  const { t, locale } = useLocale();
  const d = keyToLocalDate(dateKey);
  const weekday = fmtWeekday(d, locale).split(',')[0] ?? '';
  const dayNum = dateKey.slice(8, 10);
  return (
    <div
      className={cn(
        'flex h-full min-h-[3.75rem] items-center gap-2.5 px-2.5 py-2',
        isToday && 'bg-primary/5',
      )}
    >
      <span
        className={cn(
          'tabular flex size-9 shrink-0 items-center justify-center rounded-lg font-heading text-lg font-bold',
          isToday ? 'bg-gradient-accent text-bg-base shadow-glow' : 'bg-surface text-text',
        )}
      >
        {dayNum}
      </span>
      <div className="flex min-w-0 flex-col">
        <span
          className={cn('truncate text-sm font-semibold capitalize', isToday ? 'text-accent' : 'text-text')}
        >
          {weekday}
        </span>
        <span className="text-[11px] text-text-muted">
          {isToday ? t('common.today') : t('appointments.grid.count', { n: count })}
        </span>
      </div>
    </div>
  );
}
