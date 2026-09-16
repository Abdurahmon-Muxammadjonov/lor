'use client';

import * as React from 'react';
import { History, ReceiptText, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale } from '@/i18n/client';
import { fmtDateTime, fmtSmartDate, fmtTime } from '@/lib/date';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { Money } from '@/components/shared/money';
import { Pagination } from '@/components/shared/pagination';
import { StatusBadge } from '@/components/shared/status-badge';
import { EmptyState } from '@/components/shared/empty-state';
import type { ShiftDTO, ShiftListResponse } from '@/lib/cashier/types';
import { MethodBadge } from './method-badge';
import { MethodChips, ShiftDifference } from './shift-totals';
import { cashierErrorMessage, useShiftDetail } from './use-cashier';

export interface ShiftsHistoryProps {
  data: ShiftListResponse | undefined;
  loading: boolean;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

/** Smenalar tarixi: jadval (kassir, ochilgan/yopilgan, usullar, jami, farq) + tafsilot oynasi (toʻlovlar) */
export function ShiftsHistory({ data, loading, page, pageSize, onPageChange }: ShiftsHistoryProps) {
  const { t, locale } = useLocale();
  const [selected, setSelected] = React.useState<ShiftDTO | null>(null);
  const items = data?.items ?? [];

  const columns = React.useMemo<DataTableColumn<ShiftDTO>[]>(
    () => [
      {
        key: 'opened',
        header: t('cashier.shift.openedAt'),
        cell: (s) => (
          <div className="flex flex-col gap-1">
            <span className="tabular text-text">{fmtSmartDate(s.openedAt, locale)}</span>
            <StatusBadge kind="shift" status={s.closedAt ? 'CLOSED' : 'OPEN'} className="w-fit" />
          </div>
        ),
      },
      {
        key: 'closed',
        header: t('cashier.shift.closedAt'),
        hideOnMobile: true,
        cell: (s) => (
          <span className="tabular text-text-muted">
            {s.closedAt ? fmtSmartDate(s.closedAt, locale) : '—'}
          </span>
        ),
      },
      {
        key: 'cashier',
        header: t('cashier.shift.cashier'),
        hideOnMobile: true,
        cell: (s) => <span className="text-text">{s.cashier.fullName}</span>,
      },
      {
        key: 'total',
        header: t('cashier.shift.total'),
        align: 'right',
        cell: (s) => (
          <div className="flex flex-col items-end">
            <Money value={s.totals.total} className="font-heading text-base font-bold text-text" />
            <span className="tabular text-xs text-text-muted">
              {t('cashier.payments.count', { n: s.totals.paymentsCount })}
            </span>
          </div>
        ),
      },
      {
        key: 'cash',
        header: t('common.payMethod.CASH'),
        align: 'right',
        hideOnMobile: true,
        cell: (s) => <Money value={s.totals.byMethod.CASH} suffix={null} className="text-text" />,
      },
      {
        key: 'difference',
        header: t('cashier.shift.difference'),
        align: 'right',
        cell: (s) =>
          s.difference === null ? (
            <span className="text-text-muted">—</span>
          ) : (
            <ShiftDifference value={s.difference} />
          ),
      },
    ],
    [t, locale],
  );

  return (
    <div className="space-y-3">
      <DataTable
        columns={columns}
        data={items}
        rowKey={(s) => s.id}
        loading={loading && !data}
        emptyIcon={History}
        emptyText={t('cashier.shift.historyEmpty')}
        onRowClick={(s) => setSelected(s)}
        caption={t('cashier.shift.history')}
        footer={
          data && data.total > pageSize ? (
            <Pagination page={page} pageSize={pageSize} total={data.total} onChange={onPageChange} simple />
          ) : undefined
        }
      />
      <ShiftDetailDialog shift={selected} open={!!selected} onOpenChange={(o) => !o && setSelected(null)} />
    </div>
  );
}

interface ShiftDetailDialogProps {
  shift: ShiftDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ShiftDetailDialog({ shift, open, onOpenChange }: ShiftDetailDialogProps) {
  const { t, locale } = useLocale();
  const detail = useShiftDetail(open && shift ? shift.id : null);
  const s = detail.data ?? shift;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-5 text-accent" aria-hidden="true" />
            {t('cashier.shift.detail')}
          </DialogTitle>
          <DialogDescription>
            {s
              ? `${s.cashier.fullName} · ${fmtDateTime(s.openedAt, locale)}${s.closedAt ? ` — ${fmtDateTime(s.closedAt, locale)}` : ''}`
              : ''}
          </DialogDescription>
        </DialogHeader>

        {s ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <dl className="bg-bg-elevated/70 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-xl border border-line px-4 py-3 text-sm">
                <dt className="text-text-muted">{t('common.status')}</dt>
                <dd className="text-right">
                  <StatusBadge kind="shift" status={s.closedAt ? 'CLOSED' : 'OPEN'} />
                </dd>
                <dt className="text-text-muted">{t('cashier.shift.openingCash')}</dt>
                <dd className="text-right">
                  <Money value={s.openingCash} />
                </dd>
                <dt className="text-text-muted">{t('cashier.shift.expectedCash')}</dt>
                <dd className="text-right">
                  <Money value={s.totals.expectedCash} />
                </dd>
                <dt className="text-text-muted">{t('cashier.shift.closingCash')}</dt>
                <dd className="text-right">
                  <Money value={s.closingCash} />
                </dd>
                <dt className="text-text-muted">{t('cashier.shift.difference')}</dt>
                <dd className="text-right">
                  {s.difference === null ? '—' : <ShiftDifference value={s.difference} />}
                </dd>
              </dl>
              <dl className="bg-bg-elevated/70 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-xl border border-line px-4 py-3 text-sm">
                <dt className="text-text-muted">{t('cashier.shift.total')}</dt>
                <dd className="text-right">
                  <Money value={s.totals.total} className="font-heading text-lg font-bold text-text" />
                </dd>
                <dt className="text-text-muted">{t('cashier.shift.paymentsCount')}</dt>
                <dd className="tabular text-right text-text">{s.totals.paymentsCount}</dd>
                <dt className="text-text-muted">{t('cashier.shift.refundsCount')}</dt>
                <dd className="tabular text-right text-text">{s.totals.refundsCount}</dd>
                <dt className="text-text-muted">{t('cashier.shift.refundsTotal')}</dt>
                <dd className="text-right">
                  <Money
                    value={s.totals.refundsTotal}
                    className={cn(s.totals.refundsTotal > 0 && 'text-danger')}
                  />
                </dd>
              </dl>
            </div>
            <MethodChips byMethod={s.totals.byMethod} size="sm" />
            {s.note ? (
              <p className="bg-bg-elevated/60 rounded-lg border border-line px-3 py-2 text-sm text-text">
                <span className="text-text-muted">{t('cashier.shift.note')}:</span> {s.note}
              </p>
            ) : null}

            <section aria-label={t('cashier.shift.detailPayments')}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                {t('cashier.shift.detailPayments')}
              </h3>
              {detail.isLoading ? (
                <div className="space-y-2" aria-busy="true">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-9 w-full" />
                  ))}
                </div>
              ) : detail.isError ? (
                <EmptyState
                  compact
                  title={t('cashier.toast.loadError')}
                  description={cashierErrorMessage(detail.error, t)}
                />
              ) : !detail.data || detail.data.payments.length === 0 ? (
                <EmptyState compact icon={ReceiptText} title={t('cashier.shift.noPayments')} />
              ) : (
                <ul className="scrollbar-thin max-h-64 divide-y divide-line overflow-auto rounded-xl border border-line">
                  {detail.data.payments.map((p) => (
                    <li
                      key={p.id}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 text-sm',
                        p.amount < 0 && 'bg-destructive/5',
                      )}
                    >
                      <span className="tabular w-12 shrink-0 text-text-muted">
                        {fmtTime(p.createdAt, locale)}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-text">
                        {p.visit.patient.fullName}
                        <span className="ml-1 font-mono text-xs text-text-muted">{p.receiptNo ?? ''}</span>
                      </span>
                      {p.amount < 0 ? (
                        <Badge variant="danger">
                          <Undo2 aria-hidden="true" />
                          {t('cashier.payments.refundRow')}
                        </Badge>
                      ) : null}
                      <MethodBadge method={p.method} iconOnly className="sm:hidden" />
                      <MethodBadge method={p.method} className="hidden sm:inline-flex" />
                      <Money
                        value={p.amount}
                        signed={p.amount < 0}
                        className={cn(
                          'w-28 shrink-0 text-right font-medium',
                          p.amount < 0 ? 'text-danger' : 'text-text',
                        )}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="flex justify-end">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {t('common.close')}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
