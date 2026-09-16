'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarClock, Sun } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale } from '@/i18n/client';
import { fmtTime } from '@/lib/date';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Money } from '@/components/shared/money';
import { StatusBadge } from '@/components/shared/status-badge';
import { useTodaySummary } from './queries';

/** Topbar "Bugun" xulosasi: tushum, qabullar, navbat va keyingi yozilishlar */
export function TodayPopover({ className }: { className?: string }) {
  const { t, locale } = useLocale();
  const [open, setOpen] = React.useState(false);
  const { data, isLoading, isError } = useTodaySummary(open);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className={cn('size-9 rounded-full text-text-muted hover:text-accent', className)} aria-label={t('dashboard.today.open')} title={t('dashboard.today.open')}>
          <Sun aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[340px] max-w-[calc(100vw-2rem)] p-0">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <div className="font-heading text-sm font-bold text-text">{t('dashboard.today.title')}</div>
            {data ? <div className="text-[11px] text-text-muted">{t('dashboard.today.updatedAt', { time: fmtTime(data.generatedAt, locale) })}</div> : null}
          </div>
          <Button asChild variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs">
            <Link href="/dashboard" onClick={() => setOpen(false)}>
              {t('dashboard.today.more')}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>

        <div className="grid grid-cols-3 divide-x divide-line border-b border-line">
          <TodayStat label={t('dashboard.today.revenue')} loading={isLoading} value={data ? <Money value={data.revenue} suffix={null} /> : null} accent />
          <TodayStat label={t('dashboard.today.visits')} loading={isLoading} value={data ? <span className="tabular">{data.visits}</span> : null} />
          <TodayStat label={t('dashboard.today.waiting')} loading={isLoading} value={data ? <span className="tabular">{data.waiting}</span> : null} />
        </div>

        <div className="px-4 py-3">
          <div className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            <CalendarClock className="size-3.5" aria-hidden="true" />
            {t('dashboard.today.appointments')}
          </div>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-full" />
              <Skeleton className="h-9 w-3/4" />
            </div>
          ) : isError ? (
            <p className="text-sm text-danger">{t('dashboard.errors.today')}</p>
          ) : !data || data.appointments.length === 0 ? (
            <p className="text-sm text-text-muted">{t('dashboard.today.noAppointments')}</p>
          ) : (
            <ul className="max-h-64 space-y-1 overflow-y-auto scrollbar-thin">
              {data.appointments.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/dashboard/appointments?date=${a.startAt.slice(0, 10)}`}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="w-11 shrink-0 font-heading text-sm font-bold text-accent tabular">{fmtTime(a.startAt, locale)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-text">{a.patientName}</span>
                      <span className="flex items-center gap-1 text-[11px] text-text-muted">
                        <span aria-hidden="true" className="inline-block size-1.5 rounded-full" style={{ backgroundColor: a.doctorColor }} />
                        <span className="truncate">{a.doctorName}</span>
                      </span>
                    </span>
                    <StatusBadge kind="appointment" status={a.status} className="shrink-0 text-[10px]" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TodayStat({ label, value, loading, accent = false }: { label: string; value: React.ReactNode; loading: boolean; accent?: boolean }) {
  return (
    <div className="px-3 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{label}</div>
      {loading ? <Skeleton className="mt-1.5 h-5 w-16" /> : <div className={cn('mt-1 truncate font-heading text-base font-bold', accent ? 'text-accent' : 'text-text')}>{value ?? '—'}</div>}
    </div>
  );
}
