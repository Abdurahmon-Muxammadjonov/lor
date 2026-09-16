'use client';

import * as React from 'react';
import { toast } from 'sonner';
import type { UseQueryResult } from '@tanstack/react-query';
import { Baby, Landmark, Pill, Stethoscope, Syringe, TrendingUp, WalletCards, type LucideIcon } from 'lucide-react';
import type { Role } from '@prisma/client';
import { useLocale } from '@/i18n/client';
import { reportsPrintHref, reportsQuery } from '@/lib/reports/url';
import { can } from '@/lib/permissions';
import { allowedTabs } from '@/lib/reports/access';
import type { GroupBy, ReportKind, ReportRange, ReportTab } from '@/lib/reports/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/page-header';
import { KpiCards } from './kpi-cards';
import { ReportsToolbar } from './reports-toolbar';
import { RevenueTab } from './revenue-tab';
import { DoctorsTab } from './doctors-tab';
import { ServicesTab } from './services-tab';
import { PatientTypesTab } from './patient-types-tab';
import { MedicineTab } from './medicine-tab';
import { ShiftsTab } from './shifts-tab';
import { DebtorsTab } from './debtors-tab';
import {
  downloadExport,
  useDebtorsReport,
  useDoctorOptions,
  useDoctorsReport,
  useMedicineReport,
  usePatientTypesReport,
  useRevenueReport,
  useServicesReport,
  useShiftsReport,
  useSummary,
  type ReportParams,
} from './use-reports';

export interface ReportsPageInitial {
  tab: ReportTab;
  from: string;
  to: string;
  groupBy: GroupBy;
  doctorId: string | null;
  allTime: boolean;
}

export interface ReportsPageProps {
  role: Role;
  initial: ReportsPageInitial;
}

const TAB_ICONS: Record<ReportTab, LucideIcon> = {
  revenue: TrendingUp,
  doctors: Stethoscope,
  services: Syringe,
  'patient-types': Baby,
  medicine: Pill,
  shifts: Landmark,
  debtors: WalletCards,
};

const TAB_KEYS: Record<ReportTab, string> = {
  revenue: 'revenue',
  doctors: 'doctors',
  services: 'services',
  'patient-types': 'patientTypes',
  medicine: 'medicine',
  shifts: 'shifts',
  debtors: 'debtors',
};

const GROUPED_TABS: ReportTab[] = ['revenue', 'patient-types'];
const DOCTOR_TABS: ReportTab[] = ['revenue', 'doctors', 'services', 'patient-types', 'medicine', 'debtors'];

function isTab(v: string, tabs: ReportTab[]): v is ReportTab {
  return (tabs as string[]).includes(v);
}

/** Xato boʻlsa bir marta toast (kalit boʻyicha takrorlanmaydi) */
function useErrorToast(query: Pick<UseQueryResult, 'isError' | 'error'>, id: string, title: string) {
  const message = query.error?.message;
  React.useEffect(() => {
    if (!query.isError) return;
    toast.error(title, { id, description: message });
  }, [query.isError, message, id, title]);
}

/**
 * Hisobotlar sahifasi: yopishqoq filtr paneli (davr, guruhlash, shifokor, Excel/PDF), KPI kartalari va tablar.
 * Holat URL bilan sinxron (history.replaceState) — havolani ulashish / PDF koʻrinishi shu parametrlarni oladi.
 */
