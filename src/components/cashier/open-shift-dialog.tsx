'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { LockOpen } from 'lucide-react';
import { useT } from '@/i18n/client';
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
import { OpenShiftSchema } from '@/lib/cashier/schemas';
import { MoneyInput } from './money-input';
import { cashierErrorMessage, useOpenShift } from './use-cashier';

export interface OpenShiftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpened?: () => void;
}

const QUICK = [0, 100_000, 200_000, 500_000];

/** Smena ochish: boshlangʻich naqd pul (tez tugmalar bilan) */
export function OpenShiftDialog({ open, onOpenChange, onOpened }: OpenShiftDialogProps) {
  const t = useT();
  const [openingCash, setOpeningCash] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const mutation = useOpenShift();
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (open) {
      setOpeningCash(0);
      setError(null);
      const id = window.setTimeout(() => inputRef.current?.focus(), 50);
      return () => window.clearTimeout(id);
    }
  }, [open]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = OpenShiftSchema.safeParse({ openingCash });
    if (!parsed.success) {
      setError(t('common.validation.number'));
      return;
    }
    try {
      await mutation.mutateAsync(parsed.data);
      toast.success(t('cashier.toast.shiftOpened'));
      onOpenChange(false);
      onOpened?.();
    } catch (err) {
      const msg = cashierErrorMessage(err, t);
      setError(msg);
      toast.error(msg);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !mutation.isPending && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <form onSubmit={submit} noValidate>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LockOpen className="size-5 text-accent" aria-hidden="true" />
              {t('cashier.shift.openDialog.title')}
            </DialogTitle>
            <DialogDescription>{t('cashier.shift.openDialog.description')}</DialogDescription>
          </DialogHeader>

          <div className="mt-5 space-y-3">
            <Label htmlFor="opening-cash">{t('cashier.shift.openingCash')}</Label>
            <MoneyInput
              ref={inputRef}
              id="opening-cash"
              name="openingCash"
              size="lg"
              value={openingCash}
              onChange={(v) => {
                setOpeningCash(v);
                setError(null);
              }}
              invalid={!!error}
              aria-describedby={error ? 'opening-cash-error' : undefined}
            />
            <div className="flex flex-wrap gap-2" role="group" aria-label={t('cashier.shift.openingCash')}>
              {QUICK.map((v) => (
                <Button
                  key={v}
                  type="button"
                  variant={openingCash === v ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setOpeningCash(v)}
                >
                  {v === 0 ? '0' : `${v / 1000}k`}
                </Button>
              ))}
            </div>
            {error ? (
              <p id="opening-cash-error" role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : null}
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
            <Button type="submit" variant="gradient" className="glow" loading={mutation.isPending}>
              {t('cashier.shift.openDialog.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
