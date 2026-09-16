'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CalendarDays, ClipboardList, Plus, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { api, qs } from '@/lib/api/client';
import { can } from '@/lib/permissions';
import type { SessionUser } from '@/lib/auth/session';
import { fmtDate, fmtTime } from '@/lib/date';
import { useLocale } from '@/i18n/client';
import type { ListVisitsQuery } from '@/lib/visits/schemas';
import type { VisitListItemDTO } from '@/lib/visits/types';
import { visitBalance } from '@/lib/visits/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Segmented } from '@/components/ui/segmented';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { Money } from '@/components/shared/money';
import { Pagination } from '@/components/shared/pagination';
import { StatusBadge } from '@/components/shared/status-badge';
import { NewVisitDialog } from './new-visit-dialog';
import { visitApi, visitErrorMessage, visitsKey } from './visit-api';
import { isDateKey, toDateKey } from './visit-utils';

export interface VisitsListInitial {
  from: string;
  to: string;
  doctorId?: string;
  status?: 'OPEN' | 'COMPLETED' | 'CANCELLED';
  /** ?new=1 — "Yangi qabul" oynasini darhol ochish */
  openNew?: boolean;
  patientId?: string;
}

export interface VisitsListProps {
  user: SessionUser;
  initial: VisitsListInitial;
  today: string;
  childAgeLimit: number;
}

interface DoctorOption {
  id: string;
  fullName: string;
  color: string;
  isActive: boolean;
}

type Quick = 'today' | 'yesterday' | 'week' | 'month' | 'custom';
const ALL = '__all__';
const PAGE_SIZE = 20;

