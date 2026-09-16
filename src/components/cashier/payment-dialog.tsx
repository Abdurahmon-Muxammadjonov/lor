'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Banknote, LockOpen, Wallet } from 'lucide-react';
import type { PayMethod } from '@prisma/client';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/client';
import { formatMoney } from '@/lib/money';
import { ApiClientError } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Segmented, type SegmentedOption } from '@/components/ui/segmented';
import { Skeleton } from '@/components/ui/skeleton';
import { Money } from '@/components/shared/money';
import { EmptyState } from '@/components/shared/empty-state';
import { CreatePaymentSchema, PAY_METHODS } from '@/lib/cashier/schemas';
import { cashierErrorCode, changeFor, shareOf } from '@/lib/cashier/format';
import type { PaymentResultDTO } from '@/lib/cashier/types';
import { METHOD_ICONS } from './method-badge';
import { MoneyInput } from './money-input';
import { VisitSummaryCard } from './visit-summary-card';
import { cashierErrorMessage, isNoOpenShiftError, useCashierVisit, useCreatePayment } from './use-cashier';

export interface PaymentDialogProps {
  visitId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Muvaffaqiyatli toʻlovdan soʻng (chek koʻrsatish uchun) */
  onPaid: (result: PaymentResultDTO) => void;
  /** Ochiq smena yoʻq — smena ochish oynasini koʻrsatish */
  onNeedShift: () => void;
  /** Joriy foydalanuvchi toʻlov qabul qila oladi (ochiq smena bor) */
  shiftReady: boolean;
}

const NOTE_PRESETS = ['advance', 'partial', 'debt', 'discount'] as const;

/** Berilgan naqd pul uchun tez tugmalar: aniq summa va yaqin yaxlit kupyuralar */
function givenPresets(amount: number): number[] {
  if (amount <= 0) return [];
  const steps = [10_000, 50_000, 100_000, 500_000];
  const set = new Set<number>([amount]);
  for (const s of steps) {
    const up = Math.ceil(amount / s) * s;
    if (up > amount) set.add(up);
  }
  return Array.from(set)
    .sort((a, b) => a - b)
    .slice(0, 4);
}

/**
 * Toʻlov oynasi: qabul xulosasi → summa (Toʻliq / 50 %) → usul → naqd boʻlsa berilgan pul va qaytim → izoh.
 * OVERPAY → maydon xatosi, NO_OPEN_SHIFT → smena ochish taklifi. Muvaffaqiyat → onPaid(result).
 */
