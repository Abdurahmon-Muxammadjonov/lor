'use client';

import type { CSSProperties } from 'react';
import { useT } from '@/i18n/client';
import { cn } from '@/lib/utils';
import type { WeeklySchedule } from '@/lib/settings/types';
import { DAY_ORDER, formatBreak, formatDayRange } from '@/lib/staff/schedule';
import { hexToRgba, safeHex } from '@/lib/staff/color';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface ScheduleChipsProps {
  schedule: WeeklySchedule;
  color: string;
  className?: string;
}

/** Du–Ya mini chiplar: ish kuni — rangli, dam — xira; hover/fokusda soatlar */
export function ScheduleChips({ schedule, color, className }: ScheduleChipsProps) {
  const t = useT();
  const hex = safeHex(color);
  const today = new Date().getDay();
  return (
    <ul className={cn('flex flex-wrap items-center gap-1', className)} aria-label={t('staff.card.schedule')}>
      {DAY_ORDER.map((k) => {
        const day = schedule[k];
        const isToday = k === today;
        const brk = formatBreak(day);
        const label = day.enabled
          ? `${t(`staff.days.long.${k}`)}: ${formatDayRange(day)}${brk ? ` · ${t('staff.schedule.break', { t: brk })}` : ''}`
          : `${t(`staff.days.long.${k}`)}: ${t('staff.card.dayOff')}`;
        const style: CSSProperties = day.enabled
          ? { color: hex, backgroundColor: hexToRgba(hex, 0.12), borderColor: hexToRgba(hex, 0.35) }
          : {};
        if (isToday) (style as Record<string, string>)['--tw-ring-color'] = day.enabled ? hex : 'var(--text-muted)';
        return (
          <li key={k}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  tabIndex={0}
                  aria-label={label}
                  className={cn(
                    'inline-flex h-6 min-w-7 items-center justify-center rounded-md border px-1.5 text-[11px] font-semibold tabular transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    !day.enabled && 'border-line bg-transparent text-muted-foreground/60 line-through decoration-muted-foreground/40',
                    isToday && 'ring-1 ring-offset-1 ring-offset-bg-elevated',
                  )}
                  style={style}
                >
                  {t(`staff.days.short.${k}`)}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">{label}</TooltipContent>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
}
