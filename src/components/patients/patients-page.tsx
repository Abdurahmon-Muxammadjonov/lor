'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Baby, Download, RefreshCw, UserPlus, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale, useT } from '@/i18n/client';
import { plural } from '@/i18n/t';
import { can } from '@/lib/permissions';
import { useHotkey } from '@/hooks/use-hotkey';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable, type DataTableColumn } from '@/components/shared/data-table';
import { Pagination } from '@/components/shared/pagination';
import { GenderAvatar } from '@/components/shared/gender-avatar';
import { Money } from '@/components/shared/money';
import { PhoneLink } from '@/components/shared/phone-link';
import { EmptyState } from '@/components/shared/empty-state';
import type { PatientListItemDTO, PatientListParams } from '@/lib/patients/types';
import {
  countActiveFilters,
  DEFAULT_PAGE_SIZE,
  DEFAULT_SORT,
  listParamsToSearch,
  PATIENT_PAGE_SIZES,
} from '@/lib/patients/list-params';
import { downloadPatientsCsv } from '@/lib/patients/queries';
import { formatAge, formatLastVisit } from '@/lib/patients/format';
import { PatientFilters } from './patient-filters';
import { PatientFormDialog } from './patient-form-dialog';
import { PatientListMobile } from './patient-list-mobile';
import { PatientRowActions } from './patient-row-actions';
import { useEnqueue } from './queue-dialog';
import { useStartVisit, type Viewer } from './start-visit-dialog';
import { patientErrorMessage, usePatientList } from './use-patients';

export interface PatientsPageProps {
  viewer: Viewer;
  childAgeLimit: number;
  initial: PatientListParams;
  /** `?new=1` — yangi bemor dialogini darhol ochish (buyruqlar paneli) */
  openNew?: boolean;
}

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

/**
 * /dashboard/patients — bemorlar reyestri: qidiruv, filtrlar, saralash, jadval (desktop) / kartalar (mobil),
 * sahifalash, yangi bemor, qabulni boshlash, navbatga qoʻshish, CSV eksport (ADMIN).
 */
