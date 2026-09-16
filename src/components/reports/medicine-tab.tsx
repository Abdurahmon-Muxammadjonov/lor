'use client';

import * as React from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TooltipProps } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { Pill } from 'lucide-react';
import { pickLang, useLocale } from '@/i18n/client';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { AXIS_TICK, BAR_MAX, CHART, MED_COLORS } from '@/lib/reports/chart-theme';
import { formatPercent, formatQty } from '@/lib/reports/format';
import type { MedicineReportDTO, MedicineRowDTO } from '@/lib/reports/types';
import { Badge } from '@/components/ui/badge';
import { Money } from '@/components/shared/money';
import { StatCard } from '@/components/shared/stat-card';
import { ChartFrame } from './chart-frame';
import { ChartLegend, ChartTooltipFrame } from './chart-tooltip';
import { ReportCard } from './report-card';
import { ReportTable, type ReportColumn } from './report-table';
import { ShareBar } from './share-bar';

export interface MedicineTabProps {
  data: MedicineReportDTO | undefined;
  loading: boolean;
  dimmed: boolean;
}

const TOP_N = 10;

interface ChartRow extends MedicineRowDTO {
  label: string;
  medCount: number;
  noMedCount: number;
}

function isChartRow(v: unknown): v is ChartRow {
  return !!v && typeof v === 'object' && 'serviceId' in v && 'label' in v;
}

