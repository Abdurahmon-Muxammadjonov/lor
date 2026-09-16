'use client';

import * as React from 'react';
import Link from 'next/link';
import { Banknote, ExternalLink, Receipt, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale, useT } from '@/i18n/client';
import { fmtDate, fmtDateTime } from '@/lib/date';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { EmptyState } from '@/components/shared/empty-state';
import { Money } from '@/components/shared/money';
import { StatusBadge } from '@/components/shared/status-badge';
import type { PatientDebtItemDTO, PatientPaymentDTO } from '@/lib/patients/types';
import { patientErrorMessage, usePatientPayments } from './use-patients';

export interface PatientFinanceTabProps {
  patientId: string;
  enabled: boolean;
  canPay: boolean;
}

function SummaryTile({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: number;
  tone: 'muted' | 'mint' | 'danger';
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{label}</div>
      <Money
        value={value}
        className={cn(
          'mt-1 block font-heading text-xl font-bold',
          tone === 'mint' && 'text-[#00FFB2]',
          tone === 'danger' && 'text-danger',
          tone === 'muted' && 'text-text',
        )}
      />
      {hint ? <div className="mt-1 text-xs text-text-muted">{hint}</div> : null}
    </div>
  );
}

/** Moliya: balans xulosasi, qabullar boʻyicha qarzlar, toʻlovlar tarixi */
export function PatientFinanceTab({ patientId, enabled, canPay }: PatientFinanceTabProps) {
  const t = useT();
  const { locale } = useLocale();
  const q = usePatientPayments(patientId, enabled);

  const paymentColumns = React.useMemo<DataTableColumn<PatientPaymentDTO>[]>(
    () => [
      {
        key: 'date',
        header: t('patients.finance.date'),
        width: 150,
        cell: (p) => <span className="tabular">{fmtDateTime(p.createdAt, locale)}</span>,
      },
      {
        key: 'receipt',
        header: t('patients.finance.receipt'),
        width: 130,
        hideOnMobile: true,
        cell: (p) => <span className="tabular font-mono text-xs text-text-muted">{p.receiptNo ?? '—'}</span>,
      },
      {
        key: 'method',
        header: t('patients.finance.method'),
        width: 120,
        cell: (p) => (
          <span className="inline-flex flex-wrap items-center gap-1">
            <Badge variant="outline">{t(`common.payMethod.${p.method}`)}</Badge>
            {p.amount < 0 ? <Badge variant="danger">{t('patients.finance.refund')}</Badge> : null}
          </span>
        ),
      },
      {
        key: 'amount',
        header: t('patients.finance.amount'),
        align: 'right',
        width: 150,
        cell: (p) => (
          <Money
            value={p.amount}
            signed
            className={cn('font-semibold', p.amount < 0 ? 'text-danger' : 'text-[#00FFB2]')}
          />
        ),
      },
      {
        key: 'cashier',
        header: t('patients.finance.cashier'),
        hideOnMobile: true,
        cell: (p) => <span className="text-text-muted">{p.cashier.fullName}</span>,
      },
      {
        key: 'visit',
        header: t('patients.finance.visit'),
        hideOnMobile: true,
        cell: (p) => (
          <Link
            href={`/dashboard/visits/${p.visit.id}`}
            className="inline-flex items-center gap-1 text-accent hover:underline"
          >
            <span className="tabular">{fmtDate(p.visit.createdAt, locale)}</span>
            <span className="text-xs text-text-muted">· {p.visit.doctor.fullName}</span>
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </Link>
        ),
      },
    ],
    [t, locale],
  );

  if (q.isLoading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }
  if (q.isError || !q.data) {
    return (
      <div className="rounded-xl border border-line bg-surface">
        <EmptyState
          icon={Wallet}
          title={t('patients.errors.loadFailed')}
          description={q.error ? patientErrorMessage(q.error, t) : undefined}
          action={
            <Button type="button" variant="outline" size="sm" onClick={() => void q.refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      </div>
    );
  }

  const { summary, debts, items } = q.data;

  return (
    <div className="space-y-6">
      <section aria-label={t('patients.finance.summary')}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <SummaryTile
            label={t('patients.finance.totalNet')}
            value={summary.totalNet}
            tone="muted"
            hint={t('patients.finance.visitsCount', { n: summary.visits })}
          />
          <SummaryTile label={t('patients.finance.totalPaid')} value={summary.totalPaid} tone="mint" />
          <SummaryTile
            label={summary.debt < 0 ? t('patients.stats.overpaid') : t('patients.finance.totalDebt')}
            value={Math.abs(summary.debt)}
            tone={summary.debt > 0 ? 'danger' : 'mint'}
            hint={
              summary.debt > 0
                ? t('patients.finance.visitsCount', { n: summary.debtVisits })
                : t('patients.noDebt')
            }
          />
        </div>
      </section>

      <section aria-labelledby="patient-debts-title">
        <h3 id="patient-debts-title" className="mb-2 font-heading text-base font-semibold text-text">
          {t('patients.finance.debts')}
        </h3>
        {debts.length === 0 ? (
          <p className="rounded-lg border border-[#00FFB2]/20 bg-[#00FFB2]/5 px-3 py-2 text-sm text-[#00FFB2]">
            {t('patients.finance.noDebts')}
          </p>
        ) : (
          <ul className="space-y-2">
            {debts.map((d: PatientDebtItemDTO) => (
              <li
                key={d.visitId}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-destructive/25 bg-destructive/5 px-4 py-3"
              >
                <div className="min-w-0 flex-1 basis-48">
                  <div className="tabular font-medium text-text">
                    {t('patients.finance.visitLabel', { date: fmtDateTime(d.createdAt, locale) })}
                  </div>
                  <div className="text-xs text-text-muted">
                    {d.doctor.fullName} ·{' '}
                    <StatusBadge kind="visit" status={d.status} className="align-middle" />
                  </div>
                </div>
                <div className="tabular text-xs text-text-muted">
                  <Money value={d.paidAmount} /> / <Money value={d.totalNet} />
                </div>
                <Money value={d.balance} className="font-heading text-lg font-bold text-danger" />
                <div className="flex gap-2">
                  {canPay ? (
                    <Button asChild size="sm">
                      <Link href={`/dashboard/cashier?visitId=${encodeURIComponent(d.visitId)}`}>
                        <Banknote aria-hidden="true" />
                        {t('patients.finance.pay')}
                      </Link>
                    </Button>
                  ) : null}
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/dashboard/visits/${d.visitId}`}>
                      <ExternalLink aria-hidden="true" />
                      {t('patients.finance.openVisit')}
                    </Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="patient-payments-title">
        <h3 id="patient-payments-title" className="mb-2 font-heading text-base font-semibold text-text">
          {t('patients.finance.payments')}
        </h3>
        <DataTable
          columns={paymentColumns}
          data={items}
          rowKey={(p) => p.id}
          dense
          emptyIcon={Receipt}
          emptyText={t('patients.finance.empty')}
          emptyDescription={t('patients.finance.emptyDescription')}
          caption={t('patients.finance.payments')}
        />
      </section>
    </div>
  );
}