export function PatientsPage({ viewer, childAgeLimit, initial, openNew = false }: PatientsPageProps) {
  const t = useT();
  const { locale } = useLocale();
  const router = useRouter();

  const canWrite = can(viewer.role, 'patients.write');
  const canVisit = can(viewer.role, 'visits.create');
  const canQueue = can(viewer.role, 'queue.manage');
  const canExport = viewer.role === 'ADMIN' || viewer.role === 'SUPER_ADMIN';

  const [params, setParams] = React.useState<PatientListParams>(initial);
  const [createOpen, setCreateOpen] = React.useState(openNew);
  const [exporting, setExporting] = React.useState(false);

  const list = usePatientList(params);
  const { start: startVisit, dialog: visitDialog } = useStartVisit(viewer);
  const { enqueue, dialog: queueDialog } = useEnqueue();

  // Holat → URL (ulashiladigan havola; sahifa qayta yuklanganda saqlanadi)
  React.useEffect(() => {
    const next = `${window.location.pathname}${listParamsToSearch(params)}`;
    if (`${window.location.pathname}${window.location.search}` !== next)
      window.history.replaceState(null, '', next);
  }, [params]);

  React.useEffect(() => {
    if (list.isError) toast.error(patientErrorMessage(list.error, t));
  }, [list.isError, list.error, t]);

  useHotkey('n', () => setCreateOpen(true), { enabled: canWrite && !createOpen });

  const patch = React.useCallback(
    (p: Partial<PatientListParams>) => setParams((prev) => ({ ...prev, ...p })),
    [],
  );
  const reset = React.useCallback(
    () =>
      setParams({
        q: '',
        page: 1,
        pageSize: DEFAULT_PAGE_SIZE,
        sort: DEFAULT_SORT,
        gender: undefined,
        type: undefined,
        hasDebt: false,
      }),
    [],
  );

  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;
  const filtered = countActiveFilters(params) > 0 || !!params.q;
  const openCard = React.useCallback((id: string) => router.push(`/dashboard/patients/${id}`), [router]);

  const exportCsv = async () => {
    setExporting(true);
    const id = toast.loading(t('patients.toast.exportStarted'));
    try {
      await downloadPatientsCsv({
        q: params.q,
        sort: params.sort,
        gender: params.gender,
        type: params.type,
        hasDebt: params.hasDebt,
      });
      toast.success(t('patients.toast.exportDone'), { id });
    } catch (err) {
      toast.error(patientErrorMessage(err, t), { id });
    } finally {
      setExporting(false);
    }
  };

  const columns = React.useMemo<DataTableColumn<PatientListItemDTO>[]>(
    () => [
      {
        key: 'card',
        header: t('patients.table.card'),
        width: 118,
        cell: (p) => <span className="tabular font-mono text-xs text-text-muted">{p.cardNumber}</span>,
      },
      {
        key: 'patient',
        header: t('patients.table.patient'),
        cell: (p) => (
          <div className="flex min-w-0 items-center gap-3">
            <GenderAvatar gender={p.gender} name={p.fullName} size="sm" />
            <div className="min-w-0">
              <div className="truncate font-medium text-text">{p.fullName}</div>
              <div className="text-xs text-text-muted" onClick={stop} onKeyDown={stop}>
                <PhoneLink phone={p.phone} className="tabular hover:text-accent" />
              </div>
            </div>
          </div>
        ),
      },
      {
        key: 'age',
        header: t('patients.table.age'),
        width: 170,
        cell: (p) => (
          <span className="tabular inline-flex items-center gap-2 whitespace-nowrap">
            {formatAge(p.birthDate, t)}
            {p.patientType === 'CHILD' ? (
              <Badge variant="warning">
                <Baby aria-hidden="true" />
                {t('patients.child')}
              </Badge>
            ) : null}
          </span>
        ),
      },
      {
        key: 'lastVisit',
        header: t('patients.table.lastVisit'),
        width: 190,
        cell: (p) => (
          <div className="tabular">
            <div className={cn(!p.lastVisitAt && 'text-text-muted')}>
              {formatLastVisit(p.lastVisitAt, locale, t)}
            </div>
            {p.visitsCount > 0 ? (
              <div className="text-xs text-text-muted">
                {t('patients.stats.visits')}: {p.visitsCount}
              </div>
            ) : null}
          </div>
        ),
      },
      {
        key: 'debt',
        header: t('patients.table.debt'),
        align: 'right',
        width: 150,
        cell: (p) =>
          p.debt > 0 ? (
            <Money value={p.debt} className="font-semibold text-danger" />
          ) : (
            <span className="text-xs text-text-muted">{t('patients.noDebt')}</span>
          ),
      },
      {
        key: 'actions',
        header: <span className="sr-only">{t('common.actions')}</span>,
        align: 'right',
        width: 120,
        cell: (p) => (
          <PatientRowActions
            patient={{ id: p.id, fullName: p.fullName }}
            canVisit={canVisit}
            canQueue={canQueue}
            onVisit={startVisit}
            onQueue={enqueue}
          />
        ),
      },
    ],
    [t, locale, canVisit, canQueue, startVisit, enqueue],
  );

  const emptyTitle = filtered ? t('patients.empty.title') : t('patients.empty.first');
  const emptyDescription = filtered ? t('patients.empty.description') : t('patients.empty.firstDescription');
  const emptyAction = filtered ? (
    <Button type="button" variant="outline" size="sm" onClick={reset}>
      {t('patients.filters.reset')}
    </Button>
  ) : canWrite ? (
    <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
      <UserPlus aria-hidden="true" />
      {t('patients.new')}
    </Button>
  ) : undefined;

  const pagination = (
    <Pagination
      page={params.page}
      pageSize={params.pageSize}
      total={total}
      pageSizes={[...PATIENT_PAGE_SIZES]}
      onChange={(page) => patch({ page })}
      onPageSizeChange={(pageSize) => patch({ pageSize, page: 1 })}
    />
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('patients.title')}
        description={
          list.data ? (
            <span className="tabular">
              {plural(locale, total, {
                one: t('patients.countForms.one', { n: total }),
                few: t('patients.countForms.few', { n: total }),
                many: t('patients.countForms.many', { n: total }),
              })}
            </span>
          ) : (
            t('patients.description')
          )
        }
        breadcrumbs={[
          { label: t('common.nav.dashboard'), href: '/dashboard' },
          { label: t('patients.title') },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canExport ? (
              <Button type="button" variant="outline" onClick={exportCsv} loading={exporting}>
                <Download aria-hidden="true" />
                <span className="hidden sm:inline">{t('patients.actions.export')}</span>
                <span className="sm:hidden">CSV</span>
              </Button>
            ) : null}
            {canWrite ? (
              <Button
                type="button"
                variant="gradient"
                onClick={() => setCreateOpen(true)}
                className="shadow-glow"
              >
                <UserPlus aria-hidden="true" />
                {t('patients.new')}
              </Button>
            ) : null}
          </div>
        }
      />

      <PatientFilters params={params} onChange={patch} onReset={reset} searching={list.isFetching} />

      {list.isError && !list.data ? (
        <div className="rounded-xl border border-line bg-surface">
          <EmptyState
            icon={Users}
            title={t('patients.errors.loadFailed')}
            description={patientErrorMessage(list.error, t)}
            action={
              <Button type="button" variant="outline" size="sm" onClick={() => void list.refetch()}>
                <RefreshCw aria-hidden="true" />
                {t('common.retry')}
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="hidden md:block">
            <DataTable
              columns={columns}
              data={items}
              rowKey={(p) => p.id}
              loading={list.isLoading}
              skeletonRows={Math.min(params.pageSize, 8)}
              caption={t('patients.table.caption')}
              emptyIcon={Users}
              emptyText={emptyTitle}
              emptyDescription={emptyDescription}
              emptyAction={emptyAction}
              onRowClick={(p) => openCard(p.id)}
              rowClassName={() =>
                list.isFetching && !list.isLoading ? 'opacity-70 transition-opacity' : undefined
              }
              footer={total > 0 ? pagination : undefined}
            />
          </div>
          <div className="md:hidden">
            <PatientListMobile
              items={items}
              loading={list.isLoading || (list.isFetching && items.length === 0)}
              emptyTitle={emptyTitle}
              emptyDescription={emptyDescription}
              emptyAction={emptyAction}
              canVisit={canVisit}
              canQueue={canQueue}
              onVisit={startVisit}
              onQueue={enqueue}
            />
            {total > 0 ? <div className="mt-4">{pagination}</div> : null}
          </div>
        </>
      )}

      <PatientFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        childAgeLimit={childAgeLimit}
        canStartVisit={canVisit}
        onStartVisit={startVisit}
      />
      {visitDialog}
      {queueDialog}
    </div>
  );
}
