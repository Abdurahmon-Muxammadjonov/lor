'use client';

import * as React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { ExternalLink, MessageSquareText, User, WalletCards } from 'lucide-react';
import { fmtDate, fmtSmartDate } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import { formatPhone } from '@/lib/utils';
import { useLocale } from '@/i18n/client';
import { ApiClientError } from '@/lib/api/client';
import { formatCount } from '@/lib/reports/format';
import type { DebtorRowDTO, DebtorsReportDTO } from '@/lib/reports/types';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Money } from '@/components/shared/money';
import { PhoneLink } from '@/components/shared/phone-link';
import { StatCard } from '@/components/shared/stat-card';
import { useConfirm } from '@/components/shared/confirm-dialog';
import { ReportCard } from './report-card';
import { ReportTable, type ReportColumn } from './report-table';
import { useDebtReminder } from './use-reports';

export interface DebtorsTabProps {
  data: DebtorsReportDTO | undefined;
  loading: boolean;
  dimmed: boolean;
  allTime: boolean;
  onAllTimeChange: (v: boolean) => void;
}

type Scope = 'range' | 'all';

/** Qarzdorlar: bemor (karta), telefon (tel: havola), qarzli qabullar, jami qarz, oxirgi qabul, SMS eslatma */
export function DebtorsTab({ data, loading, dimmed, allTime, onAllTimeChange }: DebtorsTabProps) {
  const { t, locale } = useLocale();
  const queryClient = useQueryClient();
  const [confirm, confirmElement] = useConfirm();
  const remind = useDebtReminder();
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const rows = React.useMemo(() => data?.rows ?? [], [data]);

  const sendReminder = React.useCallback(
    async (row: DebtorRowDTO) => {
      const ok = await confirm({
        title: t('reports.debtors.smsConfirmTitle'),
        description: t('reports.debtors.smsConfirmDescription', {
          name: row.patient.fullName,
          phone: formatPhone(row.patient.phone) || row.patient.phone,
          amount: formatMoney(row.totalDebt, { suffix: t('common.currency') }),
        }),
        confirmText: t('reports.debtors.sms'),
        hideIcon: true,
      });
      if (!ok) return;
      setPendingId(row.patient.id);
      try {
        await remind.mutateAsync({ patientId: row.patient.id, locale });
        toast.success(t('reports.debtors.smsSent'), { description: `${row.patient.fullName} · ${formatPhone(row.patient.phone)}` });
        await queryClient.invalidateQueries({ queryKey: ['reports', 'debtors'] });
      } catch (err) {
        const message = err instanceof ApiClientError ? (err.code === 'CONFLICT' ? t('reports.debtors.alreadySent') : err.message) : t('reports.debtors.smsError');
        toast.error(t('reports.debtors.smsError'), { description: message });
      } finally {
        setPendingId(null);
      }
    },
    [confirm, t, locale, remind, queryClient],
  );

  const columns = React.useMemo<ReportColumn<DebtorRowDTO>[]>(
    () => [
      {
        key: 'patient',
        header: t('reports.debtors.patient'),
        cell: (r) => (
          <div className="min-w-0">
            <Link
              href={`/dashboard/patients/${r.patient.id}`}
              className="block truncate font-medium text-text underline-offset-4 hover:text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            >
              {r.patient.fullName}
            </Link>
            <div className="font-mono text-xs text-text-muted">{r.patient.cardNumber}</div>
          </div>
        ),
      },
      { key: 'phone', header: t('reports.debtors.phone'), cell: (r) => <PhoneLink phone={r.patient.phone} withIcon /> },
      { key: 'visits', header: t('reports.debtors.visits'), align: 'right', hideOnMobile: true, cell: (r) => formatCount(r.visits), total: formatCount(rows.reduce((s, r) => s + r.visits, 0)) },
      {
        key: 'debt',
        header: t('reports.debtors.debt'),
        align: 'right',
        cell: (r) => <Money value={r.totalDebt} className="font-semibold text-danger" />,
        total: <Money value={data?.total ?? 0} className="text-danger" />,
      },
      {
        key: 'last',
        header: t('reports.debtors.lastVisit'),
        hideOnMobile: true,
        cell: (r) => (
          <Link
            href={`/dashboard/visits/${r.lastVisitId}`}
            className="inline-flex items-center gap-1 whitespace-nowrap rounded-sm text-text-muted underline-offset-4 hover:text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring tabular"
          >
            {fmtDate(r.lastVisit, locale)}
            <ExternalLink className="size-3" aria-hidden="true" />
          </Link>
        ),
      },
      {
        key: 'sms',
        header: t('reports.debtors.lastSms'),
        hideOnMobile: true,
        cell: (r) => <span className="whitespace-nowrap text-xs text-text-muted tabular">{r.lastSmsAt ? fmtSmartDate(r.lastSmsAt, locale) : '—'}</span>,
      },
      {
        key: 'actions',
        header: <span className="sr-only">{t('reports.debtors.actions')}</span>,
        align: 'right',
        cell: (r) => {
          const disabledReason = !r.patient.smsConsent ? t('reports.debtors.noConsent') : !r.patient.phone ? t('reports.debtors.noPhone') : null;
          const busy = pendingId === r.patient.id;
          return (
            <div className="flex items-center justify-end gap-1">
              <Button asChild variant="ghost" size="sm" aria-label={`${t('reports.debtors.patientLink')}: ${r.patient.fullName}`}>
                <Link href={`/dashboard/patients/${r.patient.id}`}>
                  <User aria-hidden="true" />
                  <span className="hidden lg:inline">{t('reports.debtors.patientLink')}</span>
                </Link>
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={disabledReason ? 0 : -1} className="inline-flex">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!!disabledReason || busy}
                      loading={busy}
                      onClick={() => void sendReminder(r)}
                      aria-label={`${t('reports.debtors.sms')}: ${r.patient.fullName}`}
                    >
                      {busy ? null : <MessageSquareText aria-hidden="true" />}
                      <span className="hidden sm:inline">SMS</span>
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>{disabledReason ?? t('reports.debtors.sms')}</TooltipContent>
              </Tooltip>
            </div>
          );
        },
      },
    ],
    [t, locale, rows, data, pendingId, sendReminder],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
        <StatCard title={t('reports.debtors.totalDebt')} value={<Money value={data?.total ?? 0} />} icon={WalletCards} accent="danger" loading={loading} hint={data ? t('reports.debtors.count', { n: data.count }) : undefined} />
        <StatCard title={t('reports.debtors.visits')} value={formatCount(rows.reduce((s, r) => s + r.visits, 0))} icon={User} accent="violet" loading={loading} />
      </div>
      <ReportCard
        title={t('reports.debtors.tableTitle')}
        description={t('reports.debtors.tableDescription')}
        dimmed={dimmed}
        contentClassName="-mx-4 sm:mx-0"
        actions={
          <Segmented<Scope>
            value={allTime ? 'all' : 'range'}
            onChange={(v) => onAllTimeChange(v === 'all')}
            size="sm"
            ariaLabel={t('reports.toolbar.range')}
            options={[
              { value: 'range', label: t('reports.debtors.scopeRange') },
              { value: 'all', label: t('reports.debtors.scopeAll') },
            ]}
          />
        }
      >
        <ReportTable columns={columns} rows={rows} rowKey={(r) => r.patient.id} loading={loading} totals emptyIcon={WalletCards} caption={t('reports.debtors.tableTitle')} maxHeight="70vh" dense />
      </ReportCard>
      {confirmElement}
    </div>
  );
}
