'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { useLocale } from '@/i18n/client';
import { CLINIC_TZ } from '@/lib/date';

export interface LiveClockProps {
  className?: string;
  timeClassName?: string;
  dateClassName?: string;
  /** Sanani ham koʻrsatish (default true) */
  withDate?: boolean;
  /** Soniyalarni koʻrsatish */
  withSeconds?: boolean;
}

/** Toshkent vaqti boʻyicha jonli soat (kiosk / tablo) */
export function LiveClock({ className, timeClassName, dateClassName, withDate = true, withSeconds = false }: LiveClockProps) {
  const { locale } = useLocale();
  const [now, setNow] = React.useState<Date | null>(null);

  React.useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), withSeconds ? 1000 : 10_000);
    return () => clearInterval(id);
  }, [withSeconds]);

  const time = React.useMemo(
    () =>
      new Intl.DateTimeFormat('ru-RU', {
        timeZone: CLINIC_TZ,
        hour: '2-digit',
        minute: '2-digit',
        ...(withSeconds ? { second: '2-digit' } : {}),
        hourCycle: 'h23',
      }),
    [withSeconds],
  );
  const date = React.useMemo(
    () => new Intl.DateTimeFormat(locale === 'ru' ? 'ru-RU' : 'uz-Latn-UZ', { timeZone: CLINIC_TZ, weekday: 'long', day: 'numeric', month: 'long' }),
    [locale],
  );

  return (
    <div className={cn('flex flex-col items-end', className)} aria-live="off">
      <span className={cn('tabular font-heading text-2xl font-semibold text-text', timeClassName)} suppressHydrationWarning>
        {now ? time.format(now) : '--:--'}
      </span>
      {withDate ? (
        <span className={cn('text-sm capitalize text-text-muted', dateClassName)} suppressHydrationWarning>
          {now ? date.format(now) : ''}
        </span>
      ) : null}
    </div>
  );
}