function truncate(s: string, n = 26): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/** Dori bilan / dorisiz: yigʻma gorizontal ustunlar (2 seriya) + jadval — dori sarfini rejalashtirish uchun */
export function MedicineTab({ data, loading, dimmed }: MedicineTabProps) {
  const { t, locale } = useLocale();
  const reduced = useReducedMotion();
  const rows = React.useMemo(() => data?.rows ?? [], [data]);
  const chartRows = React.useMemo<ChartRow[]>(
    () =>
      rows
        .filter((r) => r.total.count > 0)
        .slice(0, TOP_N)
        .map((r) => ({ ...r, label: truncate(pickLang(r, locale)), medCount: r.med.count, noMedCount: r.noMed.count })),
    [rows, locale],
  );

  const renderTooltip = React.useCallback(
    (props: TooltipProps<ValueType, NameType>) => {
      const row = props.payload?.[0]?.payload as unknown;
      if (!props.active || !isChartRow(row)) return null;
      return (
        <ChartTooltipFrame
          title={`${row.code} · ${pickLang(row, locale)}`}
          rows={[
            { key: 'med', value: `${formatQty(row.med.count)} ${row.unit}`, label: t('reports.medicine.withMed'), color: MED_COLORS.MED, kind: 'rect' },
            { key: 'nomed', value: `${formatQty(row.noMed.count)} ${row.unit}`, label: t('reports.medicine.withoutMed'), color: MED_COLORS.NOMED, kind: 'rect' },
            { key: 'share', value: formatPercent(row.medShare), label: t('reports.medicine.medShare') },
          ]}
        />
      );
    },
    [t, locale],
  );

  const columns = React.useMemo<ReportColumn<MedicineRowDTO>[]>(
    () => [
      {
        key: 'service',
        header: t('reports.medicine.service'),
        cell: (r) => (
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate font-medium text-text">{pickLang(r, locale)}</span>
              {!r.medicineOptional ? (
                <Badge variant="accent" className="px-1.5 py-0 text-[10px]">
                  {t('reports.medicine.alwaysMed')}
                </Badge>
              ) : null}
            </div>
            <div className="font-mono text-xs text-text-muted">{r.code}</div>
          </div>
        ),
      },
      {
        key: 'medQty',
        header: (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2 rounded-[2px]" style={{ backgroundColor: MED_COLORS.MED }} />
            {t('reports.medicine.withMed')}
          </span>
        ),
        align: 'right',
        cell: (r) => (
          <span>
            {formatQty(r.med.count)} <span className="text-xs text-text-muted">{r.unit}</span>
          </span>
        ),
        total: formatQty(data?.totals.med.count ?? 0),
      },
      { key: 'medRev', header: `${t('reports.medicine.withMed')}: ${t('reports.medicine.revenue')}`, align: 'right', hideOnMobile: true, cell: (r) => <Money value={r.med.revenue} muted />, total: <Money value={data?.totals.med.revenue ?? 0} /> },
      {
        key: 'noMedQty',
        header: (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2 rounded-[2px]" style={{ backgroundColor: MED_COLORS.NOMED }} />
            {t('reports.medicine.withoutMed')}
          </span>
        ),
        align: 'right',
        cell: (r) => (
          <span>
            {formatQty(r.noMed.count)} <span className="text-xs text-text-muted">{r.unit}</span>
          </span>
        ),
        total: formatQty(data?.totals.noMed.count ?? 0),
      },
      { key: 'noMedRev', header: `${t('reports.medicine.withoutMed')}: ${t('reports.medicine.revenue')}`, align: 'right', hideOnMobile: true, cell: (r) => <Money value={r.noMed.revenue} muted />, total: <Money value={data?.totals.noMed.revenue ?? 0} /> },
      { key: 'total', header: `${t('common.total')}: ${t('reports.medicine.qty')}`, align: 'right', hideOnMobile: true, cell: (r) => formatQty(r.total.count), total: formatQty(data?.totals.total.count ?? 0) },
      {
        key: 'share',
        header: t('reports.medicine.medShare'),
        width: 170,
        cell: (r) => <ShareBar percent={r.medShare} color={MED_COLORS.MED} label={`${r.name}: ${formatPercent(r.medShare)}`} />,
        total: formatPercent(data?.totals.medShare ?? 0),
      },
    ],
    [t, locale, data],
  );

  const legend = [
    { key: 'med', label: t('reports.medicine.withMed'), color: MED_COLORS.MED },
    { key: 'nomed', label: t('reports.medicine.withoutMed'), color: MED_COLORS.NOMED },
  ];
  const chartHeight = Math.max(200, chartRows.length * 36 + 40);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard title={t('reports.medicine.totalMed')} value={formatQty(data?.totals.med.count ?? 0)} hint={<Money value={data?.totals.med.revenue ?? 0} />} icon={Pill} accent="mint" loading={loading} />
        <StatCard title={t('reports.medicine.totalNoMed')} value={formatQty(data?.totals.noMed.count ?? 0)} hint={<Money value={data?.totals.noMed.revenue ?? 0} />} icon={Pill} accent="violet" loading={loading} />
        <StatCard title={t('reports.medicine.medShare')} value={formatPercent(data?.totals.medShare ?? 0)} icon={Pill} accent="cyan" loading={loading} />
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <ReportCard title={t('reports.medicine.chartTitle')} description={t('reports.medicine.chartDescription', { n: TOP_N })} dimmed={dimmed} actions={<ChartLegend items={legend} />} className="lg:col-span-2">
          <ChartFrame height={chartHeight} loading={loading} empty={chartRows.length === 0} emptyIcon={Pill}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartRows} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }} barCategoryGap="28%">
                <CartesianGrid horizontal={false} stroke={CHART.grid} strokeWidth={1} />
                <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatQty(v)} />
                <YAxis type="category" dataKey="label" tick={AXIS_TICK} axisLine={{ stroke: CHART.grid }} tickLine={false} width={150} />
                <Tooltip content={renderTooltip} cursor={{ fill: CHART.cursor }} />
                <Bar dataKey="medCount" stackId="med" fill={MED_COLORS.MED} stroke={CHART.surface} strokeWidth={2} maxBarSize={BAR_MAX} isAnimationActive={!reduced} />
                <Bar dataKey="noMedCount" stackId="med" fill={MED_COLORS.NOMED} stroke={CHART.surface} strokeWidth={2} radius={[0, 4, 4, 0]} maxBarSize={BAR_MAX} isAnimationActive={!reduced} />
              </BarChart>
            </ResponsiveContainer>
          </ChartFrame>
        </ReportCard>
        <ReportCard title={t('reports.medicine.tableTitle')} description={t('reports.medicine.tableDescription')} dimmed={dimmed} className="lg:col-span-3" contentClassName="-mx-4 sm:mx-0">
          <ReportTable columns={columns} rows={rows} rowKey={(r) => `${r.serviceId}|${r.name}`} loading={loading} totals emptyIcon={Pill} caption={t('reports.medicine.tableTitle')} maxHeight="70vh" dense />
        </ReportCard>
      </div>
    </div>
  );
}
