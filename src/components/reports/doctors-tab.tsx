'use client';

import * as React from 'react';
import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TooltipProps } from 'recharts';
import type { NameType, ValueType } from 'recharts/types/component/DefaultTooltipContent';
import { Stethoscope } from 'lucide-react';
import { useLocale } from '@/i18n/client';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { AXIS_TICK, BAR_MAX, CHART } from '@/lib/reports/chart-theme';
import { formatCompactMoney, formatCount, formatPercent } from '@/lib/reports/format';
import type { DoctorRowDTO, DoctorsReportDTO } from '@/lib/reports/types';
import { Badge } from '@/components/ui/badge';
import { Money } from '@/components/shared/money';
import { ChartFrame } from './chart-frame';
import { ChartTooltipFrame } from './chart-tooltip';
import { ReportCard } from './report-card';
import { ReportTable, type ReportColumn } from './report-table';
import { ShareBar } from './share-bar';

export interface DoctorsTabProps {
  data: DoctorsReportDTO | undefined;
  loading: boolean;
  dimmed: boolean;
}

function isDoctorRow(v: unknown): v is DoctorRowDTO {
  return !!v && typeof v === 'object' && 'doctorId' in v && 'revenue' in v;
}

function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return fullName;
  const [last, first] = parts;
  return `${last} ${first?.charAt(0) ?? ''}.`;
}

/** Shifokorlar boʻlimi: jadval (ulush chiziqlari, maosh) + gorizontal tushum ustunlari (bitta rang — nominal kategoriyalar) */
export function DoctorsTab({ data, loading, dimmed }: DoctorsTabProps) {
  const { t, locale } = useLocale();
  const reduced = useReducedMotion();
  const rows = React.useMemo(() => data?.rows ?? [], [data]);
  const chartRows = React.useMemo(() => rows.filter((r) => r.revenue > 0).slice(0, 12).map((r) => ({ ...r, name: shortName(r.fullName) })), [rows]);
  const hasData = rows.some((r) => r.visits > 0 || r.revenue !== 0);

  const renderTooltip = React.useCallback(
    (props: TooltipProps<ValueType, NameType>) => {
      const row = props.payload?.[0]?.payload as unknown;
      if (!props.active || !isDoctorRow(row)) return null;
      return (
        <ChartTooltipFrame
          title={row.fullName}
          rows={[
            { key: 'revenue', value: <Money value={row.revenue} />, label: t('reports.doctors.revenue'), color: CHART.accentDeep, kind: 'rect' },
            { key: 'visits', value: formatCount(row.visits), label: t('reports.doctors.visits') },
            { key: 'share', value: formatPercent(row.share), label: t('reports.doctors.share') },
          ]}
        />
      );
    },
    [t],
  );

  const columns = React.useMemo<ReportColumn<DoctorRowDTO>[]>(
    () => [
      {
        key: 'doctor',
        header: t('reports.doctors.doctor'),
        cell: (r) => (
          <div className="flex min-w-0 items-center gap-2.5">
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: r.color }} />
            <div className="min-w-0">
              <Link
                href={`/dashboard/doctors/${r.doctorId}`}
                className="block truncate font-medium text-text underline-offset-4 hover:text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
              >
                {r.fullName}
              </Link>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-text-muted">
                {r.specialty ? <span className="truncate">{r.specialty}</span> : null}
                {!r.isActive ? (
                  <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
                    {t('common.inactive')}
                  </Badge>
                ) : null}
              </div>
            </div>
          </div>
        ),
      },
      { key: 'patients', header: t('reports.doctors.patients'), align: 'right', cell: (r) => formatCount(r.patients), total: formatCount(data?.totals.patients ?? 0) },
      { key: 'visits', header: t('reports.doctors.visits'), align: 'right', cell: (r) => formatCount(r.visits), total: formatCount(data?.totals.visits ?? 0) },
      { key: 'revenue', header: t('reports.doctors.revenue'), align: 'right', cell: (r) => <Money value={r.revenue} />, total: <Money value={data?.totals.revenue ?? 0} /> },
      {
        key: 'services',
        header: t('reports.doctors.servicesTotal'),
        align: 'right',
        hideOnMobile: true,
        cell: (r) => <Money value={r.servicesTotal} muted suffix={null} />,
        total: <Money value={data?.totals.servicesTotal ?? 0} suffix={null} />,
      },
      { key: 'avg', header: t('reports.doctors.avgCheck'), align: 'right', hideOnMobile: true, cell: (r) => <Money value={r.avgCheck} />, total: <Money value={data?.totals.avgCheck ?? 0} /> },
      {
        key: 'share',
        header: t('reports.doctors.share'),
        hideOnMobile: true,
        width: 190,
        cell: (r) => <ShareBar percent={r.share} color={CHART.accentDeep} label={`${r.fullName}: ${formatPercent(r.share)}`} />,
        total: rows.length > 0 ? formatPercent(100) : null,
      },
      {
        key: 'salary',
        header: (
          <span title={t('reports.doctors.salaryHint')} className="cursor-help underline decoration-dotted underline-offset-4">
            {t('reports.doctors.salary')}
          </span>
        ),
        align: 'right',
        cell: (r) => (
          <div>
            <Money value={r.salary} />
            <div className="text-[11px] text-text-muted">
              {r.salaryType === 'PERCENT' ? t('reports.doctors.salaryPercent', { v: r.salaryValue }) : t('reports.doctors.salaryFixed')}
            </div>
          </div>
        ),
        total: <Money value={data?.totals.salary ?? 0} />,
      },
    ],
    [t, data, rows.length],
  );

  const chartHeight = Math.max(160, Math.min(420, chartRows.length * 40 + 40));

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <ReportCard title={t('reports.doctors.tableTitle')} description={t('reports.doctors.tableDescription')} dimmed={dimmed} className="lg:col-span-2" contentClassName="-mx-4 sm:mx-0">
        <ReportTable columns={columns} rows={rows} rowKey={(r) => r.doctorId} loading={loading} totals emptyIcon={Stethoscope} caption={t('reports.doctors.tableTitle')} />
      </ReportCard>
      <ReportCard title={t('reports.doctors.chartTitle')} description={t('reports.doctors.chartDescription')} dimmed={dimmed}>
        <ChartFrame height={chartHeight} loading={loading} empty={!hasData || chartRows.length === 0} emptyIcon={Stethoscope}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartRows} layout="vertical" margin={{ top: 4, right: 56, left: 0, bottom: 0 }} barCategoryGap="28%">
              <CartesianGrid horizontal={false} stroke={CHART.grid} strokeWidth={1} />
              <XAxis type="number" tick={AXIS_TICK} axisLine={false} tickLine={false} tickFormatter={(v: number) => formatCompactMoney(v, locale, 0)} />
              <YAxis type="category" dataKey="name" tick={AXIS_TICK} axisLine={{ stroke: CHART.grid }} tickLine={false} width={96} />
              <Tooltip content={renderTooltip} cursor={{ fill: CHART.cursor }} />
              <Bar dataKey="revenue" fill={CHART.accentDeep} radius={[0, 4, 4, 0]} maxBarSize={BAR_MAX} isAnimationActive={!reduced}>
                <LabelList dataKey="revenue" position="right" fill={CHART.text} fontSize={11} formatter={(v: number) => formatCompactMoney(v, locale)} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>
      </ReportCard>
    </div>
  );
}
