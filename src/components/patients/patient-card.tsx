'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, CalendarClock, ClipboardList, FileText, RefreshCw, UserX, Wallet } from 'lucide-react';
import { useLocale, useT } from '@/i18n/client';
import { can } from '@/lib/permissions';
import { fmtSmartDate } from '@/lib/date';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/shared/empty-state';
import { StatCard } from '@/components/shared/stat-card';
import { Money } from '@/components/shared/money';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { PatientHeader } from './patient-header';
import { PatientFormDialog } from './patient-form-dialog';
import { PatientVisitsTab } from './patient-visits-tab';
import { PatientFinanceTab } from './patient-finance-tab';
import { PatientAppointmentsTab } from './patient-appointments-tab';
import { PatientDocumentsTab } from './patient-documents-tab';
import { PatientCardSkeleton } from './skeletons';
import { useEnqueue } from './queue-dialog';
import { useStartVisit, type Viewer } from './start-visit-dialog';
import { isNotFoundError, patientErrorMessage, useDeletePatient, usePatient } from './use-patients';

export type PatientCardTab = 'visits' | 'finance' | 'appointments' | 'documents';

export interface PatientCardProps {
  id: string;
  viewer: Viewer;
  childAgeLimit: number;
  initialTab?: PatientCardTab;
}

const TAB_VALUES: PatientCardTab[] = ['visits', 'finance', 'appointments', 'documents'];

function isTab(v: string): v is PatientCardTab {
  return (TAB_VALUES as string[]).includes(v);
}

/**
 * /dashboard/patients/[id] — bemor kartasi: sarlavha, amallar, statistika, tablar
 * (tashriflar, moliya, yozilishlar, hujjatlar).
 */
