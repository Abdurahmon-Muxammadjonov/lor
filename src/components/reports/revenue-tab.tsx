'use client';

import * as React from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TooltipProps } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { CreditCard } from 'lucide-react';
import type { PayMethod } from '@prisma/client';
import { useLocale } from '@/i18n/client';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { AXIS_TICK, BAR_MAX, CHART, CHART_HEIGHT, METHOD_COLORS, METHOD_ORDER, SMALL_CHART_HEIGHT } from '@/lib/reports/chart-theme';
import { formatCompactMoney, formatCount, formatPercent } from '@/lib/reports/format';
import { formatPeriodLabel } from '@/lib/reports/period';
import type { MethodAmountDTO, RevenuePeriodDTO, RevenueReportDTO } from '@/lib/reports/types';
import { Money } from '@/components/shared/money';
import { EmptyState } from '@/components/shared/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartFrame } from './chart-frame';
import { ChartLegend, ChartTooltipFrame } from './chart-tooltip';
import { ReportCard } from './report-card';
import { ReportTable, type ReportColumn } from './report-table';

export interface RevenueTabProps {
  data: RevenueReportDTO | undefined;
  loading: boolean;
  dimmed: boolean;
}

interface Point extends RevenuePeriodDTO {
  label: string;
  longLabel: string;
}

function isPoint(v: unknown): v is Point {
  return !!v && typeof v === 'object' && 'period' in v && 'revenue' in v && 'longLabel' in v;
}

interface Slice {
  method: PayMethod;
  amount: number;
  share: number;
}

function isSlice(v: unknown): v is Slice {
  return !!v && typeof v === 'object' && 'method' in v && 'amount' in v;
}

const DONUT = 180;

