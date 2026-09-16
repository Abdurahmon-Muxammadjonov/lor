'use client';

import * as React from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TooltipProps } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { BarChart3, LineChart, TableProperties } from 'lucide-react';
import { useLocale } from '@/i18n/client';
import { useMounted } from '@/hooks/use-mounted';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { fmtDate } from '@/lib/date';
import { formatCompactMoney, formatAxisDate, formatLongDate, formatCount } from '@/lib/dashboard/format';
import type { SeriesPointDTO, StatsRange } from '@/lib/dashboard/types';
import { Segmented } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/shared/empty-state';
import { Money } from '@/components/shared/money';
import { AXIS_TICK, CHART, CHART_HEIGHT } from './chart-theme';
import { ChartTooltipFrame } from './chart-tooltip';
import { DashboardCard } from './dashboard-card';

type View = 'chart' | 'table';

export interface RevenueChartProps {
  series: SeriesPointDTO[];
  range: StatsRange;
  loading: boolean;
  dimmed: boolean;
}

function isSeriesPoint(v: unknown): v is SeriesPointDTO {
  return !!v && typeof v === 'object' && 'date' in v && 'revenue' in v && 'visits' in v;
}

/** Kunlik tushum (bitta seriya): 2px chiziq + yumshoq gradient, kesishuvchi kursor, eng yaxshi kun belgisi, jadval koʻrinishi */
export function RevenueChart({ series, range, loading, dimmed }: RevenueChartProps) {
  const { t, locale } = useLocale();
  const mounted = useMounted();
  const reduced = useReducedMotion();
  const gradientId = React.useId().replace(/:/g, '');
  const [view, setView] = React.useState<View>('chart');
  /** Kirish animatsiyasi faqat bir marta: keyin oʻlcham oʻzgarganda (yon panel yigʻilishi) qayta boshlanmaydi va qotib qolmaydi */
  const [animate, setAnimate] = React.useState(true);

  const summary = React.useMemo(() => {
    const total = series.reduce((s, p) => s + p.revenue, 0);
    const visits = series.reduce((s, p) => s + p.visits, 0);
    const best = series.reduce<SeriesPointDTO | null>((b, p) => (p.revenue > 0 && (!b || p.revenue > b.revenue) ? p : b), null);
    const avg = series.length > 0 ? Math.round(total / series.length) : 0;
    return { total, visits, best, avg };
  }, [series]);

  const renderTooltip = React.useCallback(
    (props: TooltipProps<ValueType, NameType>) => {
      const row = props.payload?.[0]?.payload as unknown;
      if (!props.active || !isSeriesPoint(row)) return null;
      return (
        <ChartTooltipFrame
          title={formatLongDate(row.date, locale)}
          rows={[
            { key: 'revenue', value: <Money value={row.revenue} />, label: t('dashboard.revenue.revenue'), color: CHART.accent, kind: 'line' },
            { key: 'visits', value: formatCount(row.visits), label: t('dashboard.revenue.visits') },
          ]}
        />
      );
    },
    [locale, t],
  );

  const empty = !loading && summary.total === 0 && summary.visits === 0;

  return (
    <DashboardCard
      title={t('dashboard.revenue.title')}
      description={t('dashboard.revenue.subtitle', { n: range })}
      dimmed={dimmed}
      actions={
        <Segmented<View>
          size="sm"
          value={view}
          onChange={setView}
          ariaLabel={t('dashboard.revenue.viewToggle')}
          options={[
            { value: 'chart', label: <span className="sr-only sm:not-sr-only">{t('dashboard.revenue.chart')}</span>, icon: <LineChart aria-hidden="true" /> },
            { value: 'table', label: <span className="sr-only sm:not-sr-only">{t('dashboard.revenue.table')}</span>, icon: <TableProperties aria-hidden="true" /> },
          ]}
        />
      }
    >
      {loading || !mounted ? (
        <Skeleton className="w-full rounded-lg" style={{ height: CHART_HEIGHT }} />
      ) : empty ? (
        <EmptyState compact icon={BarChart3} title={t('dashboard.revenue.empty')} description={t('dashboard.revenue.emptyDescription')} className="min-h-[260px]" />
      ) : view === 'table' ? (
        <div className="max-h-[260px] overflow-auto rounded-lg border border-line scrollbar-thin">
          <Table>
            <TableHeader className="sticky top-0 z-10">
              <TableRow>
                <TableHead>{t('dashboard.revenue.date')}</TableHead>
                <TableHead className="text-right">{t('dashboard.revenue.revenue')}</TableHead>
                <TableHead className="text-right">{t('dashboard.revenue.visits')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {series.map((p) => (
                <TableRow key={p.date}>
                  <TableCell className="tabular">{fmtDate(`${p.date}T00:00:00`, locale)}</TableCell>
                  <TableCell className="text-right">
                    <Money value={p.revenue} suffix={null} />
                  </TableCell>
                  <TableCell className="text-right tabular">{formatCount(p.visits)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <figure role="img" aria-label={t('dashboard.revenue.ariaChart')} className="m-0 -ml-2">
          <ResponsiveContainer width="100%" height={CHART_HEIGHT} debounce={120}>
            <AreaChart data={series} margin={{ top: 18, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART.accent} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={CHART.accent} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={CHART.grid} strokeWidth={1} />
              <XAxis
                dataKey="date"
                tickFormatter={(v: string) => formatAxisDate(v, locale)}
                tick={AXIS_TICK}
                axisLine={{ stroke: CHART.grid }}
                tickLine={false}
                minTickGap={28}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={(v: number) => formatCompactMoney(v, locale, 1)}
                tick={{ ...AXIS_TICK, width: 120 }}
                axisLine={false}
                tickLine={false}
                width={68}
                tickCount={5}
                allowDecimals={false}
              />
              <Tooltip content={renderTooltip} cursor={{ stroke: CHART.cursor, strokeWidth: 1 }} isAnimationActive={false} />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke={CHART.accent}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
                fill={`url(#${gradientId})`}
                dot={false}
                activeDot={{ r: 5, fill: CHART.accent, stroke: CHART.surface, strokeWidth: 2 }}
                isAnimationActive={!reduced && animate}
                animationDuration={700}
                onAnimationEnd={() => setAnimate(false)}
              />
              {summary.best ? (
                <ReferenceDot
                  x={summary.best.date}
                  y={summary.best.revenue}
                  r={4}
                  fill={CHART.accent}
                  stroke={CHART.surface}
                  strokeWidth={2}
                  ifOverflow="extendDomain"
                  label={{
                    value: formatCompactMoney(summary.best.revenue, locale),
                    position: 'top',
                    fill: CHART.text,
                    fontSize: 11,
                    fontWeight: 600,
                    offset: 8,
                  }}
                />
              ) : null}
            </AreaChart>
          </ResponsiveContainer>
        </figure>
      )}

      {!loading && !empty ? (
        <dl className="mt-4 grid grid-cols-3 gap-3 border-t border-line pt-4">
          <SummaryItem label={t('dashboard.revenue.total')} value={<Money value={summary.total} suffix={null} />} accent />
          <SummaryItem label={t('dashboard.revenue.avgPerDay')} value={<Money value={summary.avg} suffix={null} />} />
          <SummaryItem
            label={t('dashboard.revenue.best')}
            value={summary.best ? <Money value={summary.best.revenue} suffix={null} /> : '—'}
            hint={summary.best ? fmtDate(`${summary.best.date}T00:00:00`, locale) : undefined}
          />
        </dl>
      ) : null}
    </DashboardCard>
  );
}

function SummaryItem({ label, value, hint, accent = false }: { label: string; value: React.ReactNode; hint?: string; accent?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase leading-tight tracking-wider text-text-muted">{label}</dt>
      <dd className={accent ? 'mt-0.5 truncate font-heading text-sm font-bold text-accent sm:text-base' : 'mt-0.5 truncate font-heading text-sm font-bold text-text sm:text-base'}>
        {value}
      </dd>
      {hint ? <dd className="text-[11px] text-text-muted tabular">{hint}</dd> : null}
    </div>
  );
}