export function PatientCard({ id, viewer, childAgeLimit, initialTab = 'visits' }: PatientCardProps) {
  const t = useT();
  const { locale } = useLocale();
  const router = useRouter();
  const q = usePatient(id);

  const canEdit = can(viewer.role, 'patients.write');
  const canVisit = can(viewer.role, 'visits.create');
  const canQueue = can(viewer.role, 'queue.manage');
  const canBook = can(viewer.role, 'appointments.write');
  const canDelete = can(viewer.role, 'patients.delete');
  const canPay = can(viewer.role, 'payments.write');

  const [tab, setTab] = React.useState<PatientCardTab>(initialTab);
  const [editOpen, setEditOpen] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const { start: startVisit, pending: visitPending, dialog: visitDialog } = useStartVisit(viewer);
  const { enqueue, dialog: queueDialog } = useEnqueue();
  const del = useDeletePatient();

  // Tab → URL (?tab=), chuqur havolalar uchun
  React.useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (tab === 'visits') sp.delete('tab');
    else sp.set('tab', tab);
    const s = sp.toString();
    const next = `${window.location.pathname}${s ? `?${s}` : ''}`;
    if (`${window.location.pathname}${window.location.search}` !== next)
      window.history.replaceState(null, '', next);
  }, [tab]);

  React.useEffect(() => {
    if (q.isError && !isNotFoundError(q.error)) toast.error(patientErrorMessage(q.error, t));
  }, [q.isError, q.error, t]);

  if (q.isLoading) return <PatientCardSkeleton />;

  if (q.isError || !q.data) {
    const notFound = isNotFoundError(q.error);
    return (
      <div className="rounded-2xl border border-line bg-surface">
        <EmptyState
          icon={UserX}
          title={notFound ? t('patients.card.notFound') : t('patients.errors.loadFailed')}
          description={notFound ? t('patients.card.notFoundDescription') : patientErrorMessage(q.error, t)}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/patients">
                  <ArrowLeft aria-hidden="true" />
                  {t('patients.card.backToList')}
                </Link>
              </Button>
              {!notFound ? (
                <Button type="button" size="sm" onClick={() => void q.refetch()}>
                  <RefreshCw aria-hidden="true" />
                  {t('common.retry')}
                </Button>
              ) : null}
            </div>
          }
        />
      </div>
    );
  }

  const p = q.data;
  const patientRef = { id: p.id, fullName: p.fullName };
  const debt = p.stats.debt;

  const confirmDelete = () => {
    del.mutate(p.id, {
      onSuccess: () => {
        toast.success(t('patients.toast.deleted'));
        setDeleteOpen(false);
        router.replace('/dashboard/patients');
      },
      onError: (err) => toast.error(patientErrorMessage(err, t)),
    });
  };

  return (
    <div className="space-y-6">
      <PatientHeader
        patient={p}
        canEdit={canEdit}
        canVisit={canVisit}
        canQueue={canQueue}
        canBook={canBook}
        canDelete={canDelete}
        onEdit={() => setEditOpen(true)}
        onStartVisit={() => startVisit(patientRef)}
        onEnqueue={() => enqueue(patientRef)}
        onDelete={() => setDeleteOpen(true)}
        visitPending={visitPending}
      />

      <section aria-label={t('patients.stats.visits')} className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title={t('patients.stats.visits')}
          value={<span className="tabular">{p.stats.visits}</span>}
          icon={ClipboardList}
          accent="cyan"
          hint={
            p.stats.openVisits > 0
              ? t('patients.stats.openVisits', { n: p.stats.openVisits })
              : p.stats.lastVisitAt
                ? `${t('patients.stats.lastVisit')}: ${fmtSmartDate(p.stats.lastVisitAt, locale)}`
                : t('patients.noVisits')
          }
          onClick={() => setTab('visits')}
        />
        <StatCard
          title={t('patients.stats.paid')}
          value={<Money value={p.stats.totalPaid} />}
          icon={Wallet}
          accent="mint"
          hint={
            <span>
              {t('patients.finance.totalNet')}: <Money value={p.stats.totalNet} />
            </span>
          }
          onClick={() => setTab('finance')}
        />
        <StatCard
          title={debt < 0 ? t('patients.stats.overpaid') : t('patients.stats.debt')}
          value={
            debt === 0 ? (
              <span className="text-[#00FFB2]">{t('patients.noDebt')}</span>
            ) : (
              <Money value={Math.abs(debt)} />
            )
          }
          icon={Wallet}
          accent={debt > 0 ? 'danger' : debt < 0 ? 'violet' : 'mint'}
          hint={debt > 0 ? t('patients.finance.debts') : undefined}
          onClick={() => setTab('finance')}
        />
      </section>

      <Tabs value={tab} onValueChange={(v) => isTab(v) && setTab(v)}>
        <TabsList
          aria-label={t('patients.card.tabsLabel')}
          className="h-auto w-full flex-wrap justify-start sm:w-auto"
        >
          <TabsTrigger value="visits">
            <ClipboardList aria-hidden="true" />
            {t('patients.tabs.visits')}
            <span className="tabular rounded-full bg-surface px-1.5 text-[11px] text-text-muted">
              {p.stats.visits}
            </span>
          </TabsTrigger>
          <TabsTrigger value="finance">
            <Wallet aria-hidden="true" />
            {t('patients.tabs.finance')}
            {debt > 0 ? <span aria-hidden="true" className="size-1.5 rounded-full bg-danger" /> : null}
          </TabsTrigger>
          <TabsTrigger value="appointments">
            <CalendarClock aria-hidden="true" />
            {t('patients.tabs.appointments')}
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileText aria-hidden="true" />
            {t('patients.tabs.documents')}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="visits">
          <PatientVisitsTab
            patientId={p.id}
            enabled={tab === 'visits'}
            canVisit={canVisit}
            onStartVisit={() => startVisit(patientRef)}
          />
        </TabsContent>
        <TabsContent value="finance">
          <PatientFinanceTab patientId={p.id} enabled={tab === 'finance'} canPay={canPay} />
        </TabsContent>
        <TabsContent value="appointments">
          <PatientAppointmentsTab patientId={p.id} enabled={tab === 'appointments'} canBook={canBook} />
        </TabsContent>
        <TabsContent value="documents">
          <PatientDocumentsTab patientId={p.id} enabled={tab === 'documents'} />
        </TabsContent>
      </Tabs>

      <PatientFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        patient={p}
        childAgeLimit={childAgeLimit}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        destructive
        title={t('patients.delete.title')}
        description={t('patients.delete.description', { name: p.fullName })}
        confirmText={t('common.yesDelete')}
        loading={del.isPending}
        onConfirm={confirmDelete}
      />
      {visitDialog}
      {queueDialog}
    </div>
  );
}
