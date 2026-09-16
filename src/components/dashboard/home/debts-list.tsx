'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowUpRight, HandCoins } from 'lucide-react';
import { useLocale } from '@/i18n/client';
import { fmtDate } from '@/lib/date';
import type { DebtDTO } from '@/lib/dashboard/types';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { EmptyState } from '@/components/shared/empty-state';
import { Money } from '@/components/shared/money';
import { DashboardCard } from './dashboard-card';

export interface DebtsListProps {
  debts: DebtDTO[];
  total: number;
  loading: boolean;
  dimmed: boolean;
}

/** Toʻlanmagan qarzlar: bemor, qabul sanasi, qoldiq, qabulga havola; jami qarz */
export function DebtsList({ debts, total, loading, dimmed }: DebtsListProps) {
  const { t, locale } = useLocale();

  return (
    <DashboardCard
      title={t('dashboard.debts.title')}
      description={t('dashboard.debts.subtitle')}
      dimmed={dimmed}
      actions={
        loading ? (
          <Skeleton className="h-9 w-32" />
        ) : (
          <div className="text-right">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{t('dashboard.debts.total')}</div>
            <Money value={total} className="font-heading text-base font-bold text-danger" />
          </div>
        )
      }
    >
      {loading ? (
        <div className="divide-y divide-line">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-3">
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-48 max-w-full" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-4 w-20" />
              <Skeleton className="size-8 rounded-md" />
            </div>
          ))}
        </div>
      ) : debts.length === 0 ? (
        <EmptyState compact icon={HandCoins} title={t('dashboard.debts.empty')} description={t('dashboard.debts.emptyDescription')} className="min-h-[220px]" />
      ) : (
        <>
          <ul className="max-h-[420px] divide-y divide-line overflow-y-auto pr-1 scrollbar-thin">
            {debts.map((d) => (
              <li key={d.visitId} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/dashboard/patients/${d.patientId}`}
                    className="block truncate text-sm font-medium text-text transition-colors hover:text-accent focus-visible:outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {d.patientName}
                  </Link>
                  <div className="truncate text-xs text-text-muted tabular">
                    {d.cardNumber} · {fmtDate(d.date, locale)}
                  </div>
                </div>
                <Money value={d.balance} suffix={null} className="shrink-0 text-sm font-semibold text-danger" aria-label={`${t('dashboard.debts.balance')}: ${d.balance}`} />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button asChild variant="ghost" size="icon" className="size-8 shrink-0 text-text-muted hover:text-accent">
                      <Link href={`/dashboard/visits/${d.visitId}`} aria-label={`${t('dashboard.debts.open')}: ${d.patientName}`}>
                        <ArrowUpRight aria-hidden="true" />
                      </Link>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left">{t('dashboard.debts.open')}</TooltipContent>
                </Tooltip>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-xs text-text-muted">
            <span>{t('dashboard.debts.count', { n: debts.length })}</span>
            <span>{t('dashboard.debts.showingTop')}</span>
          </div>
        </>
      )}
    </DashboardCard>
  );
}
