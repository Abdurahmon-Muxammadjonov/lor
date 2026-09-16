'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { BarChart3, CalendarRange, Stethoscope } from 'lucide-react';
import type { SessionUser } from '@/lib/auth/session';
import { fmtTime } from '@/lib/date';
import { useLocale } from '@/i18n/client';
import { shortName, type GreetingKey } from '@/lib/dashboard/greeting';
import { STATS_RANGES, type StatsRange } from '@/lib/dashboard/types';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { useDashboardStats, useDoctorOptions, useQueueCount } from '../queries';
import { DebtsList } from './debts-list';
import { DoctorsTable } from './doctors-table';
import { MethodsDonut } from './methods-donut';
import { RevenueChart } from './revenue-chart';
import { StatCards } from './stat-cards';
import { TodayAppointments } from './today-appointments';
import { TopServices } from './top-services';

export interface HomeDashboardProps {
  user: SessionUser;
  /** Bugungi sana matni — serverda klinika vaqt mintaqasi va joriy tilda tayyorlanadi (gidratsiya bir xil boʻlsin) */
  dateLabel: string;
  greeting: GreetingKey;
}

const ALL_DOCTORS = 'all';

function isRange(v: string): v is `${StatsRange}` {
  return v === '7' || v === '30' || v === '90';
}

function capitalizeFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Bosh sahifa: salomlashuv + filtr qatori (davr, shifokor), koʻrsatkichlar, grafiklar, jadvallar */
export function HomeDashboard({ user, dateLabel, greeting }: HomeDashboardProps) {
  const { t, locale } = useLocale();
  const isDoctor = user.role === 'DOCTOR';
  const [range, setRange] = React.useState<StatsRange>(7);
  const [doctorId, setDoctorId] = React.useState<string>(ALL_DOCTORS);
  const effectiveDoctorId = isDoctor ? null : doctorId === ALL_DOCTORS ? null : doctorId;

  const stats = useDashboardStats(range, effectiveDoctorId);
  const queue = useQueueCount();
  const doctors = useDoctorOptions(!isDoctor);

  const errorMessage = stats.error?.message;
  React.useEffect(() => {
    if (!stats.isError) return;
    toast.error(t('dashboard.errors.stats'), { id: 'dashboard-stats-error', description: errorMessage });
  }, [stats.isError, errorMessage, t]);

  const data = stats.data;
  const loading = stats.isLoading;
  const dimmed = stats.isFetching && !stats.isLoading;
  const doctorOptions = doctors.data ?? [];

  const rangeOptions = STATS_RANGES.map((r) => ({ value: `${r}` as `${StatsRange}`, label: t(`dashboard.range.d${r}`) }));

  return (
    <div className="space-y-6 animate-in fade-in-0 duration-500">
      <PageHeader
        title={t(`dashboard.greeting.${greeting}`, { name: shortName(user.fullName) })}
        description={
          <>
            <span>{capitalizeFirst(dateLabel)}</span>
            <span className="mx-1.5 text-muted-foreground/60" aria-hidden="true">
              ·
            </span>
            {isDoctor ? t('dashboard.subtitleDoctor') : t('dashboard.subtitle')}
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Segmented<`${StatsRange}`>
              size="sm"
              variant="accent"
              value={`${range}`}
              onChange={(v) => {
                if (isRange(v)) setRange(Number(v) as StatsRange);
              }}
              options={rangeOptions}
              ariaLabel={t('dashboard.range.label')}
            />
            {!isDoctor && doctorOptions.length > 0 ? (
              <Select value={doctorId} onValueChange={setDoctorId}>
                <SelectTrigger className="h-9 w-[200px] max-w-full text-xs" aria-label={t('dashboard.doctorFilter.label')}>
                  <Stethoscope className="size-3.5 shrink-0 text-text-muted" aria-hidden="true" />
                  <SelectValue placeholder={t('dashboard.doctorFilter.all')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_DOCTORS}>{t('dashboard.doctorFilter.all')}</SelectItem>
                  {doctorOptions.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>
        }
      />

      <StatCards today={data?.today} waitingLive={queue.data?.waiting} loading={loading} role={user.role} />

      {stats.isError && !data ? (
        <EmptyState
          icon={BarChart3}
          title={t('dashboard.errors.stats')}
          description={errorMessage}
          action={
            <Button variant="gradient" onClick={() => void stats.refetch()} loading={stats.isFetching}>
              {t('common.retry')}
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="min-w-0 lg:col-span-2 [&>section]:h-full">
              <RevenueChart series={data?.series ?? []} range={range} loading={loading} dimmed={dimmed} />
            </div>
            <div className="min-w-0 [&>section]:h-full">
              <MethodsDonut byMethod={data?.byMethod ?? []} loading={loading} dimmed={dimmed} />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="min-w-0 [&>section]:h-full">
              <TopServices items={data?.topServices ?? []} loading={loading} dimmed={dimmed} />
            </div>
            <div className="min-w-0 lg:col-span-2 [&>section]:h-full">
              <DoctorsTable doctors={data?.doctors ?? []} currentUserId={user.id} loading={loading} dimmed={dimmed} />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="min-w-0 lg:col-span-2 [&>section]:h-full">
              <DebtsList debts={data?.debts ?? []} total={data?.debtTotal ?? 0} loading={loading} dimmed={dimmed} />
            </div>
            <div className="min-w-0 [&>section]:h-full">
              <TodayAppointments />
            </div>
          </div>
        </>
      )}

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground/80">
        <CalendarRange className="size-3.5" aria-hidden="true" />
        {t('dashboard.range.label')}: {t('dashboard.range.days', { n: range })}
        {data ? ` · ${t('dashboard.today.updatedAt', { time: fmtTime(data.generatedAt, locale) })}` : ''}
      </p>
    </div>
  );
}
