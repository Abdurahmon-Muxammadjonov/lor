'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { ru as ruLocale, uz as uzLocale } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocale } from '@/i18n/client';
import { cn } from '@/lib/utils';
import { monthKey, recentMonths, shiftMonth } from '@/lib/staff/salary';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface MonthPickerProps {
  value: string;
  onChange: (month: string) => void;
  /** Roʻyxatdagi oylar soni (joriy oydan orqaga) */
  months?: number;
  className?: string;
  id?: string;
}

/** "YYYY-MM" → "Sentabr 2026" / "Сентябрь 2026" */
export function formatMonthLabel(month: string, locale: 'uz' | 'ru'): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  const label = format(new Date(y, m - 1, 1), 'LLLL yyyy', { locale: locale === 'ru' ? ruLocale : uzLocale });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Oy tanlagich: ← → tugmalar + roʻyxat (kelajak oyga oʻtib boʻlmaydi) */
export function MonthPicker({ value, onChange, months = 24, className, id }: MonthPickerProps) {
  const { t, locale } = useLocale();
  const current = monthKey();
  const options = React.useMemo(() => {
    const list = recentMonths(months);
    return list.includes(value) ? list : [value, ...list];
  }, [months, value]);
  const canNext = value < current;

  return (
    <div className={cn('flex items-center gap-1', className)} role="group" aria-label={t('staff.salary.month')}>
      <Button variant="outline" size="icon" className="size-10 shrink-0" aria-label={t('staff.salary.prevMonth')} onClick={() => onChange(shiftMonth(value, -1))}>
        <ChevronLeft aria-hidden="true" />
      </Button>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-44 font-medium" aria-label={t('staff.salary.month')}>
          <SelectValue>{formatMonthLabel(value, locale)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((m) => (
            <SelectItem key={m} value={m}>
              {formatMonthLabel(m, locale)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="icon"
        className="size-10 shrink-0"
        aria-label={t('staff.salary.nextMonth')}
        disabled={!canNext}
        onClick={() => onChange(shiftMonth(value, 1))}
      >
        <ChevronRight aria-hidden="true" />
      </Button>
    </div>
  );
}