function shiftKey(base: string, days: number): string {
  const d = new Date(`${base}T12:00:00`);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

function quickOf(from: string, to: string, today: string): Quick {
  if (from === today && to === today) return 'today';
  const y = shiftKey(today, -1);
  if (from === y && to === y) return 'yesterday';
  if (to === today && from === shiftKey(today, -6)) return 'week';
  if (to === today && from === shiftKey(today, -29)) return 'month';
  return 'custom';
}

/**
 * Qabullar roʻyxati: sana oraligʻi (default bugun), shifokor, holat; jadval; sahifalash; "Yangi qabul".
 */
export function VisitsList({ user, initial, today, childAgeLimit }: VisitsListProps) {
  const { locale, t } = useLocale();
  const router = useRouter();

  const [from, setFrom] = React.useState(initial.from);
  const [to, setTo] = React.useState(initial.to);
  const [doctorId, setDoctorId] = React.useState(initial.doctorId ?? '');
  const [status, setStatus] = React.useState<VisitsListInitial['status'] | ''>(initial.status ?? '');
  const [page, setPage] = React.useState(1);
  const [newOpen, setNewOpen] = React.useState(!!initial.openNew);

  const params: Partial<ListVisitsQuery> = React.useMemo(
    () => ({
      from: isDateKey(from) ? from : undefined,
      to: isDateKey(to) ? to : undefined,
      doctorId: doctorId || undefined,
      status: status || undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    [from, to, doctorId, status, page],
  );

  const list = useQuery({
    queryKey: visitsKey(params),
    queryFn: () => visitApi.list(params),
    placeholderData: keepPreviousData,
  });

  React.useEffect(() => {
    if (list.error) toast.error(visitErrorMessage(list.error, t));
  }, [list.error, t]);

  const doctors = useQuery({
    queryKey: ['users', { role: 'DOCTOR' }] as const,
    queryFn: () => api.get<{ items: DoctorOption[] }>(`/api/users${qs({ role: 'DOCTOR' })}`),
    staleTime: 5 * 60_000,
  });

  const quick = quickOf(from, to, today);
  const setQuick = (q: Quick) => {
    setPage(1);
    switch (q) {
      case 'today':
        setFrom(today);
        setTo(today);
        break;
      case 'yesterday':
        setFrom(shiftKey(today, -1));
        setTo(shiftKey(today, -1));
        break;
      case 'week':
        setFrom(shiftKey(today, -6));
        setTo(today);
        break;
      case 'month':
        setFrom(shiftKey(today, -29));
        setTo(today);
        break;
      default:
        break;
    }
  };

  const reset = () => {
    setFrom(today);
    setTo(today);
    setDoctorId('');
    setStatus('');
    setPage(1);
  };

  const singleDay = from === to;
  const columns = React.useMemo<DataTableColumn<VisitListItemDTO>[]>(
    () => [
      {
        key: 'time',
        header: t('visits.list.columns.time'),
        width: 64,
        cell: (v) => (
          <div className="tabular leading-tight">
            <div className="font-medium text-text">{fmtTime(v.createdAt, locale)}</div>
            {!singleDay ? (
              <div className="text-xs text-text-muted">{fmtDate(v.createdAt, locale)}</div>
            ) : null}
          </div>
        ),
      },
      {
        key: 'patient',
        header: t('visits.list.columns.patient'),
        cell: (v) => (
          <div className="min-w-0 leading-tight">
            <div className="truncate font-medium text-text">{v.patient.fullName}</div>
            <div className="tabular truncate text-xs text-text-muted">{v.patient.cardNumber}</div>
          </div>
        ),
      },
      {
        key: 'doctor',
        header: t('visits.list.columns.doctor'),
        hideOnMobile: true,
        cell: (v) => (
          <span className="inline-flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: v.doctor.color }}
            />
            <span className="truncate">{v.doctor.fullName}</span>
          </span>
        ),
      },
      {
        key: 'lines',
        header: t('visits.list.columns.lines'),
        align: 'center',
        hideOnMobile: true,
        width: 90,
        cell: (v) => <span className="tabular text-text-muted">{v.linesCount}</span>,
      },
      {
        key: 'total',
        header: t('visits.list.columns.total'),
        align: 'right',
        cell: (v) => <Money value={v.totalNet} suffix={null} className="font-semibold text-text" />,
      },
      {
        key: 'paid',
        header: t('visits.list.columns.paid'),
        align: 'right',
        hideOnMobile: true,
        cell: (v) => (
          <Money
            value={v.paidAmount}
            suffix={null}
            muted={v.paidAmount === 0}
            className={v.paidAmount > 0 ? 'text-[#00FFB2]' : undefined}
          />
        ),
      },
      {
        key: 'balance',
        header: t('visits.list.columns.balance'),
        align: 'right',
        hideOnMobile: true,
        cell: (v) => {
          const b = visitBalance(v);
          return (
            <Money
              value={b}
              suffix={null}
              className={cn(b > 0 ? 'font-semibold text-danger' : b < 0 ? 'text-accent' : 'text-text-muted')}
            />
          );
        },
      },
      {
        key: 'status',
        header: t('visits.list.columns.status'),
        width: 112,
        cell: (v) => <StatusBadge kind="visit" status={v.status} />,
      },
    ],
    [t, locale, singleDay],
  );

  const data = list.data;
  const canCreate = can(user.role, 'visits.create');

  return (
    <div className="space-y-5">
      <PageHeader
        title={t('visits.list.title')}
        description={t('visits.list.description')}
        leading={<ClipboardList aria-hidden="true" />}
        actions={
          canCreate ? (
            <Button type="button" variant="gradient" className="glow" onClick={() => setNewOpen(true)}>
              <Plus aria-hidden="true" />
              {t('visits.list.newVisit')}
            </Button>
          ) : undefined
        }
      />

      {/* Filtrlar */}
      <div className="glass flex flex-col gap-3 rounded-xl p-3 sm:p-4 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-text-muted">{t('common.date')}</span>
          <Segmented<Quick>
            value={quick}
            onChange={setQuick}
            size="sm"
            ariaLabel={t('common.date')}
            options={[
              { value: 'today', label: t('visits.list.filters.today') },
              { value: 'yesterday', label: t('visits.list.filters.yesterday') },
              { value: 'week', label: t('visits.list.filters.week') },
              { value: 'month', label: t('visits.list.filters.month') },
              ...(quick === 'custom'
                ? [
                    {
                      value: 'custom' as const,
                      label: <CalendarDays className="size-3.5" aria-label={t('common.filter')} />,
                    },
                  ]
                : []),
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vf-from" className="text-xs text-text-muted">
              {t('visits.list.filters.from')}
            </Label>
            <Input
              id="vf-from"
              type="date"
              value={from}
              max={to || undefined}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
              className="h-9 w-full min-w-0 text-sm sm:w-40"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vf-to" className="text-xs text-text-muted">
              {t('visits.list.filters.to')}
            </Label>
            <Input
              id="vf-to"
              type="date"
              value={to}
              min={from || undefined}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
              className="h-9 w-full min-w-0 text-sm sm:w-40"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 lg:flex">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vf-doctor" className="text-xs text-text-muted">
              {t('visits.list.filters.doctor')}
            </Label>
            <Select
              value={doctorId || ALL}
              onValueChange={(v) => {
                setDoctorId(v === ALL ? '' : v);
                setPage(1);
              }}
            >
              <SelectTrigger
                id="vf-doctor"
                className="h-9 w-full text-sm lg:w-52"
                aria-label={t('visits.list.filters.doctor')}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('visits.list.filters.allDoctors')}</SelectItem>
                {(doctors.data?.items ?? []).map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    <span className="inline-flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="size-2 rounded-full"
                        style={{ backgroundColor: d.color }}
                      />
                      {d.fullName}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vf-status" className="text-xs text-text-muted">
              {t('visits.list.filters.status')}
            </Label>
            <Select
              value={status || ALL}
              onValueChange={(v) => {
                setStatus(v === ALL ? '' : (v as VisitsListInitial['status']));
                setPage(1);
              }}
            >
              <SelectTrigger
                id="vf-status"
                className="h-9 w-full text-sm lg:w-44"
                aria-label={t('visits.list.filters.status')}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('visits.list.filters.allStatuses')}</SelectItem>
                {(['OPEN', 'COMPLETED', 'CANCELLED'] as const).map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`common.visitStatus.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2 lg:ml-auto">
          {data ? (
            <span className="tabular text-xs text-text-muted">
              {t('visits.list.count', { n: data.total })}
            </span>
          ) : null}
          <Button type="button" variant="ghost" size="sm" onClick={reset} className="text-text-muted">
            <RotateCcw aria-hidden="true" />
            {t('visits.list.filters.reset')}
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        rowKey={(v) => v.id}
        loading={list.isPending}
        caption={t('visits.list.title')}
        emptyIcon={ClipboardList}
        emptyText={t('visits.list.empty')}
        emptyDescription={t('visits.list.emptyDescription')}
        emptyAction={
          canCreate ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setNewOpen(true)}>
              <Plus aria-hidden="true" />
              {t('visits.list.newVisit')}
            </Button>
          ) : undefined
        }
        onRowClick={(v) => router.push(`/dashboard/visits/${v.id}`)}
        rowClassName={(v) => (v.status === 'OPEN' ? 'bg-primary/5' : undefined)}
        className={cn(list.isFetching && !list.isPending && 'opacity-80 transition-opacity')}
        footer={
          data && data.total > PAGE_SIZE ? (
            <Pagination
              page={data.page}
              pageSize={data.pageSize}
              total={data.total}
              onChange={setPage}
              simple
            />
          ) : undefined
        }
      />

      <NewVisitDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        user={user}
        initialPatientId={initial.patientId ?? null}
        childAgeLimit={childAgeLimit}
      />
    </div>
  );
}
