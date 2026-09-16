'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Lock } from 'lucide-react';
import { useLocale } from '@/i18n/client';
import { fmtSmartDate } from '@/lib/date';
import { formatMoney } from '@/lib/money';
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
import { CloseShiftSchema } from '@/lib/cashier/schemas';
import type { ShiftDTO } from '@/lib/cashier/types';
import { MoneyInput } from './money-input';
import { MethodChips, ShiftDifference } from './shift-totals';
import { cashierErrorMessage, useCloseShift } from './use-cashier';

export interface CloseShiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shift: ShiftDTO | null;
  onClosed?: () => void;
}

/** Smenani yopish: kutilayotgan jamlar, haqiqiy naqd, farq (rangli), izoh */
export function CloseShiftDialog({ open, onOpenChange, shift, onClosed }: CloseShiftDialogProps) {
  const { t, locale } = useLocale();
  const [closingCash, setClosingCash] = React.useState(0);
  const [note, setNote] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const mutation = useCloseShift();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const expected = shift?.totals.expectedCash ?? 0;

  React.useEffect(() => {
    if (open) {
      setClosingCash(expected);
      setNote('');
      setError(null);
      const id = window.setTimeout(() => inputRef.current?.select(), 50);
      return () => window.clearTimeout(id);
    }
  }, [open, expected]);

  const difference = closingCash - expected;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shift) return;
    const parsed = CloseShiftSchema.safeParse({ closingCash, note: note.trim() || undefined });
    if (!parsed.success) {
      setError(t('common.validation.number'));
      return;
    }
    try {
      const r = await mutation.mutateAsync({ shiftId: shift.id, ...parsed.data });
      toast.success(
        r.difference === 0
          ? t('cashier.toast.shiftClosed')
          : t('cashier.toast.shiftClosedDiff', {
              diff: formatMoney(r.difference, { suffix: t('common.currency'), signed: true }),
            }),
      );
      onOpenChange(false);
      onClosed?.();
    } catch (err) {
      const msg = cashierErrorMessage(err, t);
      setError(msg);
      toast.error(msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !mutation.isPending && onOpenChange(o)}>
      <DialogContent className="max-w-lg">
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="size-5 text-accent" aria-hidden="true" />
              {t('cashier.shift.closeDialog.title')}
            </DialogTitle>
            <DialogDescription>{t('cashier.shift.closeDialog.description')}</DialogDescription>
          </DialogHeader>

          {shift ? (
            <div className="mt-5 space-y-5">
              <section
                className="bg-bg-elevated/70 rounded-xl border border-line p-4"
                aria-label={t('cashier.shift.closeDialog.summary')}
              >
                <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                  {t('cashier.shift.closeDialog.summary')}
                </h3>
                <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
                  <dt className="text-text-muted">{t('cashier.shift.cashier')}</dt>
                  <dd className="text-right text-text">{shift.cashier.fullName}</dd>
                  <dt className="text-text-muted">{t('cashier.shift.openedAt')}</dt>
                  <dd className="tabular text-right text-text">{fmtSmartDate(shift.openedAt, locale)}</dd>
                  <dt className="text-text-muted">{t('cashier.shift.openingCash')}</dt>
                  <dd className="text-right">
                    <Money value={shift.openingCash} />
                  </dd>
                  <dt className="text-text-muted">{t('cashier.shift.total')}</dt>
                  <dd className="text-right">
                    <Money value={shift.totals.total} className="font-medium text-text" />
                  </dd>
                  <dt className="text-text-muted">
                    {t('cashier.shift.paymentsCount')} / {t('cashier.shift.refundsCount')}
                  </dt>
                  <dd className="tabular text-right text-text">
                    {shift.totals.paymentsCount} / {shift.totals.refundsCount}
                  </dd>
                  <dt className="font-medium text-text">{t('cashier.shift.expectedCash')}</dt>
                  <dd className="text-right">
                    <Money value={expected} className="font-heading text-lg font-bold text-accent" />
                  </dd>
                </dl>
                <MethodChips byMethod={shift.totals.byMethod} size="sm" className="mt-3" />
              </section>

              <div className="space-y-2">
                <Label htmlFor="closing-cash" required>
                  {t('cashier.shift.closingCash')}
                </Label>
                <MoneyInput
                  ref={inputRef}
                  id="closing-cash"
                  name="closingCash"
                  size="lg"
                  value={closingCash}
                  onChange={(v) => {
                    setClosingCash(v);
                    setError(null);
                  }}
                  invalid={!!error}
                />
                <div
                  className={
                    difference === 0
                      ? 'rounded-lg border border-[#00FFB2]/30 bg-[#00FFB2]/10 px-3 py-2'
                      : difference > 0
                        ? 'rounded-lg border border-warning/30 bg-warning/10 px-3 py-2'
                        : 'rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2'
                  }
                  aria-live="polite"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-text-muted">{t('cashier.shift.difference')}</span>
                    <ShiftDifference value={difference} />
                  </div>
                </div>
                {error ? (
                  <p role="alert" className="text-sm text-danger">
                    {error}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="closing-note">{t('cashier.shift.note')}</Label>
                <Textarea
                  id="closing-note"
                  name="note"
                  rows={2}
                  maxLength={500}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={t('cashier.shift.closeDialog.notePlaceholder')}
                />
              </div>

              <p className="flex items-start gap-2 text-xs text-text-muted">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden="true" />
                {t('cashier.shift.closeDialog.warning')}
              </p>
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
            <Button type="submit" variant="destructive" loading={mutation.isPending} disabled={!shift}>
              <Lock aria-hidden="true" />
              {t('cashier.shift.closeDialog.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
