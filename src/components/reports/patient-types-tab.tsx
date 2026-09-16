'use client';

import * as React from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TooltipProps } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { Baby, Users } from 'lucide-react';
import { useLocale } from '@/i18n/client';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { AXIS_TICK, BAR_MAX, CHART, CHART_HEIGHT, TYPE_COLORS } from '@/lib/reports/chart-theme';
import { formatCompactMoney, formatCount, formatPercent } from '@/lib/reports/format';
import { formatPeriodLabel } from '@/lib/reports/period';
import type { PatientTypesReportDTO, PatientTypesTrendDTO } from '@/lib/reports/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Money } from '@/components/shared/money';
import { EmptyState } from '@/components/shared/empty-state';
import { ChartFrame } from './chart-frame';
import { ChartLegend, ChartTooltipFrame } from './chart-tooltip';
import { ReportCard } from './report-card';
import { ReportTable, type ReportColumn } from './report-table';

export interface PatientTypesTabProps {
  data: PatientTypesReportDTO | undefined;
  loading: boolean;
  dimmed: boolean;
}

interface TrendPoint extends PatientTypesTrendDTO {
  label: string;
  longLabel: string;
  adultRevenue: number;
  childRevenue: number;
}

function isTrendPoint(v: unknown): v is TrendPoint {
  return !!v && typeof v === 'object' && 'adult' in v && 'child' in v && 'longLabel' in v;
}

/**
 * Kattalar va bolalar: ulush oʻlchagichi (100% yigʻma chiziq — ikki qismli donut oʻrniga, koʻrsatkich karta bilan),
 * davr boʻyicha yigʻma ustunlar (2 seriya, legenda) va jadval.
 */
