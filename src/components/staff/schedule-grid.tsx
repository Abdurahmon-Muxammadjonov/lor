'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { CalendarClock, Coffee, Stethoscope, Users } from 'lucide-react';
import { useT } from '@/i18n/client';
import { cn } from '@/lib/utils';
import { hexToRgba, safeHex } from '@/lib/staff/color';
import {
  DAY_ORDER,
  daySegments,
  formatBreak,
  formatDayRange,
  isDayKey,
  isWorkingAt,
  timelineBounds,
  timelineTicks,
  weeklyHours,
} from '@/lib/staff/schedule';
import type { StaffUserDTO } from '@/lib/staff/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { RoleBadge } from './role-badge';
import { StaffAvatar } from './staff-avatar';
import { useStaffList } from './use-staff';

export interface ScheduleGridProps {
  currentUserId: string;
}

type Scope = 'doctors' | 'all';

const GRID_COLS = 'grid-cols-[minmax(11.5rem,14rem)_repeat(7,minmax(6.75rem,1fr))]';

function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

function GridSkeleton() {
  return (
    <div className="card-surface overflow-hidden" aria-busy="true" aria-hidden="true">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="ml-auto h-6 w-32" />
      </div>
      <div className="divide-y divide-line">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="size-9 rounded-full" />
            <Skeleton className="h-4 w-36" />
            <div className="ml-auto flex gap-2">
              {Array.from({ length: 7 }).map((_, j) => (
                <Skeleton key={j} className="hidden h-8 w-20 md:block" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Haftalik ish jadvali toʻri: har bir xodim × Du–Ya. Har katakda ish vaqti (tanaffus boʻlsa ikkiga boʻlingan bar)
 * umumiy vaqt oʻqiga nisbatan chiziladi; bugungi ustun ajratiladi, hozir ishlayotganlar belgilanadi.
 */
export function ScheduleGrid({ currentUserId }: ScheduleGridProps) {
  const t = useT();
  const [scope, setScope] = React.useState<Scope>('doctors');
  const list = useStaffList(scope === 'doctors' ? { role: 'DOCTOR', active: '1' } : { active: '1' });
  const now = useNow();
  const today = now.getDay();

  React.useEffect(() => {
    if (list.isError) toast.error(t('staff.toasts.loadError'));
  }, [list.isError, t]);

  const items: StaffUserDTO[] = React.useMemo(() => list.data?.items ?? [], [list.data]);
  const bounds = React.useMemo(() => timelineBounds(items.map((u) => u.schedule)), [items]);
  const ticks = React.useMemo(() => timelineTicks(bounds), [bounds]);
  const workingToday = isDayKey(today) ? items.filter((u) => u.schedule[today].enabled).length : 0;

  return (
    <section className="space-y-4" aria-labelledby="schedule-grid-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="schedule-grid-title" className="font-heading text-lg font-bold text-text">
            {t('staff.schedule.title')}
          </h2>
          <p className="text-sm text-text-muted">{t('staff.schedule.description')}</p>
        </div>
        <Segmented<Scope>
          value={scope}
          onChange={setScope}
          size="sm"
          ariaLabel={t('common.filter')}
          options={[
            { value: 'doctors', label: t('staff.schedule.onlyDoctors'), icon: <Stethoscope aria-hidden="true" /> },
            { value: 'all', label: t('staff.schedule.allStaff'), icon: <Users aria-hidden="true" /> },
          ]}
        />
      </div>

      {list.isLoading ? (
        <GridSkeleton />
      ) : list.isError ? (
        <EmptyState
          icon={CalendarClock}
          title={t('staff.toasts.loadError')}
          action={
            <Button variant="outline" onClick={() => list.refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState icon={CalendarClock} title={t('staff.schedule.empty')} />
      ) : (
        <div className="glass overflow-hidden">
          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-4 py-2.5 text-xs text-text-muted">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="inline-block h-2 w-5 rounded-sm bg-accent" />
              {t('staff.schedule.legendWork')}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Coffee className="size-3.5" aria-hidden="true" />
              {t('staff.schedule.legendBreak')}
            </span>
            <span className="inline-flex items-center gap-1.5 tabular">
              <span className="sr-only">{t('staff.schedule.timeline')}: </span>
              {ticks[0]} – {ticks[ticks.length - 1]}
            </span>
            <Badge variant={workingToday > 0 ? 'accent' : 'outline'} className="ml-auto">
              {workingToday > 0 ? t('staff.schedule.workingToday', { n: workingToday }) : t('staff.schedule.nobodyToday')}
            </Badge>
          </div>

          <div className="overflow-x-auto scrollbar-thin">
            <div role="table" aria-label={t('staff.schedule.title')} className="min-w-[60rem]">
              {/* Sarlavha qatori */}
              <div role="row" className={cn('grid border-b border-line bg-popover/60 text-xs font-semibold uppercase tracking-wider text-text-muted', GRID_COLS)}>
                <div role="columnheader" className="sticky left-0 z-10 bg-bg-elevated px-4 py-2.5">
                  {t('staff.schedule.staff')}
                </div>
                {DAY_ORDER.map((k) => {
                  const isToday = k === today;
                  return (
                    <div
                      role="columnheader"
                      key={k}
                      className={cn('px-2 py-2.5 text-center', isToday && 'text-accent')}
                      aria-current={isToday ? 'date' : undefined}
                    >
                      <span className="hidden lg:inline">{t(`staff.days.long.${k}`)}</span>
                      <span className="lg:hidden">{t(`staff.days.short.${k}`)}</span>
                      {isToday ? <span className="ml-1 text-[10px] normal-case tracking-normal">· {t('staff.schedule.today')}</span> : null}
                    </div>
                  );
                })}
              </div>

              {/* Xodim qatorlari */}
              {items.map((u) => {
                const hex = safeHex(u.color);
                const workingNow = isWorkingAt(u.schedule, now);
                const isSelf = u.id === currentUserId;
                return (
                  <div role="row" key={u.id} className={cn('grid border-b border-line last:border-b-0', GRID_COLS)}>
                    <div role="rowheader" className="sticky left-0 z-10 flex items-center gap-3 bg-bg-elevated px-4 py-3">
                      <StaffAvatar name={u.fullName} color={hex} size="sm" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold text-text">{u.fullName}</span>
                          {workingNow ? (
                            <span className="relative flex size-2 shrink-0" title={t('staff.schedule.workingNow')}>
                              <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#00FFB2] opacity-60 motion-reduce:hidden" />
                              <span className="relative inline-flex size-2 rounded-full bg-[#00FFB2]" />
                              <span className="sr-only">{t('staff.schedule.workingNow')}</span>
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-text-muted">
                          {scope === 'all' ? <RoleBadge role={u.role} className="px-1.5 py-0 text-[10px]" /> : u.specialty ? <span className="truncate">{u.specialty}</span> : null}
                          <span className="tabular">{t('staff.schedule.hoursPerWeek', { h: weeklyHours(u.schedule) })}</span>
                          {isSelf ? <span className="text-accent">· {t('staff.card.you')}</span> : null}
                        </div>
                      </div>
                    </div>

                    {DAY_ORDER.map((k) => {
                      const day = u.schedule[k];
                      const isToday = k === today;
                      const brk = formatBreak(day);
                      const segs = daySegments(day, bounds);
                      const label = day.enabled
                        ? `${t(`staff.days.long.${k}`)}: ${formatDayRange(day)}${brk ? ` · ${t('staff.schedule.break', { t: brk })}` : ''}`
                        : `${t(`staff.days.long.${k}`)}: ${t('staff.card.dayOff')}`;
                      return (
                        <div
                          role="cell"
                          key={k}
                          aria-label={label}
                          className={cn('flex flex-col justify-center gap-1 px-2 py-3', isToday && 'bg-primary/5')}
                        >
                          {day.enabled ? (
                            <>
                              <div className="text-center text-xs font-medium text-text tabular">{formatDayRange(day)}</div>
                              <div aria-hidden="true" className="relative h-2 w-full overflow-hidden rounded-full bg-secondary/70">
                                {segs.map((s, i) => (
                                  <span
                                    key={i}
                                    className="absolute inset-y-0 rounded-full"
                                    style={{ left: `${s.left}%`, width: `${s.width}%`, backgroundColor: hex, boxShadow: `0 0 8px ${hexToRgba(hex, 0.5)}` }}
                                  />
                                ))}
                              </div>
                              {brk ? (
                                <div className="flex items-center justify-center gap-1 text-[10px] text-text-muted tabular">
                                  <Coffee className="size-3" aria-hidden="true" />
                                  {brk}
                                </div>
                              ) : (
                                <div className="h-[15px]" aria-hidden="true" />
                              )}
                            </>
                          ) : (
                            <div className="text-center text-xs text-muted-foreground/70">{t('staff.schedule.dayOff')}</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
