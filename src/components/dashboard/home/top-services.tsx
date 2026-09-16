'use client';

import * as React from 'react';
import { Stethoscope } from 'lucide-react';
import { useLocale, pickLang } from '@/i18n/client';
import { formatCount, formatPercent } from '@/lib/dashboard/format';
import type { TopServiceDTO } from '@/lib/dashboard/types';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { Money } from '@/components/shared/money';
import { CHART } from './chart-theme';
import { DashboardCard } from './dashboard-card';

export interface TopServicesProps {
  items: TopServiceDTO[];
  loading: boolean;
  dimmed: boolean;
}

/**
 * Top 10 muolaja — gorizontal barlar (bitta seriya → bitta rang), toʻgʻridan-toʻgʻri belgilar:
 * nom, necha marta, tushum. Roʻyxatning oʻzi jadval ekvivalenti, tooltip kerak emas.
 */
export function TopServices({ items, loading, dimmed }: TopServicesProps) {
  const { t, locale } = useLocale();
  const max = items.reduce((m, s) => Math.max(m, s.revenue), 0);
  const total = items.reduce((s, r) => s + r.revenue, 0);

  return (
    <DashboardCard title={t('dashboard.topServices.title')} description={t('dashboard.topServices.subtitle')} dimmed={dimmed}>
      {loading ? (
        <div className="space-y-3.5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex justify-between">
                <Skeleton className="h-3.5 w-2/3" />
                <Skeleton className="h-3.5 w-16" />
              </div>
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState compact icon={Stethoscope} title={t('dashboard.topServices.empty')} description={t('dashboard.topServices.emptyDescription')} className="min-h-[260px]" />
      ) : (
        <ol className="space-y-3" aria-label={t('dashboard.topServices.ariaChart')}>
          {items.map((s, i) => {
            const width = max > 0 ? Math.max(2, Math.round((s.revenue / max) * 100)) : 0;
            const name = pickLang({ name: s.serviceName, nameRu: s.serviceNameRu }, locale);
            return (
              <li key={s.serviceId} className="group">
                <div className="flex items-baseline gap-2 text-sm">
                  <span className="w-5 shrink-0 text-right text-xs font-semibold text-text-muted tabular">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-text" title={name}>
                    {name}
                  </span>
                  <span className="shrink-0 text-xs text-text-muted tabular">{t('dashboard.topServices.count', { n: formatCount(s.count) })}</span>
                  <Money value={s.revenue} suffix={null} className="shrink-0 text-sm font-semibold text-text" />
                </div>
                <div
                  className="ml-7 mt-1.5 h-2 overflow-hidden rounded-full bg-secondary"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={total > 0 ? Math.round((s.revenue / total) * 100) : 0}
                  aria-label={`${name}: ${formatPercent(total > 0 ? s.revenue / total : 0)}`}
                >
                  <div
                    className="h-full rounded-r-full transition-[width] duration-500 ease-out group-hover:brightness-125"
                    style={{ width: `${width}%`, backgroundColor: CHART.accent }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </DashboardCard>
  );
}
