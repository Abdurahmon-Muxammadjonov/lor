'use client';

import * as React from 'react';
import Link from 'next/link';
import { CheckCircle2, ExternalLink, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale } from '@/i18n/client';
import { fmtSmartDate, fmtTime } from '@/lib/date';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/skeleton';
import { Kbd } from '@/components/ui/kbd';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { GenderAvatar } from '@/components/shared/gender-avatar';
import { Money } from '@/components/shared/money';
import { SearchInput } from '@/components/shared/search-input';
import { StatusBadge } from '@/components/shared/status-badge';
import { paymentStatusOf } from '@/lib/cashier/format';
import type { UnpaidScope } from '@/lib/cashier/schemas';
import type { UnpaidListResponse, UnpaidVisitDTO } from '@/lib/cashier/types';

export interface UnpaidListProps {
  data: UnpaidListResponse | undefined;
  loading: boolean;
  fetching?: boolean;
  scope: UnpaidScope;
  onScopeChange: (s: UnpaidScope) => void;
  q: string;
  onQChange: (q: string) => void;
  canPay: boolean;
  onPay: (visitId: string) => void;
}

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

/** Toʻlanmagan qabullar: qidiruv, Bugun / Barcha qarzlar, jadval (desktop) va kartalar (mobil), [Toʻlash] */
export function UnpaidList({
  data,
  loading,
  fetching = false,
  scope,
  onScopeChange,
  q,
  onQChange,
  canPay,
  onPay,
}: UnpaidListProps) {
  const { t, locale } = useLocale();
  const items = data?.items ?? [];

  const columns = React.useMemo<DataTableColumn<UnpaidVisitDTO>[]>(
    () => [
      {
        key: 'time',
        header: t('cashier.unpaid.time'),
        width: 150,
        cell: (v) => (
          <span className="tabular text-text-muted">
            {scope === 'today' ? fmtTime(v.createdAt, locale) : fmtSmartDate(v.createdAt, locale)}
          </span>
        ),
      },
      {
        key: 'patient',
        header: t('cashier.unpaid.patient'),
        cell: (v) => (
          <div className="flex min-w-0 items-center gap-3">
            <GenderAvatar gender={v.patient.gender} name={v.patient.fullName} size="sm" />
            <div className="min-w-0">
              <div className="truncate font-medium text-text">{v.patient.fullName}</div>
              <div className="truncate text-xs text-text-muted">
                <span className="tabular font-mono">{v.patient.cardNumber}</span> ·{' '}
                {t('cashier.unpaid.lines', { n: v.linesCount })}
              </div>
            </div>
          </div>
        ),
      },
      {
        key: 'doctor',
        header: t('cashier.unpaid.doctor'),
        hideOnMobile: true,
        cell: (v) => (
          <span className="inline-flex items-center gap-2 text-text">
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: v.doctor.color }}
            />
            {v.doctor.fullName}
          </span>
        ),
      },
      {
        key: 'total',
        header: t('cashier.unpaid.total'),
        align: 'right',
        hideOnMobile: true,
        cell: (v) => <Money value={v.totalNet} suffix={null} className="text-text" />,
      },
      {
        key: 'paid',
        header: t('cashier.unpaid.paid'),
        align: 'right',
        hideOnMobile: true,
        cell: (v) => <Money value={v.paidAmount} suffix={null} muted />,
      },
      {
        key: 'balance',
        header: t('cashier.unpaid.balance'),
        align: 'right',
        cell: (v) => (
          <div className="flex flex-col items-end gap-1">
            <Money value={v.balance} className="font-heading text-base font-bold text-danger" />
            <StatusBadge kind="payment" status={paymentStatusOf(v)} className="md:hidden" />
          </div>
        ),
      },
      {
        key: 'actions',
        header: <span className="sr-only">{t('common.actions')}</span>,
        align: 'right',
        width: 140,
        cell: (v) => (
          <div className="flex justify-end gap-1" onClick={stop} onKeyDown={stop}>
            <Button
              asChild
              variant="ghost"
              size="icon"
              aria-label={t('cashier.unpaid.openVisit')}
              title={t('cashier.unpaid.openVisit')}
            >
              <Link href={`/dashboard/visits/${encodeURIComponent(v.id)}`}>
                <ExternalLink aria-hidden="true" />
              </Link>
            </Button>
            {canPay ? (
              <Button
                type="button"
                size="sm"
                variant="default"
                onClick={() => onPay(v.id)}
                aria-label={`${t('cashier.unpaid.pay')}: ${v.patient.fullName}`}
              >
                <Wallet aria-hidden="true" />
                {t('cashier.unpaid.pay')}
              </Button>
            ) : null}
          </div>
        ),
      },
    ],
    [t, locale, scope, canPay, onPay],
  );

  const emptyTitle = q
    ? t('cashier.unpaid.emptySearch')
    : scope === 'today'
      ? t('cashier.unpaid.emptyToday')
      : t('cashier.unpaid.empty');

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          value={q}
          onChange={onQChange}
          placeholder={t('cashier.unpaid.searchPlaceholder')}
          loading={fetching}
          className="sm:max-w-md"
          aria-label={t('common.search')}
        />
        <div className="flex items-center gap-3">
          <Segmented<UnpaidScope>
            value={scope}
            onChange={onScopeChange}
            size="sm"
            ariaLabel={t('common.filter')}
            options={[
              { value: 'today', label: t('cashier.unpaid.scope.today') },
              { value: 'all', label: t('cashier.unpaid.scope.all') },
            ]}
          />
          {canPay && items.length > 0 ? (
            <span className="hidden items-center gap-1.5 text-xs text-text-muted lg:inline-flex">
              <Kbd>F2</Kbd>
              {t('cashier.hotkeys.pay')}
            </span>
          ) : null}
        </div>
      </div>

      {/* Desktop jadval */}
      <div className="hidden md:block">
        <DataTable
          columns={columns}
          data={items}
          rowKey={(v) => v.id}
          loading={loading && !data}
          emptyIcon={CheckCircle2}
          emptyText={emptyTitle}
          onRowClick={canPay ? (v) => onPay(v.id) : undefined}
          caption={t('cashier.unpaid.title')}
          footer={
            data && data.total > items.length ? (
              <span className="text-xs text-text-muted">
                {t('cashier.unpaid.shown', { shown: items.length, total: data.total })}
              </span>
            ) : undefined
          }
        />
      </div>

      {/* Mobil kartalar */}
      <ul className="space-y-2 md:hidden" aria-label={t('cashier.unpaid.title')}>
        {loading && !data
          ? Array.from({ length: 4 }).map((_, i) => (
              <li key={i} className="rounded-xl border border-line bg-surface p-4" aria-hidden="true">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-9 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
                <Skeleton className="mt-3 h-9 w-full" />
              </li>
            ))
          : null}
        {!loading && items.length === 0 ? (
          <li>
            <EmptyState icon={CheckCircle2} title={emptyTitle} />
          </li>
        ) : null}
        {items.map((v) => (
          <li key={v.id} className={cn('rounded-xl border border-line bg-surface p-4 shadow-card')}>
            <div className="flex items-start gap-3">
              <GenderAvatar gender={v.patient.gender} name={v.patient.fullName} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-text">{v.patient.fullName}</div>
                <div className="truncate text-xs text-text-muted">
                  <span className="tabular font-mono">{v.patient.cardNumber}</span> · {v.doctor.fullName}
                </div>
                <div className="tabular mt-1 text-xs text-text-muted">
                  {fmtSmartDate(v.createdAt, locale)} · {t('cashier.unpaid.lines', { n: v.linesCount })}
                </div>
              </div>
              <div className="text-right">
                <Money value={v.balance} className="font-heading text-lg font-bold text-danger" />
                <div className="tabular text-xs text-text-muted">
                  <Money value={v.paidAmount} suffix={null} /> / <Money value={v.totalNet} suffix={null} />
                </div>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link href={`/dashboard/visits/${encodeURIComponent(v.id)}`}>
                  <ExternalLink aria-hidden="true" />
                  {t('cashier.unpaid.openVisit')}
                </Link>
              </Button>
              {canPay ? (
                <Button type="button" size="sm" className="flex-1" onClick={() => onPay(v.id)}>
                  <Wallet aria-hidden="true" />
                  {t('cashier.unpaid.pay')}
                </Button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
