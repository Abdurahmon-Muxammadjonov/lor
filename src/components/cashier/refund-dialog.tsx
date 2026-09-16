'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Undo2 } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Money } from '@/components/shared/money';
import { RefundBodySchema } from '@/lib/cashier/schemas';
import { cashierErrorCode } from '@/lib/cashier/format';
import type { PaymentListItemDTO, RefundResultDTO } from '@/lib/cashier/types';
import { MethodBadge } from './method-badge';
import { MoneyInput } from './money-input';
import { cashierErrorMessage, isNoOpenShiftError, useRefundPayment } from './use-cashier';

export interface RefundDialogProps {
  payment: PaymentListItemDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefunded: (result: RefundResultDTO) => void;
  onNeedShift: () => void;
}

/** Qaytarish oynasi: summa (maks. — toʻlov va qabul boʻyicha toʻlangan summadan kichigi), sabab (majburiy) */
export function RefundDialog({ payment, open, onOpenChange, onRefunded, onNeedShift }: RefundDialogProps) {
  const t = useT();
  const mutation = useRefundPayment();
  const [amount, setAmount] = React.useState(0);
  const [note, setNote] = React.useState('');
  const [amountError, setAmountError] = React.useState<string | null>(null);
  const [noteError, setNoteError] = React.useState<string | null>(null);
  const noteRef = React.useRef<HTMLTextAreaElement>(null);

  const max = payment ? Math.max(0, Math.min(payment.amount, payment.visit.paidAmount)) : 0;

  React.useEffect(() => {
    if (open && payment) {
      setAmount(Math.max(0, Math.min(payment.amount, payment.visit.paidAmount)));
      setNote('');
      setAmountError(null);
      setNoteError(null);
      const id = window.setTimeout(() => noteRef.current?.focus(), 60);
      return () => window.clearTimeout(id);
    }
  }, [open, payment]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payment) return;
    let bad = false;
    if (amount <= 0 || amount > max) {
      setAmountError(
        t('cashier.refund.exceeds', { max: formatMoney(max, { suffix: t('common.currency') }) }),
      );
      bad = true;
    }
    if (!note.trim()) {
      setNoteError(t('cashier.refund.noteRequired'));
      bad = true;
    }
    if (bad) return;
    const parsed = RefundBodySchema.safeParse({ amount, note: note.trim() });
    if (!parsed.success) {
      setNoteError(t('cashier.errors.VALIDATION'));
      return;
    }
    try {
      const r = await mutation.mutateAsync({ paymentId: payment.id, ...parsed.data });
      toast.success(t('cashier.refund.success'));
      onOpenChange(false);
      onRefunded(r);
    } catch (err) {
      if (isNoOpenShiftError(err)) {
        toast.warning(t('cashier.errors.NO_OPEN_SHIFT'));
        onNeedShift();
        return;
      }
      if (err instanceof ApiClientError && cashierErrorCode(err.details) === 'REFUND_EXCEEDS') {
        const d = err.details as { max?: number };
        setAmountError(
          t('cashier.refund.exceeds', { max: formatMoney(d.max ?? max, { suffix: t('common.currency') }) }),
        );
        return;
      }
      toast.error(cashierErrorMessage(err, t));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !mutation.isPending && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Undo2 className="size-5 text-danger" aria-hidden="true" />
              {t('cashier.refund.title')}
            </DialogTitle>
            <DialogDescription>
              {payment
                ? t('cashier.refund.description', {
                    no: payment.receiptNo ?? '—',
                    amount: formatMoney(payment.amount, { suffix: t('common.currency') }),
                  })
                : ''}
            </DialogDescription>
          </DialogHeader>

          {payment ? (
            <div className="mt-5 space-y-4">
              <dl className="bg-bg-elevated/70 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 rounded-xl border border-line px-4 py-3 text-sm">
                <dt className="text-text-muted">{t('cashier.payments.patient')}</dt>
                <dd className="text-right text-text">{payment.visit.patient.fullName}</dd>
                <dt className="text-text-muted">{t('cashier.refund.method')}</dt>
                <dd className="text-right">
                  <MethodBadge method={payment.method} />
                </dd>
                <dt className="text-text-muted">{t('cashier.payments.amount')}</dt>
                <dd className="text-right">
                  <Money value={payment.amount} className="font-medium text-text" />
                </dd>
              </dl>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="refund-amount" required>
                    {t('cashier.refund.amount')}
                  </Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setAmount(max);
                      setAmountError(null);
                    }}
                  >
                    {t('cashier.refund.full')}
                  </Button>
                </div>
                <MoneyInput
                  id="refund-amount"
                  name="amount"
                  size="lg"
                  value={amount}
                  onChange={(v) => {
                    setAmount(v);
                    setAmountError(null);
                  }}
                  invalid={!!amountError}
                  aria-describedby={amountError ? 'refund-amount-error' : 'refund-amount-hint'}
                />
                {amountError ? (
                  <p id="refund-amount-error" role="alert" className="text-sm text-danger">
                    {amountError}
                  </p>
                ) : (
                  <p id="refund-amount-hint" className="text-xs text-text-muted">
                    {t('cashier.refund.max', { max: formatMoney(max, { suffix: t('common.currency') }) })}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="refund-note" required>
                  {t('cashier.refund.note')}
                </Label>
                <Textarea
                  ref={noteRef}
                  id="refund-note"
                  name="note"
                  rows={2}
                  maxLength={300}
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value);
                    setNoteError(null);
                  }}
                  placeholder={t('cashier.refund.notePlaceholder')}
                  aria-invalid={!!noteError || undefined}
                  aria-describedby={noteError ? 'refund-note-error' : undefined}
                />
                {noteError ? (
                  <p id="refund-note-error" role="alert" className="text-sm text-danger">
                    {noteError}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

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
              variant="destructive"
              loading={mutation.isPending}
              disabled={!payment || max <= 0}
            >
              <Undo2 aria-hidden="true" />
              {t('cashier.refund.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