/** Tushum boʻlimi: davr boʻyicha ustunlar (tushum) + sinxron chiziq (qabullar), davrlar jadvali, toʻlov usullari donuti */
export function RevenueTab({ data, loading, dimmed }: RevenueTabProps) {
  const { t, locale } = useLocale();
  const reduced = useReducedMotion();
  const [activeMethod, setActiveMethod] = React.useState<PayMethod | null>(null);

  const points = React.useMemo<Point[]>(
    () =>
      (data?.periods ?? []).map((p) => ({
        ...p,
        label: formatPeriodLabel(p, data?.groupBy ?? 'day', locale),
        longLabel: formatPeriodLabel(p, data?.groupBy ?? 'day', locale, { long: true }),
      })),
    [data, locale],
  );
  const hasData = points.some((p) => p.revenue !== 0 || p.visits > 0);
  const slices = React.useMemo<Slice[]>(
    () =>
      METHOD_ORDER.map((m) => data?.totals.byMethod.find((b) => b.method === m))
        .filter((b): b is MethodAmountDTO => !!b && b.amount > 0)
        .map((b) => ({ method: b.method, amount: b.amount, share: b.share })),
    [data],
  );

  const renderBarTooltip = React.useCallback(
    (props: TooltipProps<ValueType, NameType>) => {
      const row = props.payload?.[0]?.payload as unknown;
      if (!props.active || !isPoint(row)) return null;
      return (
        <ChartTooltipFrame
          title={row.longLabel}
          rows={[
            { key: 'revenue', value: <Money value={row.revenue} />, label: t('reports.revenue.legendRevenue'), color: CHART.accent, kind: 'rect' },
            { key: 'visits', value: formatCount(row.visits), label: t('reports.revenue.legendVisits'), color: CHART.violet, kind: 'line' },
            { key: 'avg', value: <Money value={row.avgCheck} />, label: t('reports.columns.avgCheck') },
          ]}
        />
      );
    },
    [t],
  );

  const renderPieTooltip = React.useCallback(
    (props: TooltipProps<ValueType, NameType>) => {
      const row = props.payload?.[0]?.payload as unknown;
      if (!props.active || !isSlice(row)) return null;
      return (
        <ChartTooltipFrame
          rows={[
            { key: 'amount', value: <Money value={row.amount} />, label: t(`common.payMethod.${row.method}`), color: METHOD_COLORS[row.method], kind: 'rect' },
            { key: 'share', value: formatPercent(row.share), label: t('reports.columns.share') },
          ]}
        />
      );
    },
    [t],
  );

  const columns = React.useMemo<ReportColumn<Point>[]>(
    () => [
      { key: 'period', header: t('reports.columns.period'), cell: (r) => <span className="whitespace-nowrap">{r.label}</span> },
      { key: 'revenue', header: t('reports.columns.revenue'), align: 'right', cell: (r) => <Money value={r.revenue} />, total: <Money value={data?.totals.revenue ?? 0} /> },
      { key: 'visits', header: t('reports.columns.visits'), align: 'right', cell: (r) => formatCount(r.visits), total: formatCount(data?.totals.visits ?? 0) },
      { key: 'avg', header: t('reports.columns.avgCheck'), align: 'right', cell: (r) => <Money value={r.avgCheck} />, total: <Money value={data?.totals.avgCheck ?? 0} /> },
      ...METHOD_ORDER.map(
        (m): ReportColumn<Point> => ({
          key: m,
          header: (
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2 rounded-[2px]" style={{ backgroundColor: METHOD_COLORS[m] }} />
              {t(`common.payMethod.${m}`)}
            </span>
          ),
          align: 'right',
          hideOnMobile: true,
          cell: (r) => <Money value={r.byMethod.find((b) => b.method === m)?.amount ?? 0} suffix={null} muted />,
          total: <Money value={data?.totals.byMethod.find((b) => b.method === m)?.amount ?? 0} suffix={null} />,
        }),
      ),
    ],
    [t, data],
  );

  const tickInterval = points.length > 14 ? 'preserveStartEnd' : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <ReportCard
        title={t('reports.revenue.chartTitle')}
        description={t('reports.revenue.chartDescription')}
        dimmed={dimmed}
        className="lg:col-span-2"
        actions={
          <ChartLegend
            items={[
              { key: 'revenue', label: t('reports.revenue.legendRevenue'), color: CHART.accent },
              { key: 'visits', label: t('reports.revenue.legendVisits'), color: CHART.violet, kind: 'line' },
            ]}
          />
        }
      >
        <ChartFrame height={CHART_HEIGHT} loading={loading} empty={!hasData}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={points} syncId="reports-revenue" margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
              <defs>
                <linearGradient id="reports-revenue-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART.accent} stopOpacity={0.95} />
                  <stop offset="100%" stopColor={CHART.accentDeep} stopOpacity={0.75} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={CHART.grid} strokeWidth={1} />
              <XAxis dataKey="label" tick={AXIS_TICK} axisLine={{ stroke: CHART.grid }} tickLine={false} interval={tickInterval} minTickGap={20} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={60} tickFormatter={(v: number) => formatCompactMoney(v, locale)} />
              <Tooltip content={renderBarTooltip} cursor={{ fill: CHART.cursor }} />
              <Bar dataKey="revenue" fill="url(#reports-revenue-fill)" radius={[4, 4, 0, 0]} maxBarSize={BAR_MAX} isAnimationActive={!reduced} />
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>
        {loading || !hasData ? null : (
          <div className="mt-3 border-t border-line pt-3">
            <div className="mb-1 text-xs font-medium text-text-muted">{t('reports.revenue.visitsChart')}</div>
            <ChartFrame height={SMALL_CHART_HEIGHT}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={points} syncId="reports-revenue" margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={CHART.grid} strokeWidth={1} />
                  <XAxis dataKey="label" tick={AXIS_TICK} axisLine={{ stroke: CHART.grid }} tickLine={false} interval={tickInterval} minTickGap={20} />
                  <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={60} allowDecimals={false} tickFormatter={(v: number) => formatCount(v)} />
                  <Tooltip content={renderBarTooltip} cursor={{ stroke: CHART.cursor, strokeWidth: 1 }} />
                  <Line
                    type="monotone"
                    dataKey="visits"
                    stroke={CHART.violet}
                    strokeWidth={2}
                    dot={points.length <= 31 ? { r: 3, fill: CHART.violet, stroke: CHART.surface, strokeWidth: 2 } : false}
                    activeDot={{ r: 5, fill: CHART.violet, stroke: CHART.surface, strokeWidth: 2 }}
                    isAnimationActive={!reduced}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartFrame>
          </div>
        )}
      </ReportCard>

      <ReportCard title={t('reports.revenue.methodsTitle')} description={t('reports.revenue.methodsDescription')} dimmed={dimmed}>
        {loading ? (
          <div className="space-y-4">
            <div className="flex justify-center">
              <Skeleton className="rounded-full" style={{ width: DONUT, height: DONUT }} />
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        ) : slices.length === 0 ? (
          <EmptyState compact icon={CreditCard} title={t('reports.empty.title')} description={t('reports.empty.description')} />
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="relative" style={{ width: DONUT, height: DONUT }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="amount"
                    nameKey="method"
                    innerRadius={DONUT * 0.34}
                    outerRadius={DONUT * 0.48}
                    paddingAngle={2}
                    stroke={CHART.surface}
                    strokeWidth={2}
                    isAnimationActive={!reduced}
                    onMouseEnter={(_, i) => setActiveMethod(slices[i]?.method ?? null)}
                    onMouseLeave={() => setActiveMethod(null)}
                  >
                    {slices.map((s) => (
                      <Cell key={s.method} fill={METHOD_COLORS[s.method]} opacity={activeMethod && activeMethod !== s.method ? 0.45 : 1} />
                    ))}
                  </Pie>
                  <Tooltip content={renderPieTooltip} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{t('common.total')}</span>
                <span className="font-heading text-sm font-bold text-text">{formatCompactMoney(data?.totals.revenue ?? 0, locale, 2)}</span>
              </div>
            </div>
            <ul className="w-full divide-y divide-line text-sm" aria-label={t('reports.revenue.methodsTitle')}>
              {slices.map((s) => (
                <li
                  key={s.method}
                  className="flex items-center gap-2 py-2"
                  onMouseEnter={() => setActiveMethod(s.method)}
                  onMouseLeave={() => setActiveMethod(null)}
                >
                  <span aria-hidden="true" className="size-2.5 shrink-0 rounded-[2px]" style={{ backgroundColor: METHOD_COLORS[s.method] }} />
                  <span className="min-w-0 flex-1 truncate text-text">{t(`common.payMethod.${s.method}`)}</span>
                  <span className="text-xs text-text-muted tabular">{formatPercent(s.share)}</span>
                  <Money value={s.amount} className="w-32 text-right text-text" />
                </li>
              ))}
            </ul>
          </div>
        )}
      </ReportCard>

      <ReportCard title={t('reports.revenue.tableTitle')} description={t('reports.revenue.tableDescription')} dimmed={dimmed} className="lg:col-span-3" contentClassName="-mx-4 sm:mx-0">
        <ReportTable columns={columns} rows={points} rowKey={(r) => r.period} loading={loading} totals caption={t('reports.revenue.tableTitle')} maxHeight="60vh" dense />
      </ReportCard>
    </div>
  );
}
