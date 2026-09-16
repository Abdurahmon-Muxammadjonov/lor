'use client';

import * as React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowRight, CalendarDays } from 'lucide-react';
import { useLocale } from '@/i18n/client';
import { fmtTime, todayKey } from '@/lib/date';
import { safeHex } from '@/lib/dashboard/color';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { StatusBadge } from '@/components/shared/status-badge';
import { useTodaySummary } from '../queries';
import { DashboardCard } from './dashboard-card';

/** Bugungi yozilishlar (GET /api/dashboard/today) — keyingi 8 ta, kalendarga havola */
export function TodayAppointments() {
  const { t, locale } = useLocale();
  const { data, isLoading, isError, error, isFetching, refetch } = useTodaySummary(true);
  const items = data?.appointments ?? [];

  const errorMessage = error?.message;
  React.useEffect(() => {
    if (isError) toast.error(t('dashboard.errors.today'), { id: 'dashboard-today-error', description: errorMessage });
  }, [isError, errorMessage, t]);
  const calendarHref = `/dashboard/appointments?date=${todayKey()}`;

  return (
    <DashboardCard
      title={t('dashboard.appointments.title')}
      description={t('dashboard.appointments.subtitle')}
      dimmed={isFetching && !isLoading}
      actions={
        <Button asChild variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs">
          <Link href={calendarHref}>
            {t('dashboard.appointments.all')}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Button>
      }
    >
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-1.5">
              <Skeleton className="h-5 w-11" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-40 max-w-full" />
                <Skeleton className="h-3 w-28" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <EmptyState
          compact
          icon={CalendarDays}
          title={t('dashboard.errors.today')}
          action={
            <Button variant="outline" size="sm" onClick={() => void refetch()}>
              {t('common.retry')}
            </Button>
          }
          className="min-h-[220px]"
        />
      ) : items.length === 0 ? (
        <EmptyState
          compact
          icon={CalendarDays}
          title={t('dashboard.appointments.empty')}
          description={t('dashboard.appointments.emptyDescription')}
          action={
            <Button asChild variant="outline" size="sm">
              <Link href={calendarHref}>{t('dashboard.appointments.all')}</Link>
            </Button>
          }
          className="min-h-[220px]"
        />
      ) : (
        <ol className="divide-y divide-line">
          {items.map((a) => (
            <li key={a.id}>
              <Link
                href={calendarHref}
                className="-mx-2 flex items-center gap-3 rounded-md px-2 py-2 transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <time dateTime={a.startAt} className="w-11 shrink-0 font-heading text-sm font-bold text-accent tabular">
                  {fmtTime(a.startAt, locale)}
                </time>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-text">{a.patientName}</span>
                  <span className="flex items-center gap-1.5 text-xs text-text-muted">
                    <span aria-hidden="true" className="inline-block size-1.5 shrink-0 rounded-full" style={{ backgroundColor: safeHex(a.doctorColor) }} />
                    <span className="truncate">{a.doctorName}</span>
                  </span>
                </span>
                <StatusBadge kind="appointment" status={a.status} className="shrink-0 text-[10px]" />
              </Link>
            </li>
          ))}
        </ol>
      )}
    </DashboardCard>
  );
}
