'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { ChevronDown, Download, Stethoscope, TrendingUp, Users, Wallet } from 'lucide-react';
import { useLocale } from '@/i18n/client';
import { fmtDate } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import { buildCsv, downloadTextFile } from '@/lib/staff/csv';
import { formatPercent, monthKey } from '@/lib/staff/salary';
import type { SalaryDoctorDTO, SalaryReportDTO } from '@/lib/staff/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/shared/empty-state';
import { Money } from '@/components/shared/money';
import { StatCard } from '@/components/shared/stat-card';
import { MonthPicker } from './month-picker';
import { SalaryBreakdown } from './salary-breakdown';
import { StaffAvatar } from './staff-avatar';
import { useSalaryReport } from './use-staff';

type TFn = (key: string, params?: Record<string, string | number>) => string;

/** Hisobot → CSV matni (jadval + kunlik taqsimot) */
export function salaryReportToCsv(report: SalaryReportDTO, t: TFn, locale: 'uz' | 'ru'): string {
  const c = (k: string) => t(`staff.salary.csv.${k}`);
  const method = (d: SalaryDoctorDTO) => (d.salaryType === 'PERCENT' ? t('staff.form.percent') : t('staff.form.fixed'));
  const value = (d: SalaryDoctorDTO) => (d.salaryType === 'PERCENT' ? formatPercent(d.salaryValue) : formatMoney(d.salaryValue, { suffix: '' }));
  const rows: Array<Array<string | number | null | undefined>> = [
    [c('doctor'), c('specialty'), c('method'), c('value'), c('visits'), c('patients'), c('revenue'), c('salary')],
    ...report.doctors.map((d) => [d.doctor.fullName, d.doctor.specialty ?? '', method(d), value(d), d.visits, d.patients, d.revenue, d.salary]),
    [c('total'), '', '', '', report.totals.visits, report.totals.patients, report.totals.revenue, report.totals.salary],
    [],
    [c('doctor'), c('date'), c('visits'), c('patients'), c('revenue'), c('salary')],
    ...report.doctors.flatMap((d) =>
      d.days.map((day) => [d.doctor.fullName, fmtDate(`${day.date}T00:00:00`, locale), day.visits, day.patients, day.revenue, day.salary ?? '']),
    ),
  ];
  return buildCsv(rows);
}

function TableSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-hidden="true">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card-surface p-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-8 w-32" />
          </div>
        ))}
      </div>
      <div className="card-surface divide-y divide-line overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3.5">
            <Skeleton className="size-9 rounded-full" />
            <Skeleton className="h-4 w-44" />
            <Skeleton className="ml-auto h-4 w-24" />
            <Skeleton className="hidden h-4 w-28 md:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Ish haqi hisoboti (ADMIN): oy tanlash, jamlar, shifokorlar jadvali (kunlik taqsimot ochiladi), CSV eksport.
 * Maʼlumot: GET /api/users/salary?month=
 */
