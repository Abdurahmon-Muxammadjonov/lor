'use client';

import * as React from 'react';
import { Landmark } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmtDateTime } from '@/lib/date';
import { useLocale } from '@/i18n/client';
import { METHOD_COLORS, METHOD_ORDER } from '@/lib/reports/chart-theme';
import { formatCount } from '@/lib/reports/format';
import type { ShiftRowDTO, ShiftsReportDTO } from '@/lib/reports/types';
import { Badge } from '@/components/ui/badge';
import { Money } from '@/components/shared/money';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { ReportCard } from './report-card';
import { ReportTable, type ReportColumn } from './report-table';

export interface ShiftsTabProps {
  data: ShiftsReportDTO | undefined;
  loading: boolean;
  dimmed: boolean;
}

/** Farq belgisi: kamomad — qizil, ortiqcha — sariq (ogohlantirish), mos — yashil */
export function DifferenceBadge({ value, labels }: { value: number | null; labels: { shortage: string; surplus: string; exact: string } }) {
  if (value === null) return <span className="text-text-muted">—</span>;
  if (value === 0) {
    return (
      <Badge variant="success" dot>
        {labels.exact}
      </Badge>
    );
  }
  const shortage = value < 0;
  return (
    <span className={cn('inline-flex flex-col items-end gap-0.5', shortage ? 'text-danger' : 'text-warning')}>
      <Money value={value} signed className="font-semibold" />
      <span className="text-[11px] font-medium">{shortage ? labels.shortage : labels.surplus}</span>
    </span>
  );
}

/** Kassa smenalari: kassir, ochilgan/yopilgan, usullar boʻyicha jamlar, kutilgan va haqiqiy naqd, rangli farq */
export function ShiftsTab({ data, loading, dimmed }: ShiftsTabProps) {
  const { t, locale } = useLocale();
  const rows = React.useMemo(() => data?.rows ?? [], [data]);
  const labels = React.useMemo(
    () => ({ shortage: t('reports.shifts.shortage'), surplus: t('reports.shifts.surplus'), exact: t('reports.shifts.exact') }),
    [t],
  );

  const columns = React.useMemo<ReportColumn<ShiftRowDTO>[]>(
    () => [
      {
        key: 'cashier',
        header: t('reports.shifts.cashier'),
        cell: (r) => (
          <div className="min-w-0">
            <div className="truncate font-medium text-text">{r.cashier.fullName}</div>
            <div className="mt-0.5">
              <StatusBadge kind="shift" status={r.status} dot className="px-1.5 py-0 text-[10px]" />
            </div>
          </div>
        ),
      },
      { key: 'opened', header: t('reports.shifts.opened'), cell: (r) => <span className="whitespace-nowrap tabular">{fmtDateTime(r.openedAt, locale)}</span> },
      {
        key: 'closed',
        header: t('reports.shifts.closed'),
        hideOnMobile: true,
        cell: (r) => (r.closedAt ? <span className="whitespace-nowrap tabular">{fmtDateTime(r.closedAt, locale)}</span> : <span className="text-text-muted">—</span>),
      },
      { key: 'opening', header: t('reports.shifts.openingCash'), align: 'right', hideOnMobile: true, cell: (r) => <Money value={r.openingCash} muted suffix={null} /> },
      ...METHOD_ORDER.map(
        (m): ReportColumn<ShiftRowDTO> => ({
          key: m,
          header: (
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2 rounded-[2px]" style={{ backgroundColor: METHOD_COLORS[m] }} />
              {t(`common.payMethod.${m}`)}
            </span>
          ),
          align: 'right',
          hideOnMobile: true,
          cell: (r) => <Money value={r.totals[m]} suffix={null} muted={r.totals[m] === 0} />,
          total: <Money value={data?.totals.totals[m] ?? 0} suffix={null} />,
        }),
      ),
      { key: 'total', header: t('reports.shifts.total'), align: 'right', cell: (r) => <Money value={r.total} className="font-semibold" />, total: <Money value={data?.totals.total ?? 0} /> },
      { key: 'expected', header: t('reports.shifts.expectedCash'), align: 'right', hideOnMobile: true, cell: (r) => <Money value={r.expectedCash} suffix={null} /> },
      {
        key: 'closing',
        header: t('reports.shifts.closingCash'),
        align: 'right',
        hideOnMobile: true,
        cell: (r) => (r.closingCash === null ? <span className="text-text-muted">—</span> : <Money value={r.closingCash} suffix={null} />),
      },
      {
        key: 'diff',
        header: t('reports.shifts.difference'),
        align: 'right',
        cell: (r) => <DifferenceBadge value={r.difference} labels={labels} />,
        total: <DifferenceBadge value={rows.some((r) => r.difference !== null) ? (data?.totals.difference ?? 0) : null} labels={labels} />,
      },
      { key: 'payments', header: t('reports.shifts.payments'), align: 'right', hideOnMobile: true, cell: (r) => formatCount(r.paymentsCount) },
    ],
    [t, locale, data, rows, labels],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard title={t('reports.shifts.count')} value={formatCount(data?.totals.count ?? 0)} hint={`${t('reports.shifts.openCount')}: ${formatCount(data?.totals.open ?? 0)}`} icon={Landmark} accent="cyan" loading={loading} />
        <StatCard title={t('reports.shifts.total')} value={<Money value={data?.totals.total ?? 0} />} icon={Landmark} accent="mint" loading={loading} />
        <StatCard
          title={t('reports.shifts.difference')}
          value={<Money value={data?.totals.difference ?? 0} signed />}
          hint={(data?.totals.difference ?? 0) < 0 ? labels.shortage : (data?.totals.difference ?? 0) > 0 ? labels.surplus : labels.exact}
          icon={Landmark}
          accent={(data?.totals.difference ?? 0) < 0 ? 'danger' : 'violet'}
          loading={loading}
        />
      </div>
      <ReportCard title={t('reports.shifts.tableTitle')} description={t('reports.shifts.tableDescription')} dimmed={dimmed} contentClassName="-mx-4 sm:mx-0">
        <ReportTable columns={columns} rows={rows} rowKey={(r) => r.id} loading={loading} totals emptyIcon={Landmark} caption={t('reports.shifts.tableTitle')} maxHeight="70vh" dense />
      </ReportCard>
    </div>
  );
}
