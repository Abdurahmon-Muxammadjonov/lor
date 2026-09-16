'use client';

import * as React from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
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

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmText?: React.ReactNode;
  cancelText?: React.ReactNode;
  /** Xavfli amal — qizil tugma va ogohlantirish ikonkasi */
  destructive?: boolean;
  /**
   * Tashqi yuklanish holati. Berilmasa: `onConfirm` promise qaytarsa — kutib, soʻng yopiladi;
   * sinxron boʻlsa — darhol yopiladi. Berilsa — yopishni siz boshqarasiz (`onOpenChange(false)`).
   */
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  /** Ikonkani yashirish */
  hideIcon?: boolean;
  className?: string;
}

/**
 * Tasdiqlash oynasi.
 *
 *   <ConfirmDialog open={open} onOpenChange={setOpen} title={t('common.deleteConfirm')} destructive onConfirm={remove} />
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  cancelText,
  destructive = false,
  loading,
  onConfirm,
  onCancel,
  hideIcon = false,
  className,
}: ConfirmDialogProps) {
  const t = useT();
  const [pending, setPending] = React.useState(false);
  const busy = loading ?? pending;
  const mountedRef = React.useRef(true);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleConfirm = async () => {
    const result = onConfirm();
    if (result instanceof Promise) {
      setPending(true);
      try {
        await result;
        if (mountedRef.current) onOpenChange(false);
      } finally {
        if (mountedRef.current) setPending(false);
      }
      return;
    }
    if (loading === undefined) onOpenChange(false);
  };

  const handleOpenChange = (next: boolean) => {
    if (busy && !next) return;
    if (!next) onCancel?.();
    onOpenChange(next);
  };

  const Icon = destructive ? AlertTriangle : HelpCircle;
  const desc = description ?? (destructive ? t('common.deleteConfirm') : undefined);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={cn('max-w-md', className)} hideClose={busy} {...(desc ? {} : { 'aria-describedby': undefined })}>
        <DialogHeader className="items-center gap-2 sm:flex-row sm:items-start sm:gap-4">
          {hideIcon ? null : (
            <div
              aria-hidden="true"
              className={cn(
                'flex size-11 shrink-0 items-center justify-center rounded-full border',
                destructive ? 'border-destructive/25 bg-destructive/10 text-danger' : 'border-primary/25 bg-primary/10 text-accent',
              )}
            >
              <Icon className="size-5" />
            </div>
          )}
          <div className="min-w-0 space-y-1.5">
            <DialogTitle>{title}</DialogTitle>
            {desc ? <DialogDescription>{desc}</DialogDescription> : null}
          </div>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={busy} autoFocus={destructive}>
            {cancelText ?? t('common.cancel')}
          </Button>
          <Button type="button" variant={destructive ? 'destructive' : 'default'} onClick={handleConfirm} loading={busy} autoFocus={!destructive}>
            {confirmText ?? (destructive ? t('common.yesDelete') : t('common.confirm'))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────────── useConfirm ───────────────────────── */

export interface ConfirmOptions {
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmText?: React.ReactNode;
  cancelText?: React.ReactNode;
  destructive?: boolean;
  hideIcon?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

/**
 * Imperativ tasdiqlash:
 *
 *   const [confirm, confirmElement] = useConfirm();
 *   const remove = async () => { if (await confirm({ title: t('common.deleteConfirm'), destructive: true })) { … } };
 *   return <>…{confirmElement}</>;
 */
export function useConfirm(): [ConfirmFn, React.ReactElement] {
  const [state, setState] = React.useState<{ open: boolean; opts: ConfirmOptions } | null>(null);
  const resolverRef = React.useRef<((v: boolean) => void) | null>(null);

  const settle = React.useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setState((s) => (s ? { ...s, open: false } : s));
  }, []);

  const confirm = React.useCallback<ConfirmFn>((opts) => {
    // Oldingi kutilayotgan soʻrov boʻlsa — rad
    resolverRef.current?.(false);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setState({ open: true, opts });
    });
  }, []);

  React.useEffect(() => {
    return () => {
      resolverRef.current?.(false);
      resolverRef.current = null;
    };
  }, []);

  const element = (
    <ConfirmDialog
      open={state?.open ?? false}
      onOpenChange={(o) => {
        if (!o) settle(false);
      }}
      title={state?.opts.title ?? ''}
      description={state?.opts.description}
      confirmText={state?.opts.confirmText}
      cancelText={state?.opts.cancelText}
      destructive={state?.opts.destructive}
      hideIcon={state?.opts.hideIcon}
      onConfirm={() => settle(true)}
    />
  );

  return [confirm, element];
}
