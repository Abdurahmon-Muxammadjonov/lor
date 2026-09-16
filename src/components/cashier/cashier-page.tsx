'use client';

import * as React from 'react';
import { toast } from 'sonner';
import type { Role } from '@prisma/client';
import { History, ReceiptText, RefreshCw, Wallet } from 'lucide-react';
import { useT } from '@/i18n/client';
import { can } from '@/lib/permissions';
import { todayKey } from '@/lib/date';
import { useHotkey } from '@/hooks/use-hotkey';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/page-header';
import type { UnpaidScope } from '@/lib/cashier/schemas';
import type {
  PaymentListItemDTO,
  PaymentResultDTO,
  ReceiptViewData,
  RefundResultDTO,
} from '@/lib/cashier/types';
import { CloseShiftDialog } from './close-shift-dialog';
import { OpenShiftDialog } from './open-shift-dialog';
import { PaymentDialog } from './payment-dialog';
import { PaymentsTable } from './payments-table';
import { ReceiptDialog } from './receipt-dialog';
import { RefundDialog } from './refund-dialog';
import { ShiftCard } from './shift-card';
import { ShiftsHistory } from './shifts-history';
import { UnpaidList } from './unpaid-list';
import {
  cashierErrorMessage,
  fetchPaymentReceipt,
  useCurrentShift,
  usePayments,
  useShifts,
  useUnpaidVisits,
} from './use-cashier';

export type CashierTab = 'unpaid' | 'payments' | 'shifts';

export interface CashierPageProps {
  viewer: { id: string; role: Role; fullName: string };
  /** `?visit=` / `?visitId=` — toʻlov oynasini darhol ochish (qabul sahifasi / bemor kartasidan) */
  initialVisitId?: string | null;
  initialTab?: CashierTab;
}

const PAGE_SIZE = 20;

/**
 * /dashboard/cashier — smena kartasi, "Toʻlanmagan" / "Bugungi toʻlovlar" / "Smenalar" boʻlimlari,
 * toʻlov / qaytarish / chek / smena oynalari. F2 — birinchi toʻlanmagan qabulni toʻlash.
 */