export function ReportsPage({ role, initial }: ReportsPageProps) {
  const { t, locale } = useLocale();
  const tabs = React.useMemo(() => allowedTabs(role), [role]);
  const canFull = can(role, 'reports.full');

  const [tab, setTab] = React.useState<ReportTab>(() => (tabs.includes(initial.tab) ? initial.tab : tabs[0] ?? 'revenue'));
  const [range, setRange] = React.useState<ReportRange>({ from: initial.from, to: initial.to });
  const [groupBy, setGroupBy] = React.useState<GroupBy>(initial.groupBy);
  const [doctorId, setDoctorId] = React.useState<string | null>(initial.doctorId);
  const [allTime, setAllTime] = React.useState<boolean>(initial.allTime);
  const [exporting, setExporting] = React.useState(false);

  const params = React.useMemo<ReportParams>(() => ({ from: range.from, to: range.to, doctorId }), [range.from, range.to, doctorId]);

  // URL sinxronizatsiyasi (server komponentni qayta chizmasdan)
  const firstRender = React.useRef(true);
  React.useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const url = `${window.location.pathname}${reportsQuery({ tab, from: range.from, to: range.to, groupBy, doctorId, allTime })}`;
    window.history.replaceState(window.history.state, '', url);
  }, [tab, range.from, range.to, groupBy, doctorId, allTime]);

  const summary = useSummary(params);
  const doctorOptions = useDoctorOptions(DOCTOR_TABS.includes(tab));
  const revenue = useRevenueReport(params, groupBy, tab === 'revenue');
  const doctors = useDoctorsReport(params, tab === 'doctors');
  const services = useServicesReport(params, tab === 'services');
  const patientTypes = usePatientTypesReport(params, groupBy, tab === 'patient-types');
  const medicine = useMedicineReport(params, tab === 'medicine');
  const shifts = useShiftsReport(params, tab === 'shifts');
  const debtors = useDebtorsReport(params, allTime, tab === 'debtors');

  useErrorToast(summary, 'reports-summary-error', t('reports.errors.load'));
  useErrorToast(doctorOptions, 'reports-doctors-options-error', t('reports.errors.doctors'));
  const active = { revenue, doctors, services, 'patient-types': patientTypes, medicine, shifts, debtors }[tab];
  useErrorToast(active, `reports-${tab}-error`, t('reports.errors.load'));

  const state = <T,>(q: UseQueryResult<T>) => ({ data: q.data, loading: q.isPending, dimmed: q.isFetching && q.data !== undefined });

  const onExport = React.useCallback(
    async (which: 'current' | 'full') => {
      const kind: ReportKind = which === 'full' ? 'full' : tab;
      setExporting(true);
      const toastId = toast.loading(t('reports.toolbar.exporting'));
      try {
        const name = await downloadExport({ kind, params, groupBy, allTime, locale });
        toast.success(t('reports.toolbar.exportDone'), { id: toastId, description: name });
      } catch (err) {
        toast.error(t('reports.toolbar.exportError'), { id: toastId, description: err instanceof Error ? err.message : undefined });
      } finally {
        setExporting(false);
      }
    },
    [tab, params, groupBy, allTime, locale, t],
  );

  const printHref = reportsPrintHref({ tab, from: range.from, to: range.to, groupBy, doctorId, allTime });

  return (
    <div className="space-y-4 sm:space-y-5">
      <PageHeader
        title={t('reports.title')}
        description={t('reports.description')}
        breadcrumbs={[{ label: t('common.nav.dashboard'), href: '/dashboard' }, { label: t('reports.title') }]}
      />

      <ReportsToolbar
        range={range}
        onRangeChange={setRange}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        showGroupBy={GROUPED_TABS.includes(tab)}
        doctorId={doctorId}
        onDoctorChange={setDoctorId}
        doctors={doctorOptions.data?.items ?? []}
        doctorsLoading={doctorOptions.isPending && DOCTOR_TABS.includes(tab)}
        showDoctor={DOCTOR_TABS.includes(tab)}
        onExport={(k) => void onExport(k)}
        exporting={exporting}
        canFull={canFull}
        printHref={printHref}
      />

      <KpiCards summary={summary.data} loading={summary.isPending} dimmed={summary.isFetching && summary.data !== undefined} />

      <Tabs value={tab} onValueChange={(v) => isTab(v, tabs) && setTab(v)}>
        <div className="-mx-4 overflow-x-auto px-4 scrollbar-none sm:mx-0 sm:px-0">
          <TabsList aria-label={t('reports.title')} className="h-auto w-max flex-nowrap">
            {tabs.map((key) => {
              const Icon = TAB_ICONS[key];
              return (
                <TabsTrigger key={key} value={key} className="py-2">
                  <Icon aria-hidden="true" />
                  {t(`reports.tabs.${TAB_KEYS[key]}`)}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        <TabsContent value="revenue">{tab === 'revenue' ? <RevenueTab {...state(revenue)} /> : null}</TabsContent>
        <TabsContent value="doctors">{tab === 'doctors' ? <DoctorsTab {...state(doctors)} /> : null}</TabsContent>
        <TabsContent value="services">{tab === 'services' ? <ServicesTab {...state(services)} /> : null}</TabsContent>
        <TabsContent value="patient-types">{tab === 'patient-types' ? <PatientTypesTab {...state(patientTypes)} /> : null}</TabsContent>
        <TabsContent value="medicine">{tab === 'medicine' ? <MedicineTab {...state(medicine)} /> : null}</TabsContent>
        <TabsContent value="shifts">{tab === 'shifts' ? <ShiftsTab {...state(shifts)} /> : null}</TabsContent>
        <TabsContent value="debtors">
          {tab === 'debtors' ? <DebtorsTab {...state(debtors)} allTime={allTime} onAllTimeChange={setAllTime} /> : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
