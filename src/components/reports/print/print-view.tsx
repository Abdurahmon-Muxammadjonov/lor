import * as React from 'react';
import type { Locale } from '@/i18n/config';
import type { TFunction } from '@/i18n/t';
import { fmtDate, fmtDateTime } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import { formatPhone } from '@/lib/utils';
import { PAY_METHODS } from '@/lib/reports/types';
import { formatCount, formatPercent, formatQty } from '@/lib/reports/format';
import { formatPeriodLabel, formatRangeLabel } from '@/lib/reports/period';
import type {
  DebtorsReportDTO,
  DoctorsReportDTO,
  GroupBy,
  MedicineReportDTO,
  PatientTypesReportDTO,
  ReportRange,
  ReportTab,
  RevenueReportDTO,
  ServicesReportDTO,
  ShiftsReportDTO,
  SummaryDTO,
} from '@/lib/reports/types';
import { PrintTable, type PrintColumn } from './print-table';

export type PrintReport =
  | { tab: 'revenue'; report: RevenueReportDTO }
  | { tab: 'doctors'; report: DoctorsReportDTO }
  | { tab: 'services'; report: ServicesReportDTO }
  | { tab: 'patient-types'; report: PatientTypesReportDTO }
  | { tab: 'medicine'; report: MedicineReportDTO }
  | { tab: 'shifts'; report: ShiftsReportDTO }
  | { tab: 'debtors'; report: DebtorsReportDTO };

export interface PrintMeta {
  clinicName: string;
  clinicPhone: string;
  range: ReportRange;
  groupBy: GroupBy;
  doctorName: string | null;
  generatedAt: Date;
  locale: Locale;
}

export interface PrintViewProps {
  data: PrintReport;
  summary: SummaryDTO;
  meta: PrintMeta;
  t: TFunction;
}

const TAB_KEYS: Record<ReportTab, string> = {
  revenue: 'revenue',
  doctors: 'doctors',
  services: 'services',
  'patient-types': 'patientTypes',
  medicine: 'medicine',
  shifts: 'shifts',
  debtors: 'debtors',
};

function money(v: number, t: TFunction): string {
  return formatMoney(v, { suffix: t('common.currency') });
}

function plain(v: number): string {
  return formatMoney(v, { suffix: '' });
}

function pick(obj: { name: string; nameRu: string }, locale: Locale): string {
  return locale === 'ru' && obj.nameRu ? obj.nameRu : obj.name;
}

/** Chop etish uchun hisobot (server-safe): sarlavha, KPI qatori, tanlangan boʻlim jadvali */
export function PrintView({ data, summary, meta, t }: PrintViewProps) {
  const { locale } = meta;
  const title = t(`reports.tabs.${TAB_KEYS[data.tab]}`);
  return (
    <article className="print-root mx-auto max-w-[210mm] rounded-xl bg-white p-6 text-black shadow-card sm:p-8">
      <header className="mb-5 border-b-2 border-neutral-800 pb-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h1 className="font-heading text-xl font-bold tracking-tight text-neutral-900">
            {meta.clinicName} — {title}
          </h1>
          <span className="text-xs text-neutral-600">{t('reports.print.title')}</span>
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-0.5 text-[11px] text-neutral-700 sm:grid-cols-4">
          <div>
            <dt className="inline font-semibold">{t('reports.print.period')}: </dt>
            <dd className="inline tabular">{formatRangeLabel(meta.range)}</dd>
          </div>
          <div>
            <dt className="inline font-semibold">{t('reports.print.doctor')}: </dt>
            <dd className="inline">{meta.doctorName ?? t('reports.print.allDoctors')}</dd>
          </div>
          {data.tab === 'revenue' || data.tab === 'patient-types' ? (
            <div>
              <dt className="inline font-semibold">{t('reports.print.groupBy')}: </dt>
              <dd className="inline">{t(`reports.toolbar.${meta.groupBy}`)}</dd>
            </div>
          ) : null}
          <div>
            <dt className="inline font-semibold">{t('reports.print.generated')}: </dt>
            <dd className="inline tabular">{fmtDateTime(meta.generatedAt, locale)}</dd>
          </div>
        </dl>
      </header>

      <section className="mb-5" aria-label={t('reports.print.summary')}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {(
            [
              [t('reports.kpi.revenue'), money(summary.revenue, t)],
              [t('reports.kpi.visits'), formatCount(summary.visits)],
              [t('reports.kpi.patients'), formatCount(summary.patients)],
              [t('reports.kpi.avgCheck'), money(summary.avgCheck, t)],
              [t('reports.kpi.debt'), money(summary.debt, t)],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded-md border border-neutral-300 px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-600">{label}</div>
              <div className="mt-0.5 font-heading text-sm font-bold text-neutral-900">{value}</div>
            </div>
          ))}
        </div>
      </section>

      <section aria-label={title}>
        <h2 className="mb-2 font-heading text-sm font-semibold text-neutral-900">{title}</h2>
        {renderSection(data, meta, t)}
      </section>

      <footer className="mt-6 flex items-center justify-between border-t border-neutral-300 pt-2 text-[10px] text-neutral-500">
        <span>
          {meta.clinicName}
          {meta.clinicPhone ? ` · ${formatPhone(meta.clinicPhone) || meta.clinicPhone}` : ''}
        </span>
        <span>{t('common.appName')}</span>
      </footer>
    </article>
  );
}