export function SalaryTable() {
  const { t, locale } = useLocale();
  const [month, setMonth] = React.useState(() => monthKey());
  const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());
  const query = useSalaryReport(month);
  const report = query.data;

  React.useEffect(() => {
    if (query.isError) toast.error(t('staff.salary.loadError'));
  }, [query.isError, t]);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const exportCsv = () => {
    if (!report) return;
    downloadTextFile(t('staff.salary.csv.fileName', { month }), salaryReportToCsv(report, t, locale));
    toast.success(t('staff.salary.exported'));
  };

  return (
    <section className="space-y-4" aria-labelledby="salary-title">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 id="salary-title" className="font-heading text-lg font-bold text-text">
            {t('staff.salary.title')}
          </h2>
          <p className="text-sm text-text-muted">{t('staff.salary.description')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <MonthPicker value={month} onChange={setMonth} id="salary-month" />
          <Button variant="outline" onClick={exportCsv} disabled={!report || report.doctors.length === 0}>
            <Download aria-hidden="true" />
            {t('staff.salary.export')}
          </Button>
        </div>
      </div>

      {query.isLoading ? (
        <TableSkeleton />
      ) : query.isError ? (
        <EmptyState
          icon={Wallet}
          title={t('staff.salary.loadError')}
          action={
            <Button variant="outline" onClick={() => query.refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      ) : !report || report.doctors.length === 0 ? (
        <EmptyState icon={Stethoscope} title={t('staff.salary.empty')} description={t('staff.salary.emptyDescription')} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title={t('staff.salary.summaryRevenue')} value={<Money value={report.totals.revenue} />} icon={TrendingUp} accent="cyan" />
            <StatCard title={t('staff.salary.summarySalary')} value={<Money value={report.totals.salary} />} icon={Wallet} accent="violet" />
            <StatCard
              title={t('staff.salary.summaryVisits')}
              value={<span className="tabular">{report.totals.visits}</span>}
              hint={t('staff.salary.summaryPatients', { n: report.totals.patients })}
              icon={Users}
              accent="mint"
            />
            <StatCard title={t('staff.salary.doctor')} value={<span className="tabular">{report.doctors.length}</span>} icon={Stethoscope} />
          </div>

          <div className="glass overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <Table className="min-w-[44rem]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-10" aria-label={t('staff.salary.expand')} />
                    <TableHead>{t('staff.salary.doctor')}</TableHead>
                    <TableHead className="text-right">{t('staff.salary.visits')}</TableHead>
                    <TableHead className="hidden text-right md:table-cell">{t('staff.salary.patients')}</TableHead>
                    <TableHead className="text-right">{t('staff.salary.revenue')}</TableHead>
                    <TableHead className="hidden md:table-cell">{t('staff.salary.method')}</TableHead>
                    <TableHead className="text-right">{t('staff.salary.calculated')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.doctors.map((d) => {
                    const open = expanded.has(d.doctor.id);
                    const detailsId = `salary-details-${d.doctor.id}`;
                    return (
                      <React.Fragment key={d.doctor.id}>
                        <TableRow
                          className={cn('cursor-pointer', open && 'bg-primary/5')}
                          onClick={() => toggle(d.doctor.id)}
                          data-state={open ? 'selected' : undefined}
                        >
                          <TableCell className="px-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-expanded={open}
                              aria-controls={detailsId}
                              aria-label={`${open ? t('staff.salary.collapse') : t('staff.salary.expand')}: ${d.doctor.fullName}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggle(d.doctor.id);
                              }}
                            >
                              <ChevronDown aria-hidden="true" className={cn('transition-transform duration-200', open && 'rotate-180')} />
                            </Button>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <StaffAvatar name={d.doctor.fullName} color={d.doctor.color} size="sm" dimmed={!d.doctor.isActive} />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="truncate font-semibold text-text">{d.doctor.fullName}</span>
                                  {d.doctor.isActive ? null : (
                                    <Badge variant="danger" className="text-[10px]">
                                      {t('staff.salary.inactiveDoctor')}
                                    </Badge>
                                  )}
                                </div>
                                <div className="truncate text-xs text-text-muted">
                                  {d.doctor.specialty ?? ''}
                                  {d.doctor.room ? ` · ${t('common.room')} ${d.doctor.room}` : ''}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular">{d.visits}</TableCell>
                          <TableCell className="hidden text-right tabular md:table-cell">{d.patients}</TableCell>
                          <TableCell className="text-right">
                            <Money value={d.revenue} suffix={null} />
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {d.salaryType === 'PERCENT' ? (
                              <Badge variant="accent">{formatPercent(d.salaryValue)}</Badge>
                            ) : (
                              <Badge variant="secondary">{t('staff.salary.fixed')}</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Money value={d.salary} suffix={null} className="font-semibold text-accent" />
                          </TableCell>
                        </TableRow>
                        {open ? (
                          <TableRow id={detailsId} className="hover:bg-transparent">
                            <TableCell colSpan={7} className="bg-bg-base/40 p-3 sm:p-4">
                              <SalaryBreakdown item={d} />
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow className="hover:bg-transparent">
                    <TableCell />
                    <TableCell className="font-semibold">{t('staff.salary.total')}</TableCell>
                    <TableCell className="text-right font-semibold tabular">{report.totals.visits}</TableCell>
                    <TableCell className="hidden text-right font-semibold tabular md:table-cell">{report.totals.patients}</TableCell>
                    <TableCell className="text-right">
                      <Money value={report.totals.revenue} suffix={null} className="font-semibold" />
                    </TableCell>
                    <TableCell className="hidden md:table-cell" />
                    <TableCell className="text-right">
                      <Money value={report.totals.salary} suffix={null} className="font-heading text-base font-bold text-accent" />
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
