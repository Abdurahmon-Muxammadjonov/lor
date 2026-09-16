'use client';

import * as React from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TooltipProps } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { Syringe } from 'lucide-react';
import { pickLang, useLocale } from '@/i18n/client';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { AXIS_TICK, BAR_MAX, CHART } from '@/lib/reports/chart-theme';
import { formatCompactMoney, formatCount, formatPercent, formatQty } from '@/lib/reports/format';
import type { ServiceRowDTO, ServicesReportDTO } from '@/lib/reports/types';
import { Segmented } from '@/components/ui/segmented';
import { Money } from '@/components/shared/money';
import { ChartFrame } from './chart-frame';
import { ChartTooltipFrame } from './chart-tooltip';
import { ReportCard } from './report-card';
import { ReportTable, type ReportColumn } from './report-table';
import { ShareBar } from './share-bar';

export interface ServicesTabProps {
  data: ServicesReportDTO | undefined;
  loading: boolean;
  dimmed: boolean;
}

type Metric = 'count' | 'revenue';
const TOP_N = 10;

interface ChartRow extends ServiceRowDTO {
  label: string;
  value: number;
}

function isChartRow(v: unknown): v is ChartRow {
  return !!v && typeof v === 'object' && 'serviceId' in v && 'label' in v;
}

