'use client';

import * as React from 'react';
import { CalendarCheck, Receipt, Users, Wallet, WalletCards } from 'lucide-react';
import { useT } from '@/i18n/client';
import { formatCount } from '@/lib/reports/format';
import type { SummaryDTO } from '@/lib/reports/types';
import { Money } from '@/components/shared/money';
import { StatCard } from '@/components/shared/stat-card';

export interface KpiCardsProps {
  summary: SummaryDTO | undefined;
  loading: boolean;
  dimmed: boolean;
}

/** KPI qatori: tushum, qabullar, bemorlar, oʻrtacha chek, qarz — oldingi davrga nisbatan oʻzgarish bilan */
export function KpiCards({ summary, loading, dimmed }: KpiCardsProps) {
  const t = useT();
  const s = summary;
  const vs = t('reports.kpi.vsPrevious');
  return (
    <div className={dimmed ? 'opacity-60 transition-opacity' : 'transition-opacity'} aria-busy={dimmed || loading || undefined}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5 sm:gap-4">
        <StatCard
          title={t('reports.kpi.revenue')}
          value={<Money value={s?.revenue ?? 0} />}
          delta={s?.deltas.revenue ?? undefined}
          deltaLabel={s?.deltas.revenue != null ? vs : undefined}
          icon={Wallet}
          accent="mint"
          loading={loading}
        />
        <StatCard
          title={t('reports.kpi.visits')}
          value={formatCount(s?.visits ?? 0)}
          delta={s?.deltas.visits ?? undefined}
          deltaLabel={s?.deltas.visits != null ? vs : undefined}
          icon={CalendarCheck}
          accent="cyan"
          loading={loading}
        />
        <StatCard
          title={t('reports.kpi.patients')}
          value={formatCount(s?.patients ?? 0)}
          delta={s?.deltas.patients ?? undefined}
          deltaLabel={s?.deltas.patients != null ? vs : undefined}
          hint={s ? t('reports.kpi.newPatients', { n: s.newPatients }) : undefined}
          icon={Users}
          accent="violet"
          loading={loading}
        />
        <StatCard
          title={t('reports.kpi.avgCheck')}
          value={<Money value={s?.avgCheck ?? 0} />}
          delta={s?.deltas.avgCheck ?? undefined}
          deltaLabel={s?.deltas.avgCheck != null ? vs : undefined}
          icon={Receipt}
          accent="cyan"
          loading={loading}
        />
        <StatCard
          title={t('reports.kpi.debt')}
          value={<Money value={s?.debt ?? 0} />}
          hint={
            s ? (
              <>
                {t('reports.excel.meta.previous')}: <Money value={s.previous.debt} />
              </>
            ) : undefined
          }
          icon={WalletCards}
          accent="danger"
          loading={loading}
        />
      </div>
    </div>
  );
}
