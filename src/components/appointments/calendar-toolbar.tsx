'use client';

import * as React from 'react';
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale } from '@/i18n/client';
import { fmtWeekday } from '@/lib/date';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Segmented } from '@/components/ui/segmented';
import {
  addDaysKey,
  formatDateKey,
  keyToLocalDate,
  localDateToKey,
  weekKeys,
} from '@/lib/appointments/availability';
import type { CalendarView } from '@/lib/appointments/calendar';
import type { DoctorOption } from '@/lib/appointments/types';
import { DoctorChips } from './doctor-chips';

export interface CalendarToolbarProps {
  dateKey: string;
  todayKey: string;
  view: CalendarView;
  onDateChange: (key: string) => void;
  onViewChange: (v: CalendarView) => void;
  doctors: DoctorOption[];
  selectedDoctorIds: string[];
  onDoctorsChange: (ids: string[]) => void;
  canWrite: boolean;
  onNew: () => void;
  /** Koʻrinayotgan yozilishlar soni */
  count: number;
}

/** Kalendar boshqaruv paneli: Bugun, ‹ ›, sana tanlash, Kun/Hafta, shifokor chiplari, Yangi yozilish */
export function CalendarToolbar({
  dateKey,
  todayKey,
  view,
  onDateChange,
  onViewChange,
  doctors,
  selectedDoctorIds,
  onDoctorsChange,
  canWrite,
  onNew,
  count,
}: CalendarToolbarProps) {
  const { t, locale } = useLocale();
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const step = view === 'week' ? 7 : 1;
  const isToday = dateKey === todayKey;

  const title = React.useMemo(() => {
    if (view === 'day') {
      const label = fmtWeekday(keyToLocalDate(dateKey), locale);
      return label.charAt(0).toUpperCase() + label.slice(1);
    }
    const keys = weekKeys(dateKey);
    return t('appointments.nav.weekOf', {
      from: formatDateKey(keys[0] ?? dateKey),
      to: formatDateKey(keys[6] ?? dateKey),
    });
  }, [view, dateKey, locale, t]);

  const year = dateKey.slice(0, 4);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={isToday ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => onDateChange(todayKey)}
          aria-pressed={isToday}
        >
          {t('common.today')}
        </Button>
        <div className="flex items-center rounded-md border border-line bg-bg-elevated">
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-r-none"
            aria-label={view === 'week' ? t('appointments.nav.prevWeek') : t('appointments.nav.prevDay')}
            onClick={() => onDateChange(addDaysKey(dateKey, -step))}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <span className="h-5 w-px bg-line" aria-hidden="true" />
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-l-none"
            aria-label={view === 'week' ? t('appointments.nav.nextWeek') : t('appointments.nav.nextDay')}
            onClick={() => onDateChange(addDaysKey(dateKey, step))}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>

        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 gap-2 px-2 font-heading text-base font-semibold text-text sm:text-lg"
              aria-label={`${t('appointments.nav.pickDate')}: ${title}`}
              aria-expanded={pickerOpen}
              aria-haspopup="dialog"
            >
              <CalendarDays className="text-accent" aria-hidden="true" />
              <span className="truncate">{title}</span>
              {view === 'day' ? (
                <span className="hidden text-sm font-normal text-text-muted sm:inline">{year}</span>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto p-2">
            <Calendar
              value={keyToLocalDate(dateKey)}
              onChange={(d) => {
                onDateChange(localDateToKey(d));
                setPickerOpen(false);
              }}
            />
          </PopoverContent>
        </Popover>

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-xs text-text-muted md:inline" aria-live="polite">
            {t('appointments.grid.count', { n: count })}
          </span>
          <Segmented<CalendarView>
            size="sm"
            ariaLabel={t('appointments.view.label')}
            value={view}
            onChange={onViewChange}
            options={[
              { value: 'day', label: t('appointments.view.day'), icon: <CalendarDays aria-hidden="true" /> },
              {
                value: 'week',
                label: t('appointments.view.week'),
                icon: <CalendarRange aria-hidden="true" />,
              },
            ]}
          />
          {canWrite ? (
            <Button variant="gradient" size="sm" onClick={onNew} className={cn('shadow-glow')}>
              <Plus aria-hidden="true" />
              <span className="hidden sm:inline">{t('appointments.new')}</span>
              <span className="sm:hidden">{t('common.add')}</span>
            </Button>
          ) : null}
        </div>
      </div>

      <DoctorChips doctors={doctors} selected={selectedDoctorIds} onChange={onDoctorsChange} />
    </div>
  );
}