function renderSection(data: PrintReport, meta: PrintMeta, t: TFunction): React.ReactNode {
  const { locale } = meta;
  const empty = t('reports.print.noData');
  switch (data.tab) {
    case 'revenue': {
      const r = data.report;
      const columns: PrintColumn[] = [
        { key: 'period', header: t('reports.columns.period') },
        { key: 'revenue', header: t('reports.columns.revenue'), align: 'right' },
        { key: 'visits', header: t('reports.columns.visits'), align: 'right' },
        { key: 'avg', header: t('reports.columns.avgCheck'), align: 'right' },
        ...PAY_METHODS.map((m): PrintColumn => ({ key: m, header: t(`common.payMethod.${m}`), align: 'right' })),
      ];
      const rows = r.periods.filter((p) => p.revenue !== 0 || p.visits > 0);
      return (
        <PrintTable
          columns={columns}
          rowKeys={rows.map((p) => p.period)}
          rows={rows.map((p) => [
            formatPeriodLabel(p, r.groupBy, locale, { long: true }),
            plain(p.revenue),
            formatCount(p.visits),
            plain(p.avgCheck),
            ...PAY_METHODS.map((m) => plain(p.byMethod.find((b) => b.method === m)?.amount ?? 0)),
          ])}
          totals={[
            t('common.total'),
            money(r.totals.revenue, t),
            formatCount(r.totals.visits),
            plain(r.totals.avgCheck),
            ...PAY_METHODS.map((m) => plain(r.totals.byMethod.find((b) => b.method === m)?.amount ?? 0)),
          ]}
          emptyText={empty}
        />
      );
    }
    case 'doctors': {
      const r = data.report;
      return (
        <PrintTable
          columns={[
            { key: 'doctor', header: t('reports.doctors.doctor') },
            { key: 'patients', header: t('reports.doctors.patients'), align: 'right' },
            { key: 'visits', header: t('reports.doctors.visits'), align: 'right' },
            { key: 'revenue', header: t('reports.doctors.revenue'), align: 'right' },
            { key: 'avg', header: t('reports.doctors.avgCheck'), align: 'right' },
            { key: 'share', header: t('reports.doctors.share'), align: 'right' },
            { key: 'salary', header: t('reports.doctors.salary'), align: 'right' },
          ]}
          rowKeys={r.rows.map((d) => d.doctorId)}
          rows={r.rows.map((d) => [
            <span key="n">
              {d.fullName}
              {d.specialty ? <span className="text-neutral-500"> · {d.specialty}</span> : null}
            </span>,
            formatCount(d.patients),
            formatCount(d.visits),
            plain(d.revenue),
            plain(d.avgCheck),
            formatPercent(d.share),
            <span key="s">
              {plain(d.salary)}
              <span className="text-neutral-500"> ({d.salaryType === 'PERCENT' ? `${d.salaryValue} %` : t('reports.doctors.salaryFixed')})</span>
            </span>,
          ])}
          totals={[t('common.total'), formatCount(r.totals.patients), formatCount(r.totals.visits), money(r.totals.revenue, t), plain(r.totals.avgCheck), r.rows.length ? formatPercent(100) : '', money(r.totals.salary, t)]}
          emptyText={empty}
        />
      );
    }
    case 'services': {
      const r = data.report;
      return (
        <PrintTable
          columns={[
            { key: 'code', header: t('common.code'), width: '56px' },
            { key: 'service', header: t('reports.services.service') },
            { key: 'count', header: t('reports.services.count'), align: 'right' },
            { key: 'revenue', header: t('reports.services.revenue'), align: 'right' },
            { key: 'share', header: t('reports.services.share'), align: 'right' },
            { key: 'adult', header: t('reports.services.adult'), align: 'right' },
            { key: 'child', header: t('reports.services.child'), align: 'right' },
            { key: 'med', header: t('reports.services.withMed'), align: 'right' },
          ]}
          rowKeys={r.rows.map((s) => `${s.serviceId}|${s.name}`)}
          rows={r.rows.map((s) => [s.code, pick(s, locale), `${formatQty(s.count)} ${s.unit}`, plain(s.revenue), formatPercent(s.share), formatQty(s.adultCount), formatQty(s.childCount), formatQty(s.medCount)])}
          totals={[t('common.total'), '', formatQty(r.totals.count), money(r.totals.revenue, t), r.rows.length ? formatPercent(100) : '', formatQty(r.totals.adultCount), formatQty(r.totals.childCount), formatQty(r.totals.medCount)]}
          emptyText={empty}
        />
      );
    }
    case 'patient-types': {
      const r = data.report;
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                [t('reports.patientTypes.adult'), r.adult],
                [t('reports.patientTypes.child'), r.child],
              ] as const
            ).map(([label, s]) => (
              <div key={label} className="rounded-md border border-neutral-300 px-3 py-2 text-[11px]">
                <div className="font-semibold text-neutral-800">
                  {label} — {formatPercent(s.share)}
                </div>
                <div className="text-neutral-600">
                  {t('reports.patientTypes.visits')}: {formatCount(s.visits)} · {t('reports.patientTypes.lines')}: {formatCount(s.lines)} · {t('reports.patientTypes.revenue')}: {money(s.revenue, t)}
                </div>
              </div>
            ))}
          </div>
          <PrintTable
            columns={[
              { key: 'period', header: t('reports.columns.period') },
              { key: 'av', header: t('reports.patientTypes.adultVisits'), align: 'right' },
              { key: 'ar', header: t('reports.patientTypes.adultRevenue'), align: 'right' },
              { key: 'cv', header: t('reports.patientTypes.childVisits'), align: 'right' },
              { key: 'cr', header: t('reports.patientTypes.childRevenue'), align: 'right' },
            ]}
            rowKeys={r.trend.map((p) => p.period)}
            rows={r.trend
              .filter((p) => p.adult.lines > 0 || p.child.lines > 0)
              .map((p) => [formatPeriodLabel(p, r.groupBy, locale, { long: true }), formatCount(p.adult.visits), plain(p.adult.revenue), formatCount(p.child.visits), plain(p.child.revenue)])}
            totals={[t('common.total'), formatCount(r.adult.visits), money(r.adult.revenue, t), formatCount(r.child.visits), money(r.child.revenue, t)]}
            emptyText={empty}
          />
        </div>
      );
    }
    case 'medicine': {
      const r = data.report;
      return (
        <PrintTable
          columns={[
            { key: 'code', header: t('common.code'), width: '56px' },
            { key: 'service', header: t('reports.medicine.service') },
            { key: 'med', header: `${t('reports.medicine.withMed')}: ${t('reports.medicine.qty')}`, align: 'right' },
            { key: 'medRev', header: `${t('reports.medicine.withMed')}: ${t('reports.medicine.revenue')}`, align: 'right' },
            { key: 'nomed', header: `${t('reports.medicine.withoutMed')}: ${t('reports.medicine.qty')}`, align: 'right' },
            { key: 'nomedRev', header: `${t('reports.medicine.withoutMed')}: ${t('reports.medicine.revenue')}`, align: 'right' },
            { key: 'share', header: t('reports.medicine.medShare'), align: 'right' },
          ]}
          rowKeys={r.rows.map((s) => `${s.serviceId}|${s.name}`)}
          rows={r.rows.map((s) => [s.code, pick(s, locale), `${formatQty(s.med.count)} ${s.unit}`, plain(s.med.revenue), `${formatQty(s.noMed.count)} ${s.unit}`, plain(s.noMed.revenue), formatPercent(s.medShare)])}
          totals={[t('common.total'), '', formatQty(r.totals.med.count), money(r.totals.med.revenue, t), formatQty(r.totals.noMed.count), money(r.totals.noMed.revenue, t), formatPercent(r.totals.medShare)]}
          emptyText={empty}
        />
      );
    }
    case 'shifts': {
      const r = data.report;
      return (
        <PrintTable
          columns={[
            { key: 'cashier', header: t('reports.shifts.cashier') },
            { key: 'opened', header: t('reports.shifts.opened') },
            { key: 'closed', header: t('reports.shifts.closed') },
            ...PAY_METHODS.map((m): PrintColumn => ({ key: m, header: t(`common.payMethod.${m}`), align: 'right' })),
            { key: 'total', header: t('reports.shifts.total'), align: 'right' },
            { key: 'expected', header: t('reports.shifts.expectedCash'), align: 'right' },
            { key: 'closing', header: t('reports.shifts.closingCash'), align: 'right' },
            { key: 'diff', header: t('reports.shifts.difference'), align: 'right' },
          ]}
          rowKeys={r.rows.map((s) => s.id)}
          rows={r.rows.map((s) => [
            <span key="c">
              {s.cashier.fullName}
              <span className="text-neutral-500"> · {s.status === 'OPEN' ? t('reports.shifts.open') : t('reports.shifts.closedStatus')}</span>
            </span>,
            fmtDateTime(s.openedAt, locale),
            s.closedAt ? fmtDateTime(s.closedAt, locale) : '—',
            ...PAY_METHODS.map((m) => plain(s.totals[m])),
            plain(s.total),
            plain(s.expectedCash),
            s.closingCash === null ? '—' : plain(s.closingCash),
            s.difference === null ? '—' : <span key="d" className={s.difference < 0 ? 'font-semibold text-red-700' : s.difference > 0 ? 'font-semibold text-amber-700' : ''}>{formatMoney(s.difference, { suffix: '', signed: true })}</span>,
          ])}
          totals={[t('common.total'), '', '', ...PAY_METHODS.map((m) => plain(r.totals.totals[m])), money(r.totals.total, t), '', '', formatMoney(r.totals.difference, { suffix: '', signed: true })]}
          emptyText={empty}
        />
      );
    }
    case 'debtors': {
      const r = data.report;
      return (
        <PrintTable
          columns={[
            { key: 'card', header: t('common.cardNumber'), width: '80px' },
            { key: 'patient', header: t('reports.debtors.patient') },
            { key: 'phone', header: t('reports.debtors.phone') },
            { key: 'visits', header: t('reports.debtors.visits'), align: 'right' },
            { key: 'debt', header: t('reports.debtors.debt'), align: 'right' },
            { key: 'last', header: t('reports.debtors.lastVisit'), align: 'right' },
          ]}
          rowKeys={r.rows.map((d) => d.patient.id)}
          rows={r.rows.map((d) => [d.patient.cardNumber, d.patient.fullName, formatPhone(d.patient.phone) || d.patient.phone, formatCount(d.visits), plain(d.totalDebt), fmtDate(d.lastVisit, locale)])}
          totals={[t('common.total'), t('reports.debtors.count', { n: r.count }), '', formatCount(r.rows.reduce((s, d) => s + d.visits, 0)), money(r.total, t), '']}
          emptyText={empty}
        />
      );
    }
  }
}
