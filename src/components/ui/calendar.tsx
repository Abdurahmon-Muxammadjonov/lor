'use client';

import * as React from 'react';
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ru as dfRu, uz as dfUz } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale } from '@/i18n/client';

export type CalendarLocale = 'uz' | 'ru';

export interface CalendarProps {
  /** Tanlangan sana */
  value?: Date;
  onChange?: (d: Date) => void;
  /** Eng erta ruxsat etilgan sana (shu kun ham kiradi) */
  min?: Date;
  /** Eng kech ruxsat etilgan sana (shu kun ham kiradi) */
  max?: Date;
  /** Berilmasa — joriy til (LocaleProvider) */
  locale?: CalendarLocale;
  /** Qoʻshimcha oʻchirilgan kunlar (masalan, dam olish kunlari) */
  disabledDays?: (d: Date) => boolean;
  className?: string;
  /** `value` boʻlmaganda koʻrsatiladigan boshlangʻich oy */
  defaultMonth?: Date;
  /** "Bugun" tugmasini yashirish */
  hideToday?: boolean;
}

const LABELS: Record<CalendarLocale, { prev: string; next: string; today: string; grid: string }> = {
  uz: { prev: 'Oldingi oy', next: 'Keyingi oy', today: 'Bugun', grid: 'Kalendar' },
  ru: { prev: 'Предыдущий месяц', next: 'Следующий месяц', today: 'Сегодня', grid: 'Календарь' },
};

const WEEK_OPTS = { weekStartsOn: 1 as const };

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const dayKey = (d: Date) => format(d, 'yyyy-MM-dd');

/**
 * Oddiy oy taqvimi (react-day-picker siz). Dushanbadan boshlanadigan haftalar,
 * klaviatura: ← → ↑ ↓, Home/End (hafta boshi/oxiri), PageUp/PageDown (oy), Enter/Space — tanlash.
 */
