'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, ReceiptText, Undo2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale } from '@/i18n/client';
import { fmtDateLong, fmtTime, todayKey } from '@/lib/date';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { Money } from '@/components/shared/money';
import { Pagination } from '@/components/shared/pagination';
import type { PaymentListItemDTO, PaymentListResponse } from '@/lib/cashier/types';
import { MethodBadge } from './method-badge';
import { MethodChips } from './shift-totals';

export interface PaymentsTableProps {
  data: PaymentListResponse | undefined;
  loading: boolean;
  date: string;
  onDateChange: (date: string) => void;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  canRefund: boolean;
  onReprint: (payment: PaymentListItemDTO) => void;
  onRefund: (payment: PaymentListItemDTO) => void;
  /** Chek yuklanayotgan toʻlov id (spinner) */
  reprintingId?: string | null;
}

function shiftDate(key: string, days: number): string {
  const d = new Date(`${key}T12:00:00+05:00`);
  d.setUTCDate(d.getUTCDate() + days);
  return todayKey(d);
}

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

/** Kun boʻyicha toʻlovlar: sana navigatsiyasi, usullar boʻyicha jamlar, jadval ([Chek] qayta chop etish, [Qaytarish]) */
export function PaymentsTable({
  data,
  loading,
  date,
  onDateChange,
  page,
  pageSize,
  onPageChange,
  canRefund,
  onReprint,
  onRefund,
  reprintingId = null,
}: PaymentsTableProps) {
  const { t, locale } = useLocale();
  const items = data?.items ?? [];
  const isToday = date === todayKey();
  const summary = data?.summary;

  const columns = React.useMemo<DataTableColumn<PaymentListItemDTO>[]>(
    () => [
      {
        key: 'receiptNo',
        header: t('cashier.payments.receiptNo'),
        width: 150,
        cell: (p) => (
          <div className="flex flex-col gap-1">
            <span className="tabular font-mono text-xs text-text">{p.receiptNo ?? '—'}</span>
            {p.amount < 0 ? (
              <Badge variant="danger" className="w-fit">
                <Undo2 aria-hidden="true" />
                {t('cashier.payments.refundRow')}
              </Badge>
            ) : null}
          </div>
        ),
      },
      {
        key: 'time',
        header: t('cashier.payments.time'),
        width: 90,
        cell: (p) => <span className="tabular text-text-muted">{fmtTime(p.createdAt, locale)}</span>,
      },
      {
        key: 'patient',
        header: t('cashier.payments.patient'),
        cell: (p) => (
          <div className="min-w-0">
            <div className="truncate font-medium text-text">{p.visit.patient.fullName}</div>
            <div className="truncate text-xs text-text-muted">
              <span className="tabular font-mono">{p.visit.patient.cardNumber}</span> ·{' '}
              {p.visit.doctor.fullName}
              {p.note ? <span className="ml-1 italic opacity-80">— {p.note}</span> : null}
            </div>
          </div>
        ),
      },
      {
        key: 'method',
        header: t('cashier.payments.method'),
        width: 120,
        cell: (p) => <MethodBadge method={p.method} />,
      },
      {
        key: 'amount',
        header: t('cashier.payments.amount'),
        align: 'right',
        cell: (p) => (
          <Money
            value={p.amount}
            signed={p.amount < 0}
            className={cn('font-heading text-base font-bold', p.amount < 0 ? 'text-danger' : 'text-text')}
          />
        ),
      },
      {
        key: 'cashier',
        header: t('cashier.payments.cashier'),
        hideOnMobile: true,
        cell: (p) => <span className="text-text-muted">{p.cashier.fullName}</span>,
      },
      {
        key: 'actions',
        header: <span className="sr-only">{t('common.actions')}</span>,
        align: 'right',
        width: 190,
        cell: (p) => (
          <div className="flex justify-end gap-1" onClick={stop} onKeyDown={stop}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onReprint(p)}
              loading={reprintingId === p.id}
              aria-label={`${t('cashier.payments.reprint')} ${p.receiptNo ?? ''}`}
            >
              <ReceiptText aria-hidden="true" />
              {t('cashier.payments.reprint')}
            </Button>
            {canRefund && p.amount > 0 && p.visit.paidAmount > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-text-muted hover:text-danger"
                onClick={() => onRefund(p)}
                aria-label={`${t('cashier.payments.refund')} ${p.receiptNo ?? ''}`}
              >
                <Undo2 aria-hidden="true" />
                {t('cashier.payments.refund')}
              </Button>
            ) : null}
          </div>
        ),
      },
    ],
    [t, locale, canRefund, onReprint, onRefund, reprintingId],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t('cashier.payments.prevDay')}
            onClick={() => onDateChange(shiftDate(date, -1))}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Input
            type="date"
            value={date}
            max={todayKey()}
            onChange={(e) => e.target.value && onDateChange(e.target.value)}
            aria-label={t('cashier.payments.date')}
            className="tabular w-[11.5rem]"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t('cashier.payments.nextDay')}
            onClick={() => onDateChange(shiftDate(date, 1))}
            disabled={isToday}
          >
            <ChevronRight aria-hidden="true" />
          </Button>
          {!isToday ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => onDateChange(todayKey())}>
              {t('cashier.payments.today')}
            </Button>
          ) : null}
          <span className="hidden text-sm text-text-muted sm:inline">
            {fmtDateLong(`${date}T12:00:00+05:00`, locale)}
          </span>
        </div>
        {summary ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="text-text-muted">
              {t('cashier.payments.dayTotal')}:{' '}
              <Money value={summary.total} className="font-heading text-base font-bold text-text" />
            </span>
            <span className="tabular text-xs text-text-muted">
              {t('cashier.payments.count', { n: summary.paymentsCount })}
              {summary.refundsCount > 0
                ? ` · ${t('cashier.payments.refunds', { n: summary.refundsCount })}`
                : ''}
            </span>
          </div>
        ) : null}
      </div>

      {summary ? <MethodChips byMethod={summary.byMethod} size="sm" hideZero /> : null}

      <DataTable
        columns={columns}
        data={items}
        rowKey={(p) => p.id}
        loading={loading && !data}
        emptyIcon={ReceiptText}
        emptyText={t('cashier.payments.empty')}
        caption={t('cashier.payments.title')}
        rowClassName={(p) => (p.amount < 0 ? 'bg-destructive/5' : undefined)}
        footer={
          data && data.total > pageSize ? (
            <Pagination page={page} pageSize={pageSize} total={data.total} onChange={onPageChange} simple />
          ) : undefined
        }
      />
    </div>
  );
}