export function PaymentDialog({
  visitId,
  open,
  onOpenChange,
  onPaid,
  onNeedShift,
  shiftReady,
}: PaymentDialogProps) {
  const t = useT();
  const visitQuery = useCashierVisit(open ? visitId : null);
  const visit = visitQuery.data;
  const mutation = useCreatePayment();

  const [amount, setAmount] = React.useState(0);
  const [method, setMethod] = React.useState<PayMethod>('CASH');
  const [given, setGiven] = React.useState(0);
  const [note, setNote] = React.useState('');
  const [amountError, setAmountError] = React.useState<string | null>(null);
  /** Foydalanuvchi summani oʻzi oʻzgartirdi (aks holda qoldiq bilan sinxron) */
  const [dirty, setDirty] = React.useState(false);
  const amountRef = React.useRef<HTMLInputElement>(null);
  const focusedFor = React.useRef<string | null>(null);

  const balance = visit?.totals.balance ?? 0;

  // Oyna ochilganda maydonlar tozalanadi
  React.useEffect(() => {
    if (!open) {
      focusedFor.current = null;
      return;
    }
    setDirty(false);
    setMethod('CASH');
    setGiven(0);
    setNote('');
    setAmountError(null);
  }, [open]);

  // Summa = qoldiq (foydalanuvchi oʻzgartirmaguncha; yangi maʼlumot kelsa ham yangilanadi)
  React.useEffect(() => {
    if (open && visit && !dirty) setAmount(Math.max(0, visit.totals.balance));
  }, [open, visit, dirty]);

  // Qabul yuklangach summa maydoniga fokus (har ochilishda bir marta)
  React.useEffect(() => {
    if (!open || !visit || focusedFor.current === visit.id) return;
    focusedFor.current = visit.id;
    const id = window.setTimeout(() => {
      amountRef.current?.focus();
      amountRef.current?.select();
    }, 60);
    return () => window.clearTimeout(id);
  }, [open, visit]);

  const changeAmount = (v: number) => {
    setDirty(true);
    setAmount(v);
    setAmountError(null);
  };

  const remaining = balance - amount;
  const change = method === 'CASH' && given > 0 ? changeFor(given, amount) : null;
  const cancelled = visit?.status === 'CANCELLED';
  const nothingToPay = !!visit && balance <= 0;
  const canSubmit =
    !!visit && !cancelled && !nothingToPay && amount > 0 && amount <= balance && !mutation.isPending;

  const methodOptions = React.useMemo<SegmentedOption<PayMethod>[]>(
    () =>
      PAY_METHODS.map((m) => {
        const Icon = METHOD_ICONS[m];
        return {
          value: m,
          icon: <Icon aria-hidden="true" />,
          label: <span className="hidden sm:inline">{t(`common.payMethod.${m}`)}</span>,
        };
      }),
    [t],
  );

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!visit) return;
    if (amount <= 0) {
      setAmountError(t('cashier.pay.amountRequired'));
      amountRef.current?.focus();
      return;
    }
    if (amount > balance) {
      setAmountError(
        t('cashier.pay.overpay', { max: formatMoney(balance, { suffix: t('common.currency') }) }),
      );
      amountRef.current?.focus();
      return;
    }
    const parsed = CreatePaymentSchema.safeParse({
      visitId: visit.id,
      amount,
      method,
      note: note.trim() || undefined,
    });
    if (!parsed.success) {
      setAmountError(t('cashier.errors.VALIDATION'));
      return;
    }
    try {
      const result = await mutation.mutateAsync(parsed.data);
      toast.success(
        result.totals.balance > 0
          ? t('cashier.pay.successDebt', {
              balance: formatMoney(result.totals.balance, { suffix: t('common.currency') }),
            })
          : t('cashier.pay.success'),
      );
      onOpenChange(false);
      onPaid(result);
    } catch (err) {
      if (isNoOpenShiftError(err)) {
        toast.warning(t('cashier.errors.NO_OPEN_SHIFT'));
        onNeedShift();
        return;
      }
      if (err instanceof ApiClientError && cashierErrorCode(err.details) === 'OVERPAY') {
        const d = err.details as { balance?: number };
        setAmountError(
          t('cashier.pay.overpay', {
            max: formatMoney(d.balance ?? balance, { suffix: t('common.currency') }),
          }),
        );
        void visitQuery.refetch();
        return;
      }
      toast.error(cashierErrorMessage(err, t));
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !mutation.isPending && onOpenChange(o)}>
      <DialogContent className="max-w-2xl" onKeyDown={onKeyDown}>
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="size-5 text-accent" aria-hidden="true" />
              {t('cashier.pay.title')}
            </DialogTitle>
            <DialogDescription>
              {visit ? `${visit.patient.fullName} · ${visit.patient.cardNumber}` : t('cashier.pay.loading')}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            {/* Qabul xulosasi */}
            <div className="min-w-0">
              {visitQuery.isLoading ? (
                <div className="space-y-3 rounded-xl border border-line p-4" aria-busy="true">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-8 w-1/2" />
                </div>
              ) : visitQuery.isError || !visit ? (
                <EmptyState
                  compact
                  title={t('cashier.pay.loadError')}
                  description={cashierErrorMessage(visitQuery.error, t)}
                />
              ) : (
                <VisitSummaryCard visit={visit} />
              )}
            </div>

            {/* Toʻlov shakli */}
            <div className="min-w-0 space-y-4">
              {!shiftReady ? (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm">
                  <span className="text-text">{t('cashier.pay.needShift')}</span>
                  <Button type="button" size="sm" variant="secondary" onClick={onNeedShift}>
                    <LockOpen aria-hidden="true" />
                    {t('cashier.pay.openShiftNow')}
                  </Button>
                </div>
              ) : null}
              {cancelled ? (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-danger">
                  {t('cashier.pay.cancelled')}
                </p>
              ) : null}
              {nothingToPay && !cancelled ? (
                <p className="rounded-lg border border-[#00FFB2]/30 bg-[#00FFB2]/10 px-3 py-2 text-sm text-text">
                  {t('cashier.pay.nothing')}
                </p>
              ) : null}

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="pay-amount" required>
                    {t('cashier.pay.amount')}
                  </Label>
                  <div className="flex gap-1.5" role="group" aria-label={t('cashier.pay.amount')}>
                    <Button
                      type="button"
                      size="sm"
                      variant={amount === balance && balance > 0 ? 'secondary' : 'outline'}
                      onClick={() => changeAmount(balance)}
                      disabled={balance <= 0}
                    >
                      {t('cashier.pay.full')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => changeAmount(shareOf(balance, 0.5))}
                      disabled={balance <= 0}
                    >
                      {t('cashier.pay.half')}
                    </Button>
                  </div>
                </div>
                <MoneyInput
                  ref={amountRef}
                  id="pay-amount"
                  name="amount"
                  size="lg"
                  value={amount}
                  onChange={changeAmount}
                  invalid={!!amountError}
                  aria-describedby={amountError ? 'pay-amount-error' : 'pay-amount-hint'}
                  disabled={!visit || cancelled || nothingToPay}
                />
                {amountError ? (
                  <p id="pay-amount-error" role="alert" className="text-sm text-danger">
                    {amountError}
                  </p>
                ) : (
                  <p id="pay-amount-hint" className="text-xs text-text-muted" aria-live="polite">
                    {visit && amount > 0 && amount <= balance ? (
                      remaining === 0 ? (
                        <span className="text-[#00FFB2]">{t('cashier.pay.settled')}</span>
                      ) : (
                        <>
                          {t('cashier.pay.remaining')}: <Money value={remaining} className="text-text" />
                        </>
                      )
                    ) : (
                      <>
                        {t('cashier.pay.balance')}: <Money value={balance} className="text-text" />
                      </>
                    )}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>{t('cashier.pay.method')}</Label>
                <Segmented
                  value={method}
                  onChange={setMethod}
                  options={methodOptions}
                  fullWidth
                  variant="accent"
                  ariaLabel={t('cashier.pay.method')}
                />
                <p className="text-xs text-text-muted sm:hidden" aria-hidden="true">
                  {t(`common.payMethod.${method}`)}
                </p>
              </div>

              {method === 'CASH' ? (
                <div className="bg-bg-elevated/60 space-y-2 rounded-xl border border-line p-3">
                  <Label htmlFor="pay-given" className="flex items-center gap-1.5">
                    <Banknote className="size-4 text-text-muted" aria-hidden="true" />
                    {t('cashier.pay.given')}
                  </Label>
                  <MoneyInput id="pay-given" name="given" value={given} onChange={setGiven} />
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('cashier.pay.given')}>
                    {givenPresets(amount).map((v) => (
                      <Button
                        key={v}
                        type="button"
                        size="sm"
                        variant={given === v ? 'secondary' : 'outline'}
                        onClick={() => setGiven(v)}
                      >
                        {formatMoney(v, { suffix: '' })}
                      </Button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-sm" aria-live="polite">
                    <span className="text-text-muted">{t('cashier.pay.change')}</span>
                    {change === null ? (
                      <span className="text-text-muted">—</span>
                    ) : change < 0 ? (
                      <span className="text-warning">{t('cashier.pay.insufficient')}</span>
                    ) : (
                      <Money value={change} className="font-heading text-lg font-bold text-accent" />
                    )}
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="pay-note">{t('cashier.pay.note')}</Label>
                <Input
                  id="pay-note"
                  name="note"
                  value={note}
                  maxLength={300}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t('cashier.pay.notePlaceholder')}
                />
                <div className="flex flex-wrap gap-1.5">
                  {NOTE_PRESETS.map((p) => {
                    const text = t(`cashier.pay.notePresets.${p}`);
                    const active = note === text;
                    return (
                      <button
                        key={p}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setNote(active ? '' : text)}
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          active
                            ? 'border-accent bg-primary/10 text-accent'
                            : 'border-line text-text-muted hover:border-[#2B3A57] hover:text-text',
                        )}
                      >
                        {text}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              variant="gradient"
              className="glow min-w-44"
              loading={mutation.isPending}
              disabled={!canSubmit}
            >
              <Wallet aria-hidden="true" />
              {mutation.isPending ? t('cashier.pay.submitting') : t('cashier.pay.submit')}
              {amount > 0 && !mutation.isPending ? (
                <span className="tabular opacity-90">· {formatMoney(amount, { suffix: '' })}</span>
              ) : null}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