function Calendar({
  value,
  onChange,
  min,
  max,
  locale: localeProp,
  disabledDays,
  className,
  defaultMonth,
  hideToday = false,
}: CalendarProps) {
  const { locale: ctxLocale } = useLocale();
  const locale: CalendarLocale = localeProp ?? ctxLocale;
  const dfLocale = locale === 'ru' ? dfRu : dfUz;
  const labels = LABELS[locale];

  const minDay = min ? startOfDay(min) : undefined;
  const maxDay = max ? startOfDay(max) : undefined;
  const valueTime = value ? startOfDay(value).getTime() : undefined;

  const [viewMonth, setViewMonth] = React.useState<Date>(() => startOfMonth(value ?? defaultMonth ?? new Date()));
  const [focused, setFocused] = React.useState<Date>(() => startOfDay(value ?? defaultMonth ?? new Date()));
  const gridRef = React.useRef<HTMLDivElement>(null);
  const pendingFocusRef = React.useRef(false);

  // Tashqaridan `value` oʻzgarsa — koʻrinadigan oyni sinxronlash
  React.useEffect(() => {
    if (valueTime === undefined) return;
    const v = new Date(valueTime);
    setViewMonth(startOfMonth(v));
    setFocused(v);
  }, [valueTime]);

  // Klaviatura bilan koʻchirilgan kunga fokusni qoʻyish
  React.useEffect(() => {
    if (!pendingFocusRef.current) return;
    pendingFocusRef.current = false;
    const el = gridRef.current?.querySelector<HTMLButtonElement>(`button[data-date="${dayKey(focused)}"]`);
    el?.focus();
  }, [focused, viewMonth]);

  const isDisabled = React.useCallback(
    (d: Date): boolean => {
      if (minDay && isBefore(d, minDay)) return true;
      if (maxDay && isAfter(d, maxDay)) return true;
      return disabledDays ? disabledDays(d) : false;
    },
    [minDay, maxDay, disabledDays],
  );

  const days = React.useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(viewMonth, WEEK_OPTS),
        end: endOfWeek(endOfMonth(viewMonth), WEEK_OPTS),
      }),
    [viewMonth],
  );
  const weeks = React.useMemo(() => chunk(days, 7), [days]);

  const weekdayLabels = React.useMemo(() => {
    const monday = startOfWeek(new Date(2024, 0, 1), WEEK_OPTS);
    return Array.from({ length: 7 }, (_, i) => capitalize(format(addDays(monday, i), 'EEEEEE', { locale: dfLocale })).slice(0, 2));
  }, [dfLocale]);

  const today = startOfDay(new Date());
  const inView = days.some((d) => isSameDay(d, focused));
  const tabStop: Date = inView
    ? focused
    : value && isSameMonth(value, viewMonth)
      ? startOfDay(value)
      : isSameMonth(today, viewMonth)
        ? today
        : viewMonth;

  const prevDisabled = !!minDay && isBefore(endOfMonth(subMonths(viewMonth, 1)), minDay);
  const nextDisabled = !!maxDay && isAfter(startOfMonth(addMonths(viewMonth, 1)), maxDay);

  const select = (d: Date) => {
    if (isDisabled(d)) return;
    setFocused(d);
    if (!isSameMonth(d, viewMonth)) setViewMonth(startOfMonth(d));
    onChange?.(d);
  };

  const moveFocus = (next: Date) => {
    let target = next;
    if (minDay && isBefore(target, minDay)) target = minDay;
    if (maxDay && isAfter(target, maxDay)) target = maxDay;
    pendingFocusRef.current = true;
    setFocused(target);
    if (!isSameMonth(target, viewMonth)) setViewMonth(startOfMonth(target));
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const base = inView ? focused : tabStop;
    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        moveFocus(addDays(base, -1));
        break;
      case 'ArrowRight':
        e.preventDefault();
        moveFocus(addDays(base, 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        moveFocus(addWeeks(base, -1));
        break;
      case 'ArrowDown':
        e.preventDefault();
        moveFocus(addWeeks(base, 1));
        break;
      case 'Home':
        e.preventDefault();
        moveFocus(startOfWeek(base, WEEK_OPTS));
        break;
      case 'End':
        e.preventDefault();
        moveFocus(endOfWeek(base, WEEK_OPTS));
        break;
      case 'PageUp':
        e.preventDefault();
        moveFocus(e.shiftKey ? addMonths(base, -12) : subMonths(base, 1));
        break;
      case 'PageDown':
        e.preventDefault();
        moveFocus(e.shiftKey ? addMonths(base, 12) : addMonths(base, 1));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        select(base);
        break;
      default:
        break;
    }
  };

  const goToday = () => {
    if (isDisabled(today)) {
      moveFocus(today);
      return;
    }
    select(today);
    pendingFocusRef.current = true;
  };

  const monthTitle = capitalize(format(viewMonth, 'LLLL yyyy', { locale: dfLocale }));

  return (
    <div className={cn('inline-block w-[19.5rem] max-w-full select-none p-3 text-text', className)}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setViewMonth((m) => subMonths(m, 1))}
          disabled={prevDisabled}
          aria-label={labels.prev}
          className="inline-flex size-8 items-center justify-center rounded-md border border-line bg-bg-elevated text-text-muted transition-colors hover:border-[#2B3A57] hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-elevated disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        <div className="flex flex-1 items-center justify-center gap-2">
          <span className="font-heading text-sm font-semibold" aria-live="polite">
            {monthTitle}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setViewMonth((m) => addMonths(m, 1))}
          disabled={nextDisabled}
          aria-label={labels.next}
          className="inline-flex size-8 items-center justify-center rounded-md border border-line bg-bg-elevated text-text-muted transition-colors hover:border-[#2B3A57] hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-elevated disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div ref={gridRef} role="grid" aria-label={`${labels.grid}: ${monthTitle}`} onKeyDown={onKeyDown}>
        <div role="row" className="mb-1 grid grid-cols-7">
          {weekdayLabels.map((w, i) => (
            <div
              key={w + i}
              role="columnheader"
              className={cn(
                'flex h-8 items-center justify-center text-[11px] font-semibold uppercase tracking-wider text-text-muted',
                i >= 5 && 'text-destructive/80',
              )}
            >
              {w}
            </div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div role="row" key={wi} className="grid grid-cols-7 gap-y-0.5">
            {week.map((d) => {
              const selected = !!value && isSameDay(d, value);
              const disabled = isDisabled(d);
              const outside = !isSameMonth(d, viewMonth);
              const todayFlag = isToday(d);
              return (
                <div key={dayKey(d)} role="gridcell" aria-selected={selected} className="flex items-center justify-center">
                  <button
                    type="button"
                    data-date={dayKey(d)}
                    tabIndex={isSameDay(d, tabStop) ? 0 : -1}
                    disabled={disabled}
                    aria-disabled={disabled || undefined}
                    aria-pressed={selected}
                    aria-current={todayFlag ? 'date' : undefined}
                    aria-label={format(d, 'd MMMM yyyy, EEEE', { locale: dfLocale })}
                    onClick={() => select(d)}
                    onFocus={() => setFocused(d)}
                    className={cn(
                      'relative flex size-9 items-center justify-center rounded-md text-sm tabular transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-bg-elevated',
                      !selected && !disabled && 'hover:bg-surface',
                      outside && !selected && 'text-muted-foreground/45',
                      todayFlag && !selected && 'font-semibold text-accent ring-1 ring-inset ring-primary/40',
                      selected && 'bg-accent font-semibold text-bg-base shadow-glow',
                      disabled && 'cursor-not-allowed opacity-35',
                    )}
                  >
                    {format(d, 'd')}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {hideToday ? null : (
        <div className="mt-2 flex justify-end border-t border-line pt-2">
          <button
            type="button"
            onClick={goToday}
            className="rounded-md px-2 py-1 text-xs font-medium text-accent transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-elevated"
          >
            {labels.today}
          </button>
        </div>
      )}
    </div>
  );
}
Calendar.displayName = 'Calendar';

export { Calendar };
