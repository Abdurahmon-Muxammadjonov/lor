'use client';

import * as React from 'react';
import type { Role } from '@prisma/client';
import { Clock, Lock, LockOpen, User, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale } from '@/i18n/client';
import { fmtSmartDate } from '@/lib/date';
import { can } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Money } from '@/components/shared/money';
import { StatusBadge } from '@/components/shared/status-badge';
import type { CurrentShiftResponse } from '@/lib/cashier/types';
import { MethodChips } from './shift-totals';

export interface ShiftCardProps {
  data: CurrentShiftResponse | undefined;
  loading: boolean;
  viewer: { id: string; role: Role };
  onOpenShift: () => void;
  onCloseShift: () => void;
  className?: string;
}

function durationText(openedAt: string, locale: 'uz' | 'ru', now: number): string {
  const min = Math.max(0, Math.floor((now - new Date(openedAt).getTime()) / 60_000));
  const h = Math.floor(min / 60);
  const m = min % 60;
  return locale === 'ru' ? `${h} ч ${m} мин` : `${h} soat ${m} daqiqa`;
}

/**
 * Smena holati kartasi: ochiq — kassir, ochilgan vaqt, davomiylik, usullar boʻyicha jonli jamlar, kutilayotgan naqd;
 * yopiq — "Smena ochish" tugmasi (shifts.manage). Boshqa kassirning smenasi — izoh bilan.
 */
export function ShiftCard({ data, loading, viewer, onOpenShift, onCloseShift, className }: ShiftCardProps) {
  const { t, locale } = useLocale();
  const canManage = can(viewer.role, 'shifts.manage');
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  if (loading && !data) {
    return (
      <section className={cn('glass rounded-2xl p-5', className)} aria-busy="true">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-28 rounded-full" />
          ))}
        </div>
      </section>
    );
  }

  const shift = data?.shift ?? null;

  if (!shift) {
    return (
      <section
        className={cn('glass relative overflow-hidden rounded-2xl p-5', className)}
        aria-label={t('cashier.shift.title')}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line bg-bg-elevated text-text-muted">
              <Lock className="size-5" aria-hidden="true" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-heading text-lg font-semibold text-text">{t('cashier.shift.none')}</h2>
                <StatusBadge kind="shift" status="CLOSED" />
              </div>
              <p className="mt-1 max-w-xl text-sm text-text-muted">
                {canManage ? t('cashier.shift.noneHint') : t('cashier.shift.noneViewer')}
              </p>
            </div>
          </div>
          {canManage ? (
            <Button
              type="button"
              variant="gradient"
              size="lg"
              className="glow shrink-0"
              onClick={onOpenShift}
            >
              <LockOpen aria-hidden="true" />
              {t('cashier.shift.open')}
            </Button>
          ) : null}
        </div>
      </section>
    );
  }

  const mine = data?.isMine ?? false;
  const canOperate = data?.canOperate ?? false;
  const totals = shift.totals;

  return (
    <section
      className={cn('glass relative overflow-hidden rounded-2xl p-5', className)}
      aria-label={t('cashier.shift.title')}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-[#00FFB2]/10 blur-3xl"
      />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-heading text-lg font-semibold text-text">{t('cashier.shift.title')}</h2>
            <StatusBadge kind="shift" status="OPEN" />
            {mine ? (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-accent">
                {t('cashier.shift.mine')}
              </span>
            ) : null}
          </div>
          <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-text-muted">
            <div className="flex items-center gap-1.5">
              <User className="size-4 shrink-0" aria-hidden="true" />
              <dt className="sr-only">{t('cashier.shift.cashier')}</dt>
              <dd className="text-text">{shift.cashier.fullName}</dd>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="size-4 shrink-0" aria-hidden="true" />
              <dt className="sr-only">{t('cashier.shift.openedAt')}</dt>
              <dd className="tabular">
                {fmtSmartDate(shift.openedAt, locale)} · {durationText(shift.openedAt, locale, now)}
              </dd>
            </div>
            <div className="flex items-center gap-1.5">
              <Wallet className="size-4 shrink-0" aria-hidden="true" />
              <dt>{t('cashier.shift.openingCash')}:</dt>
              <dd>
                <Money value={shift.openingCash} className="text-text" />
              </dd>
            </div>
          </dl>
          {!mine ? (
            <p className="mt-2 text-sm text-text-muted">
              {t('cashier.shift.otherOpen', { name: shift.cashier.fullName })}.{' '}
              {canOperate
                ? t('cashier.shift.adminOperates')
                : canManage
                  ? t('cashier.shift.otherOpenHint')
                  : ''}
            </p>
          ) : null}
          <MethodChips byMethod={totals.byMethod} className="mt-4" />
        </div>

        <div className="flex shrink-0 flex-col gap-3 lg:items-end">
          <div className="bg-bg-elevated/70 grid grid-cols-2 gap-x-6 gap-y-1 rounded-xl border border-line px-4 py-3 text-sm lg:text-right">
            <span className="text-text-muted">{t('cashier.shift.total')}</span>
            <Money value={totals.total} className="font-heading text-xl font-bold text-text" />
            <span className="text-text-muted">{t('cashier.shift.expectedCash')}</span>
            <Money value={totals.expectedCash} className="font-medium text-text" />
            <span className="text-text-muted">{t('cashier.shift.paymentsCount')}</span>
            <span className="tabular text-text">{totals.paymentsCount}</span>
            {totals.refundsCount > 0 ? (
              <>
                <span className="text-text-muted">{t('cashier.shift.refundsCount')}</span>
                <span className="tabular text-danger">
                  {totals.refundsCount} · <Money value={-totals.refundsTotal} suffix={null} />
                </span>
              </>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {canManage && !mine ? (
              <Button type="button" variant="outline" onClick={onOpenShift}>
                <LockOpen aria-hidden="true" />
                {t('cashier.shift.open')}
              </Button>
            ) : null}
            {canManage && canOperate ? (
              <Button type="button" variant="secondary" onClick={onCloseShift}>
                <Lock aria-hidden="true" />
                {t('cashier.shift.close')}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