export function CashierPage({ viewer, initialVisitId = null, initialTab = 'unpaid' }: CashierPageProps) {
  const t = useT();
  const canPay = can(viewer.role, 'payments.write');
  const canRefund = can(viewer.role, 'payments.refund');

  const [tab, setTab] = React.useState<CashierTab>(initialTab);
  const [scope, setScope] = React.useState<UnpaidScope>('today');
  const [q, setQ] = React.useState('');
  const [paymentsDate, setPaymentsDate] = React.useState(() => todayKey());
  const [paymentsPage, setPaymentsPage] = React.useState(1);
  const [shiftsPage, setShiftsPage] = React.useState(1);

  const [payVisitId, setPayVisitId] = React.useState<string | null>(null);
  const [payOpen, setPayOpen] = React.useState(false);
  const [openShiftOpen, setOpenShiftOpen] = React.useState(false);
  const [closeShiftOpen, setCloseShiftOpen] = React.useState(false);
  const [receipt, setReceipt] = React.useState<ReceiptViewData | null>(null);
  const [receiptOpen, setReceiptOpen] = React.useState(false);
  const [receiptAuto, setReceiptAuto] = React.useState(false);
  const [refundTarget, setRefundTarget] = React.useState<PaymentListItemDTO | null>(null);
  const [refundOpen, setRefundOpen] = React.useState(false);
  const [reprintingId, setReprintingId] = React.useState<string | null>(null);

  const current = useCurrentShift();
  const unpaid = useUnpaidVisits(scope, q);
  const payments = usePayments(
    { date: paymentsDate, page: paymentsPage, pageSize: PAGE_SIZE },
    tab === 'payments',
  );
  const shifts = useShifts(shiftsPage, PAGE_SIZE, tab === 'shifts');

  const shiftReady = current.data?.canOperate ?? false;
  const anyDialogOpen = payOpen || openShiftOpen || closeShiftOpen || receiptOpen || refundOpen;

  React.useEffect(() => {
    if (current.isError) toast.error(cashierErrorMessage(current.error, t));
  }, [current.isError, current.error, t]);
  React.useEffect(() => {
    if (unpaid.isError) toast.error(cashierErrorMessage(unpaid.error, t));
  }, [unpaid.isError, unpaid.error, t]);
  React.useEffect(() => {
    if (payments.isError) toast.error(cashierErrorMessage(payments.error, t));
  }, [payments.isError, payments.error, t]);
  React.useEffect(() => {
    if (shifts.isError) toast.error(cashierErrorMessage(shifts.error, t));
  }, [shifts.isError, shifts.error, t]);

  const openPay = React.useCallback(
    (visitId: string) => {
      if (!canPay) return;
      setPayVisitId(visitId);
      setPayOpen(true);
    },
    [canPay],
  );

  // Boshqa sahifadan kelgan ?visit= — bir marta ochamiz va URL ni tozalaymiz
  const consumedInitial = React.useRef(false);
  React.useEffect(() => {
    if (consumedInitial.current || !initialVisitId) return;
    consumedInitial.current = true;
    if (canPay) openPay(initialVisitId);
    const url = new URL(window.location.href);
    url.searchParams.delete('visit');
    url.searchParams.delete('visitId');
    window.history.replaceState(null, '', `${url.pathname}${url.search}`);
  }, [initialVisitId, canPay, openPay]);

  useHotkey(
    'f2',
    () => {
      if (!shiftReady) {
        setOpenShiftOpen(true);
        return;
      }
      const first = unpaid.data?.items[0];
      if (first) openPay(first.id);
      else toast.info(scope === 'today' ? t('cashier.unpaid.emptyToday') : t('cashier.unpaid.empty'));
    },
    { enabled: canPay && !anyDialogOpen },
  );

  const showReceipt = (r: ReceiptViewData, auto: boolean) => {
    setReceipt(r);
    setReceiptAuto(auto);
    setReceiptOpen(true);
  };

  const onPaid = (result: PaymentResultDTO) => showReceipt(result.receipt, true);
  const onRefunded = (result: RefundResultDTO) => showReceipt(result.receipt, true);

  const onReprint = React.useCallback(
    async (p: PaymentListItemDTO) => {
      setReprintingId(p.id);
      try {
        const r = await fetchPaymentReceipt(p.id);
        showReceipt(r, false);
      } catch (err) {
        toast.error(cashierErrorMessage(err, t));
      } finally {
        setReprintingId(null);
      }
    },
    [t],
  );

  const onRefund = React.useCallback((p: PaymentListItemDTO) => {
    setRefundTarget(p);
    setRefundOpen(true);
  }, []);

  const refreshAll = () => {
    void current.refetch();
    void unpaid.refetch();
    if (tab === 'payments') void payments.refetch();
    if (tab === 'shifts') void shifts.refetch();
  };

  const unpaidCount = unpaid.data?.total ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('cashier.title')}
        description={t('cashier.description')}
        breadcrumbs={[
          { label: t('common.nav.dashboard'), href: '/dashboard' },
          { label: t('cashier.title') },
        ]}
        actions={
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={t('common.refresh')}
            title={t('common.refresh')}
            onClick={refreshAll}
          >
            <RefreshCw
              className={current.isFetching || unpaid.isFetching ? 'animate-spin' : undefined}
              aria-hidden="true"
            />
          </Button>
        }
      />

      <ShiftCard
        data={current.data}
        loading={current.isLoading}
        viewer={viewer}
        onOpenShift={() => setOpenShiftOpen(true)}
        onCloseShift={() => setCloseShiftOpen(true)}
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as CashierTab)}>
        <TabsList
          className="scrollbar-none flex h-auto w-full justify-start overflow-x-auto p-1 sm:inline-flex sm:w-auto"
          aria-label={t('cashier.title')}
        >
          <TabsTrigger value="unpaid" className="flex-1 sm:flex-none">
            <Wallet aria-hidden="true" />
            {t('cashier.tabs.unpaid')}
            {unpaidCount > 0 ? (
              <span
                className="tabular ml-1 rounded-full bg-destructive/15 px-1.5 text-xs font-semibold text-danger"
                aria-label={`${unpaidCount}`}
              >
                {unpaidCount}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex-1 sm:flex-none">
            <ReceiptText aria-hidden="true" />
            {t('cashier.tabs.payments')}
          </TabsTrigger>
          <TabsTrigger value="shifts" className="flex-1 sm:flex-none">
            <History aria-hidden="true" />
            {t('cashier.tabs.shifts')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="unpaid">
          <UnpaidList
            data={unpaid.data}
            loading={unpaid.isLoading}
            fetching={unpaid.isFetching}
            scope={scope}
            onScopeChange={setScope}
            q={q}
            onQChange={setQ}
            canPay={canPay}
            onPay={openPay}
          />
        </TabsContent>
        <TabsContent value="payments">
          <PaymentsTable
            data={payments.data}
            loading={payments.isLoading}
            date={paymentsDate}
            onDateChange={(d) => {
              setPaymentsDate(d);
              setPaymentsPage(1);
            }}
            page={paymentsPage}
            pageSize={PAGE_SIZE}
            onPageChange={setPaymentsPage}
            canRefund={canRefund}
            onReprint={onReprint}
            onRefund={onRefund}
            reprintingId={reprintingId}
          />
        </TabsContent>
        <TabsContent value="shifts">
          <ShiftsHistory
            data={shifts.data}
            loading={shifts.isLoading}
            page={shiftsPage}
            pageSize={PAGE_SIZE}
            onPageChange={setShiftsPage}
          />
        </TabsContent>
      </Tabs>

      <PaymentDialog
        visitId={payVisitId}
        open={payOpen}
        onOpenChange={setPayOpen}
        onPaid={onPaid}
        onNeedShift={() => setOpenShiftOpen(true)}
        shiftReady={shiftReady}
      />
      <RefundDialog
        payment={refundTarget}
        open={refundOpen}
        onOpenChange={setRefundOpen}
        onRefunded={onRefunded}
        onNeedShift={() => setOpenShiftOpen(true)}
      />
      <ReceiptDialog
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        receipt={receipt}
        autoPrint={receiptAuto}
        onNewPayment={
          canPay
            ? () => {
                setReceiptOpen(false);
                setTab('unpaid');
              }
            : undefined
        }
      />
      <OpenShiftDialog open={openShiftOpen} onOpenChange={setOpenShiftOpen} />
      <CloseShiftDialog
        open={closeShiftOpen}
        onOpenChange={setCloseShiftOpen}
        shift={current.data?.shift ?? null}
      />
    </div>
  );
}
