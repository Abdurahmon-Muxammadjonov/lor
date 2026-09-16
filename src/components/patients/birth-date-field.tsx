'use client';

import * as React from 'react';
import { CalendarDays } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale } from '@/i18n/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  isValidDateParts,
  maskDateInput,
  MIN_BIRTH_YEAR,
  parseDateParts,
  partsToKey,
  toDateKey,
} from '@/lib/patients/age';
import { format } from 'date-fns';
import { ru as dfRu, uz as dfUz } from 'date-fns/locale';

export interface BirthDateFieldProps {
  id: string;
  /** "DD.MM.YYYY" (forma qiymati) */
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
  describedBy?: string;
  disabled?: boolean;
  placeholder?: string;
  pickLabel: string;
  yearLabel: string;
  monthLabel: string;
}

function toLocalDate(value: string): Date | undefined {
  const key = toDateKey(value);
  if (!key) return undefined;
  const p = parseDateParts(key);
  if (!p) return undefined;
  return new Date(p.year, p.month - 1, p.day);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Tugʻilgan sana: qoʻlda kiritish (kk.oo.yyyy maskasi) + kalendar (yil/oy tez tanlash bilan).
 */
export const BirthDateField = React.forwardRef<HTMLInputElement, BirthDateFieldProps>(
  (
    {
      id,
      value,
      onChange,
      onBlur,
      invalid,
      describedBy,
      disabled,
      placeholder,
      pickLabel,
      yearLabel,
      monthLabel,
    },
    ref,
  ) => {
    const { locale } = useLocale();
    const dfLocale = locale === 'ru' ? dfRu : dfUz;
    const [open, setOpen] = React.useState(false);
    const today = React.useMemo(() => new Date(), []);
    const minDate = React.useMemo(() => new Date(MIN_BIRTH_YEAR, 0, 1), []);
    const selected = React.useMemo(() => toLocalDate(value), [value]);

    // Kalendar koʻrinishi (yil/oy) — tanlangan sana yoki 30 yil oldin (kattalar uchun qulay boshlanish)
    const [view, setView] = React.useState<{ year: number; month: number }>(() => {
      const d = selected ?? new Date(today.getFullYear() - 30, today.getMonth(), 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

    React.useEffect(() => {
      if (selected) setView({ year: selected.getFullYear(), month: selected.getMonth() });
    }, [selected]);

    const years = React.useMemo(() => {
      const out: number[] = [];
      for (let y = today.getFullYear(); y >= MIN_BIRTH_YEAR; y -= 1) out.push(y);
      return out;
    }, [today]);

    const months = React.useMemo(
      () =>
        Array.from({ length: 12 }, (_, i) =>
          capitalize(format(new Date(2024, i, 1), 'LLLL', { locale: dfLocale })),
        ),
      [dfLocale],
    );

    const defaultMonth = React.useMemo(() => new Date(view.year, view.month, 1), [view]);

    const pick = (d: Date) => {
      const parts = { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
      if (!isValidDateParts(parts)) return;
      const key = partsToKey(parts);
      onChange(`${key.slice(8, 10)}.${key.slice(5, 7)}.${key.slice(0, 4)}`);
      setOpen(false);
    };

    return (
      <div className="flex gap-2">
        <Input
          ref={ref}
          id={id}
          inputMode="numeric"
          autoComplete="bday"
          value={value}
          onChange={(e) => onChange(maskDateInput(e.target.value))}
          onBlur={onBlur}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          disabled={disabled}
          maxLength={10}
          className="tabular"
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={pickLabel}
              disabled={disabled}
              className={cn('shrink-0', open && 'border-accent text-accent')}
            >
              <CalendarDays aria-hidden="true" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-auto p-2">
            <div className="mb-1 grid grid-cols-2 gap-2 px-1">
              <Select
                value={String(view.month)}
                onValueChange={(v) => setView((s) => ({ ...s, month: Number(v) }))}
              >
                <SelectTrigger aria-label={monthLabel} className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {months.map((m, i) => (
                    <SelectItem key={m} value={String(i)}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={String(view.year)}
                onValueChange={(v) => setView((s) => ({ ...s, year: Number(v) }))}
              >
                <SelectTrigger aria-label={yearLabel} className="tabular h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)} className="tabular">
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Calendar
              key={`${view.year}-${view.month}`}
              value={selected}
              onChange={pick}
              min={minDate}
              max={today}
              defaultMonth={defaultMonth}
              className="p-2"
            />
          </PopoverContent>
        </Popover>
      </div>
    );
  },
);
BirthDateField.displayName = 'BirthDateField';
