'use client';

import * as React from 'react';
import { UserCog } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/client';
import { formatCount, formatPercent } from '@/lib/dashboard/format';
import { safeHex } from '@/lib/dashboard/color';
import type { DoctorStatDTO } from '@/lib/dashboard/types';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/shared/empty-state';
import { Money } from '@/components/shared/money';
import { DashboardCard } from './dashboard-card';

export interface DoctorsTableProps {
  doctors: DoctorStatDTO[];
  currentUserId: string;
  loading: boolean;
  dimmed: boolean;
}

/** Shifokorlar samaradorligi: rang nuqtasi, bemorlar, tushum, oʻrtacha chek, ulush (progress) */
export function DoctorsTable({ doctors, currentUserId, loading, dimmed }: DoctorsTableProps) {
  const t = useT();
  const total = doctors.reduce((s, d) => s + d.revenue, 0);

  return (
    <DashboardCard title={t('dashboard.doctors.title')} description={t('dashboard.doctors.subtitle')} dimmed={dimmed} bodyClassName="-mx-5 -mb-5">
      {loading ? (
        <div className="divide-y divide-line px-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-3.5">
              <Skeleton className="size-2.5 rounded-full" />
              <Skeleton className="h-4 w-44" />
              <Skeleton className="ml-auto h-4 w-12" />
              <Skeleton className="hidden h-4 w-24 sm:block" />
              <Skeleton className="hidden h-2 w-28 rounded-full md:block" />
            </div>
          ))}
        </div>
      ) : doctors.length === 0 ? (
        <EmptyState compact icon={UserCog} title={t('dashboard.doctors.empty')} description={t('dashboard.doctors.emptyDescription')} className="min-h-[220px] px-5 pb-5" />
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">{t('dashboard.doctors.doctor')}</TableHead>
              <TableHead className="hidden text-right sm:table-cell">{t('dashboard.doctors.patients')}</TableHead>
              <TableHead className="text-right">{t('dashboard.doctors.revenue')}</TableHead>
              <TableHead className="hidden text-right sm:table-cell">{t('dashboard.doctors.avgCheck')}</TableHead>
              <TableHead className="hidden w-[180px] pr-5 md:table-cell">{t('dashboard.doctors.share')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {doctors.map((d) => {
              const share = total > 0 ? d.revenue / total : 0;
              const color = safeHex(d.color);
              const isMe = d.id === currentUserId;
              return (
                <TableRow key={d.id} className={cn(isMe && 'bg-primary/5')}>
                  <TableCell className="pl-5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="max-w-[46vw] truncate font-medium text-text sm:max-w-none" title={d.fullName}>
                            {d.fullName}
                          </span>
                          {isMe ? (
                            <Badge variant="accent" className="h-5 shrink-0 px-1.5 text-[10px]">
                              {t('dashboard.doctors.you')}
                            </Badge>
                          ) : null}
                        </div>
                        <div className="text-xs text-text-muted sm:hidden">
                          {t('dashboard.doctors.patients')}: <span className="tabular">{formatCount(d.patients)}</span>
                          {' · '}
                          {t('dashboard.doctors.avgCheck')}: <Money value={d.avgCheck} suffix={null} />
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-right tabular sm:table-cell">{formatCount(d.patients)}</TableCell>
                  <TableCell className="text-right">
                    <Money value={d.revenue} suffix={null} className="font-semibold text-text" />
                  </TableCell>
                  <TableCell className="hidden text-right sm:table-cell">
                    <Money value={d.avgCheck} suffix={null} muted />
                  </TableCell>
                  <TableCell className="hidden pr-5 md:table-cell">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-2 flex-1 overflow-hidden rounded-full bg-secondary"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(share * 100)}
                        aria-label={`${d.fullName}: ${formatPercent(share)}`}
                      >
                        <div className="h-full rounded-r-full transition-[width] duration-500 ease-out" style={{ width: `${Math.max(share > 0 ? 2 : 0, share * 100)}%`, backgroundColor: color }} />
                      </div>
                      <span className="w-12 shrink-0 text-right text-xs text-text-muted tabular">{formatPercent(share, 0)}</span>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </DashboardCard>
  );
}