export function PatientTypesTab({ data, loading, dimmed }: PatientTypesTabProps) {
  const { t, locale } = useLocale();
  const reduced = useReducedMotion();
  const points = React.useMemo<TrendPoint[]>(
    () =>
      (data?.trend ?? []).map((p) => ({
        ...p,
        label: formatPeriodLabel(p, data?.groupBy ?? 'month', locale),
        longLabel: formatPeriodLabel(p, data?.groupBy ?? 'month', locale, { long: true }),
        adultRevenue: p.adult.revenue,
        childRevenue: p.child.revenue,
      })),
    [data, locale],
  );
  const hasData = (data?.total.lines ?? 0) > 0;

  const renderTooltip = React.useCallback(
    (props: TooltipProps<ValueType, NameType>) => {
      const row = props.payload?.[0]?.payload as unknown;
      if (!props.active || !isTrendPoint(row)) return null;
      return (
        <ChartTooltipFrame
          title={row.longLabel}
          rows={[
            { key: 'adult', value: <Money value={row.adult.revenue} />, label: `${t('reports.patientTypes.adult')} · ${formatCount(row.adult.visits)} ${t('reports.patientTypes.visits').toLowerCase()}`, color: TYPE_COLORS.ADULT, kind: 'rect' },
            { key: 'child', value: <Money value={row.child.revenue} />, label: `${t('reports.patientTypes.child')} · ${formatCount(row.child.visits)} ${t('reports.patientTypes.visits').toLowerCase()}`, color: TYPE_COLORS.CHILD, kind: 'rect' },
          ]}
        />
      );
    },
    [t],
  );

  const columns = React.useMemo<ReportColumn<TrendPoint>[]>(
    () => [
      { key: 'period', header: t('reports.columns.period'), cell: (r) => <span className="whitespace-nowrap">{r.label}</span> },
      { key: 'av', header: t('reports.patientTypes.adultVisits'), align: 'right', cell: (r) => formatCount(r.adult.visits), total: formatCount(data?.adult.visits ?? 0) },
      { key: 'al', header: `${t('reports.patientTypes.adult')}: ${t('reports.patientTypes.lines')}`, align: 'right', hideOnMobile: true, cell: (r) => formatCount(r.adult.lines), total: formatCount(data?.adult.lines ?? 0) },
      { key: 'ar', header: t('reports.patientTypes.adultRevenue'), align: 'right', cell: (r) => <Money value={r.adult.revenue} />, total: <Money value={data?.adult.revenue ?? 0} /> },
      { key: 'cv', header: t('reports.patientTypes.childVisits'), align: 'right', cell: (r) => formatCount(r.child.visits), total: formatCount(data?.child.visits ?? 0) },
      { key: 'cl', header: `${t('reports.patientTypes.child')}: ${t('reports.patientTypes.lines')}`, align: 'right', hideOnMobile: true, cell: (r) => formatCount(r.child.lines), total: formatCount(data?.child.lines ?? 0) },
      { key: 'cr', header: t('reports.patientTypes.childRevenue'), align: 'right', cell: (r) => <Money value={r.child.revenue} />, total: <Money value={data?.child.revenue ?? 0} /> },
    ],
    [t, data],
  );

  const legend = [
    { key: 'adult', label: t('reports.patientTypes.adult'), color: TYPE_COLORS.ADULT },
    { key: 'child', label: t('reports.patientTypes.child'), color: TYPE_COLORS.CHILD },
  ];
  const adultShare = data?.adult.share ?? 0;
  const childShare = data?.child.share ?? 0;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <ReportCard title={t('reports.patientTypes.shareTitle')} description={t('reports.patientTypes.shareDescription')} dimmed={dimmed}>
        {loading ? (
          <div className="space-y-4">
            <Skeleton className="h-4 w-full rounded-full" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          </div>
        ) : !hasData ? (
          <EmptyState compact icon={Users} title={t('reports.empty.title')} description={t('reports.empty.description')} />
        ) : (
          <div className="space-y-4">
            <div
              role="img"
              aria-label={`${t('reports.patientTypes.adult')} ${formatPercent(adultShare)}, ${t('reports.patientTypes.child')} ${formatPercent(childShare)}`}
              className="flex h-4 w-full overflow-hidden rounded-full bg-secondary"
            >
              <div className="h-full transition-[width] duration-500" style={{ width: `${adultShare}%`, backgroundColor: TYPE_COLORS.ADULT }} />
              <div className="h-full border-l-2 border-surface transition-[width] duration-500" style={{ width: `${childShare}%`, backgroundColor: TYPE_COLORS.CHILD }} />
            </div>
            <ChartLegend items={legend} />
            <div className="grid grid-cols-2 gap-3">
              {(
                [
                  { key: 'ADULT', stat: data?.adult, icon: Users, label: t('reports.patientTypes.adult') },
                  { key: 'CHILD', stat: data?.child, icon: Baby, label: t('reports.patientTypes.child') },
                ] as const
              ).map(({ key, stat, icon: Icon, label }) => (
                <div key={key} className="rounded-lg border border-line bg-card/60 p-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
                    <Icon className="size-3.5" aria-hidden="true" />
                    <span className="truncate">{label}</span>
                  </div>
                  <div className="mt-1.5 font-heading text-xl font-bold text-text">{formatPercent(stat?.share ?? 0)}</div>
                  <div className="mt-1 text-xs text-text-muted">
                    <Money value={stat?.revenue ?? 0} />
                  </div>
                  <div className="text-xs text-text-muted">
                    {formatCount(stat?.visits ?? 0)} {t('reports.patientTypes.visits').toLowerCase()} · {formatCount(stat?.lines ?? 0)} {t('reports.patientTypes.lines').toLowerCase()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </ReportCard>

      <ReportCard title={t('reports.patientTypes.trendTitle')} description={t('reports.patientTypes.trendDescription')} dimmed={dimmed} className="lg:col-span-2" actions={<ChartLegend items={legend} />}>
        <ChartFrame height={CHART_HEIGHT} loading={loading} empty={!hasData} emptyIcon={Users}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
              <CartesianGrid vertical={false} stroke={CHART.grid} strokeWidth={1} />
              <XAxis dataKey="label" tick={AXIS_TICK} axisLine={{ stroke: CHART.grid }} tickLine={false} interval={points.length > 14 ? 'preserveStartEnd' : 0} minTickGap={20} />
              <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={60} tickFormatter={(v: number) => formatCompactMoney(v, locale)} />
              <Tooltip content={renderTooltip} cursor={{ fill: CHART.cursor }} />
              <Bar dataKey="adultRevenue" stackId="type" fill={TYPE_COLORS.ADULT} stroke={CHART.surface} strokeWidth={2} maxBarSize={BAR_MAX} isAnimationActive={!reduced} />
              <Bar dataKey="childRevenue" stackId="type" fill={TYPE_COLORS.CHILD} stroke={CHART.surface} strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={BAR_MAX} isAnimationActive={!reduced} />
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>
      </ReportCard>

      <ReportCard title={t('reports.patientTypes.tableTitle')} dimmed={dimmed} className="lg:col-span-3" contentClassName="-mx-4 sm:mx-0">
        <ReportTable columns={columns} rows={points} rowKey={(r) => r.period} loading={loading} totals emptyIcon={Users} caption={t('reports.patientTypes.tableTitle')} maxHeight="60vh" dense />
      </ReportCard>
    </div>
  );
}
