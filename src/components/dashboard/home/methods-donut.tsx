'use client';

import * as React from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { TooltipProps } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { CreditCard } from 'lucide-react';
import type { PayMethod } from '@prisma/client';
import { cn } from '@/lib/utils';
import { useLocale } from '@/i18n/client';
import { useMounted } from '@/hooks/use-mounted';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { formatCompactMoney, formatPercent } from '@/lib/dashboard/format';
import type { ByMethodDTO } from '@/lib/dashboard/types';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { Money } from '@/components/shared/money';
import { CHART, METHOD_COLORS, METHOD_ORDER } from './chart-theme';
import { ChartTooltipFrame } from './chart-tooltip';
import { DashboardCard } from './dashboard-card';

export interface MethodsDonutProps {
  byMethod: ByMethodDTO[];
  loading: boolean;
  dimmed: boolean;
}

interface Slice {
  method: PayMethod;
  amount: number;
  share: number;
}

const DONUT_SIZE = 200;

function isSlice(v: unknown): v is Slice {
  return !!v && typeof v === 'object' && 'method' in v && 'amount' in v && 'share' in v;
}

/** Toʻlov usullari ulushi — donut (rang usulga qatʼiy bogʻlangan) + roʻyxat (jadval ekvivalenti) */
export function MethodsDonut({ byMethod, loading, dimmed }: MethodsDonutProps) {
  const { t, locale } = useLocale();
  const mounted = useMounted();
  const reduced = useReducedMotion();
  const [active, setActive] = React.useState<PayMethod | null>(null);
  const [animate, setAnimate] = React.useState(true);

  const { slices, total } = React.useMemo(() => {
    const positive = METHOD_ORDER.map((m) => ({ method: m, amount: byMethod.find((b) => b.method === m)?.amount ?? 0 })).filter((r) => r.amount > 0);
    const sum = positive.reduce((s, r) => s + r.amount, 0);
    const list: Slice[] = positive.map((r) => ({ ...r, share: sum > 0 ? r.amount / sum : 0 }));
    return { slices: list, total: sum };
  }, [byMethod]);

  const renderTooltip = React.useCallback(
    (props: TooltipProps<ValueType, NameType>) => {
      const row = props.payload?.[0]?.payload as unknown;
      if (!props.active || !isSlice(row)) return null;
      return (
        <ChartTooltipFrame
          rows={[
            { key: 'amount', value: <Money value={row.amount} />, label: t(`common.payMethod.${row.method}`), color: METHOD_COLORS[row.method], kind: 'rect' },
            { key: 'share', value: formatPercent(row.share), label: t('dashboard.doctors.share') },
          ]}
        />
      );
    },
    [t],
  );

  const empty = !loading && slices.length === 0;

  return (
    <DashboardCard title={t('dashboard.methods.title')} description={t('dashboard.methods.subtitle')} dimmed={dimmed}>
      {loading || !mounted ? (
        <div className="space-y-5">
          <div className="flex justify-center">
            <Skeleton className="rounded-full" style={{ width: DONUT_SIZE, height: DONUT_SIZE }} />
          </div>
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
      ) : empty ? (
        <EmptyState compact icon={CreditCard} title={t('dashboard.methods.empty')} description={t('dashboard.methods.emptyDescription')} className="min-h-[260px]" />
      ) : (
        <div className="flex flex-col items-center gap-5">
          <figure role="img" aria-label={t('dashboard.methods.ariaChart')} className="relative m-0" style={{ width: DONUT_SIZE, height: DONUT_SIZE }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={slices}
                  dataKey="amount"
                  nameKey="method"
                  cx="50%"
                  cy="50%"
                  innerRadius="66%"
                  outerRadius="92%"
                  paddingAngle={slices.length > 1 ? 2 : 0}
                  stroke={CHART.surface}
                  strokeWidth={2}
                  startAngle={90}
                  endAngle={-270}
                  isAnimationActive={!reduced && animate}
                  animationDuration={700}
                  onAnimationEnd={() => setAnimate(false)}
                  onMouseEnter={(_, i) => setActive(slices[i]?.method ?? null)}
                  onMouseLeave={() => setActive(null)}
                >
                  {slices.map((s) => (
                    <Cell
                      key={s.method}
                      fill={METHOD_COLORS[s.method]}
                      opacity={active && active !== s.method ? 0.45 : 1}
                      style={{ transition: 'opacity 150ms ease-out', outline: 'none' }}
                    />
                  ))}
                </Pie>
                <Tooltip content={renderTooltip} isAnimationActive={false} />
              </PieChart>
            </ResponsiveContainer>
            <figcaption className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{t('dashboard.methods.total')}</span>
              <span className="font-heading text-lg font-bold text-text" title={String(total)}>
                {formatCompactMoney(total, locale)}
              </span>
              <span className="text-[11px] text-text-muted">{t('common.currency')}</span>
            </figcaption>
          </figure>

          <ul className="w-full space-y-1" aria-label={t('dashboard.methods.title')}>
            {slices.map((s) => (
              <li
                key={s.method}
                onMouseEnter={() => setActive(s.method)}
                onMouseLeave={() => setActive(null)}
                className={cn('flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors', active === s.method && 'bg-surface')}
              >
                <span aria-hidden="true" className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: METHOD_COLORS[s.method] }} />
                <span className="min-w-0 flex-1 truncate text-text">{t(`common.payMethod.${s.method}`)}</span>
                <span className="w-14 shrink-0 text-right text-xs text-text-muted tabular">{formatPercent(s.share)}</span>
                <Money value={s.amount} suffix={null} className="shrink-0 text-right font-medium text-text" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </DashboardCard>
  );
}