function truncate(s: string, n = 26): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/** Muolajalar boʻlimi: TOP jadval + gorizontal ustunlar (miqdor / tushum), bitta rang — nominal kategoriyalar */
export function ServicesTab({ data, loading, dimmed }: ServicesTabProps) {
  const { t, locale } = useLocale();
  const reduced = useReducedMotion();
  const [metric, setMetric] = React.useState<Metric>('revenue');
  const rows = React.useMemo(() => data?.rows ?? [], [data]);

  const sorted = React.useMemo(() => [...rows].sort((a, b) => (metric === 'count' ? b.count - a.count : b.revenue - a.revenue)), [rows, metric]);
  const chartRows = React.useMemo<ChartRow[]>(
    () =>
      sorted
        .filter((r) => (metric === 'count' ? r.count > 0 : r.revenue > 0))
        .slice(0, TOP_N)
        .map((r) => ({ ...r, label: truncate(pickLang(r, locale)), value: metric === 'count' ? r.count : r.revenue })),
    [sorted, metric, locale],
  );
  const countTotal = data?.totals.count ?? 0;

  const renderTooltip = React.useCallback(
    (props: TooltipProps<ValueType, NameType>) => {
      const row = props.payload?.[0]?.payload as unknown;
      if (!props.active || !isChartRow(row)) return null;
      return (
        <ChartTooltipFrame
          title={`${row.code} · ${pickLang(row, locale)}`}
          rows={[
            { key: 'count', value: `${formatQty(row.count)} ${row.unit}`, label: t('reports.services.count'), color: metric === 'count' ? CHART.accentDeep : undefined, kind: 'rect' },
            { key: 'revenue', value: <Money value={row.revenue} />, label: t('reports.services.revenue'), color: metric === 'revenue' ? CHART.accentDeep : undefined, kind: 'rect' },
            { key: 'share', value: formatPercent(row.share), label: t('reports.services.share') },
          ]}
        />
      );
    },
    [t, locale, metric],
  );

  const columns = React.useMemo<ReportColumn<ServiceRowDTO>[]>(
    () => [
      {
        key: 'service',
        header: t('reports.services.service'),
        cell: (r) => (
          <div className="min-w-0">
            <div className="truncate font-medium text-text">{pickLang(r, locale)}</div>
            <div className="truncate text-xs text-text-muted">
              <span className="font-mono">{r.code}</span>
              {r.category ? <> · {pickLang(r.category, locale)}</> : null}
            </div>
          </div>
        ),
      },
      {
        key: 'count',
        header: t('reports.services.count'),
        align: 'right',
        cell: (r) => (
          <span>
            {formatQty(r.count)} <span className="text-xs text-text-muted">{r.unit}</span>
          </span>
        ),
        total: formatQty(countTotal),
      },
      { key: 'lines', header: t('reports.services.lines'), align: 'right', hideOnMobile: true, cell: (r) => formatCount(r.lines), total: formatCount(data?.totals.lines ?? 0) },
      { key: 'revenue', header: t('reports.services.revenue'), align: 'right', cell: (r) => <Money value={r.revenue} />, total: <Money value={data?.totals.revenue ?? 0} /> },
      {
        key: 'share',
        header: t('reports.services.share'),
        hideOnMobile: true,
        width: 170,
        cell: (r) => <ShareBar percent={r.share} color={CHART.accentDeep} label={`${r.name}: ${formatPercent(r.share)}`} />,
        total: rows.length > 0 ? formatPercent(100) : null,
      },
      { key: 'adult', header: t('reports.services.adult'), align: 'right', hideOnMobile: true, cell: (r) => formatQty(r.adultCount), total: formatQty(data?.totals.adultCount ?? 0) },
      { key: 'child', header: t('reports.services.child'), align: 'right', hideOnMobile: true, cell: (r) => formatQty(r.childCount), total: formatQty(data?.totals.childCount ?? 0) },
      { key: 'med', header: t('reports.services.withMed'), align: 'right', hideOnMobile: true, cell: (r) => formatQty(r.medCount), total: formatQty(data?.totals.medCount ?? 0) },
    ],
    [t, locale, data, rows.length, countTotal],
  );

  const chartHeight = Math.max(200, chartRows.length * 36 + 40);
  const toggle = (
    <Segmented<Metric>
      value={metric}
      onChange={setMetric}
      size="sm"
      variant="accent"
      ariaLabel={t('reports.services.chartTitle')}
      options={[
        { value: 'count', label: t('reports.services.toggleCount') },
        { value: 'revenue', label: t('reports.services.toggleRevenue') },
      ]}
    />
  );

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <ReportCard
        title={t('reports.services.chartTitle')}
        description={t('reports.services.chartDescription', { n: TOP_N })}
        dimmed={dimmed}
        actions={toggle}
        className="lg:col-span-2"
      >
        <ChartFrame height={chartHeight} loading={loading} empty={chartRows.length === 0} emptyIcon={Syringe}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows} layout="vertical" margin={{ top: 4, right: 52, left: 0, bottom: 0 }} barCategoryGap="28%">
              <CartesianGrid horizontal={false} stroke={CHART.grid} strokeWidth={1} />
              <XAxis
                type="number"
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => (metric === 'count' ? formatQty(v) : formatCompactMoney(v, locale, 0))}
              />
              <YAxis type="category" dataKey="label" tick={AXIS_TICK} axisLine={{ stroke: CHART.grid }} tickLine={false} width={150} />
              <Tooltip content={renderTooltip} cursor={{ fill: CHART.cursor }} />
              <Bar dataKey="value" fill={CHART.accentDeep} radius={[0, 4, 4, 0]} maxBarSize={BAR_MAX} isAnimationActive={!reduced}>
                <LabelList
                  dataKey="value"
                  position="right"
                  fill={CHART.text}
                  fontSize={11}
                  formatter={(v: number) => (metric === 'count' ? formatQty(v) : formatCompactMoney(v, locale))}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>
      </ReportCard>
      <ReportCard title={t('reports.services.tableTitle')} description={t('reports.services.tableDescription')} dimmed={dimmed} className="lg:col-span-3" contentClassName="-mx-4 sm:mx-0">
        <ReportTable columns={columns} rows={sorted} rowKey={(r) => `${r.serviceId}|${r.name}`} loading={loading} totals emptyIcon={Syringe} caption={t('reports.services.tableTitle')} maxHeight="70vh" dense />
      </ReportCard>
    </div>
  );
}
