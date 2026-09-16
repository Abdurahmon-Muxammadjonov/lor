'use client';

import * as React from 'react';
import Link from 'next/link';
import { Ban, CheckCircle2, Coins, ExternalLink, Percent, Receipt, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DiscountType } from '@/lib/calc';
import { formatMoney } from '@/lib/money';
import { fmtSmartDate } from '@/lib/date';
import { useLocale } from '@/i18n/client';
import type { VisitDetailDTO } from '@/lib/visits/dto';
import { visitBalance } from '@/lib/visits/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Segmented } from '@/components/ui/segmented';
import { Money } from '@/components/shared/money';
import { StatusBadge } from '@/components/shared/status-badge';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { MoneyField } from './money-field';
import { globalDiscountAmount, paymentStateOf, sumLines, totalBeforeRounding } from './visit-utils';

export interface VisitSummaryProps {
  visit: VisitDetailDTO;
  /** Qatorlar/chegirma oʻzgartirish mumkin (visits.write + OPEN) */
  canEdit: boolean;
  /** Bekor qilish huquqi (ADMIN/DOCTOR + OPEN + toʻlovsiz) */
  canCancel: boolean;
  onDiscount: (type: DiscountType, value: number) => Promise<void>;
  onComplete: () => Promise<void>;
  onCancel: () => Promise<void>;
  discountPending?: boolean;
  className?: string;
}

/**
 * Oʻng ustun (yopishqoq): qatorlar jami, umumiy chegirma (tahrirlanadi), yaxlitlash, JAMI (gradient),
 * toʻlangan, qoldiq, amallar: yakunlash / kassaga / chek / bekor qilish.
 */
export function VisitSummary({
  visit,
  canEdit,
  canCancel,
  onDiscount,
  onComplete,
  onCancel,
  discountPending = false,
  className,
}: VisitSummaryProps) {
  const { locale, t } = useLocale();
  const sums = React.useMemo(() => sumLines(visit.lines), [visit.lines]);
  const globalAmt = React.useMemo(() => globalDiscountAmount(visit, visit.lines), [visit]);
  const rawTotal = React.useMemo(() => totalBeforeRounding(visit, visit.lines), [visit]);
  const balance = visitBalance(visit);
  const payState = paymentStateOf(visit);

  const [dType, setDType] = React.useState<DiscountType>(visit.globalDiscountType);
  const [dValue, setDValue] = React.useState<number>(visit.globalDiscountValue);
  const [confirmComplete, setConfirmComplete] = React.useState(false);
  const [confirmCancel, setConfirmCancel] = React.useState(false);

  // Server qiymati oʻzgarsa (masalan boshqa oynada) — mahalliy formani moslash
  React.useEffect(() => {
    setDType(visit.globalDiscountType);
    setDValue(visit.globalDiscountValue);
  }, [visit.globalDiscountType, visit.globalDiscountValue]);

  const percentInvalid = dType === 'PERCENT' && dValue > 100;
  const dirty =
    dType !== visit.globalDiscountType || (dType !== 'NONE' && dValue !== visit.globalDiscountValue);
  const applyDiscount = async () => {
    if (!dirty || percentInvalid) return;
    await onDiscount(dType, dType === 'NONE' ? 0 : dValue);
  };

  const onTypeChange = (v: DiscountType) => {
    setDType(v);
    if (v === 'NONE') {
      setDValue(0);
      if (visit.globalDiscountType !== 'NONE') void onDiscount('NONE', 0);
    }
  };

  const hasLines = visit.lines.length > 0;
  const isOpen = visit.status === 'OPEN';

  return (
    <aside className={cn('glass-strong rounded-2xl p-4 sm:p-5', className)} aria-labelledby="summary-title">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2
          id="summary-title"
          className="flex items-center gap-2 font-heading text-lg font-semibold text-text"
        >
          <Coins className="size-5 text-accent" aria-hidden="true" />
          {t('visits.summary.title')}
        </h2>
        <StatusBadge
          kind="payment"
          status={hasLines || visit.paidAmount > 0 ? payState : 'UNPAID'}
          className="text-[11px]"
        />
      </div>

      <dl className="tabular space-y-2 text-sm">
        <Row
          label={t('visits.summary.linesTotal')}
          hint={t('visits.summary.lines', { n: visit.lines.length })}
        >
          <Money value={sums.net} />
        </Row>
        {sums.discount > 0 ? (
          <Row label={t('visits.summary.linesDiscount')} muted>
            <span className="text-warning">
              − <Money value={sums.discount} />
            </span>
          </Row>
        ) : null}
      </dl>

      {/* Umumiy chegirma */}
      <div className="bg-bg-elevated/60 mt-2 rounded-lg border border-line p-3">
        <div className="flex items-center justify-between gap-2">
          <Label className="flex items-center gap-1.5 text-text-muted">
            <Percent className="size-3.5" aria-hidden="true" />
            {t('visits.summary.globalDiscount')}
          </Label>
          {globalAmt > 0 ? (
            <span className="text-warning">
              − <Money value={globalAmt} />
            </span>
          ) : (
            <span className="text-text-muted">—</span>
          )}
        </div>
        {canEdit ? (
          <form
            className="mt-2 flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void applyDiscount();
            }}
          >
            <Segmented<DiscountType>
              value={dType}
              onChange={onTypeChange}
              size="sm"
              ariaLabel={t('visits.summary.globalDiscount')}
              disabled={discountPending}
              options={[
                { value: 'NONE', label: t('visits.dialog.discountNone') },
                { value: 'PERCENT', label: t('visits.dialog.discountPercent') },
                { value: 'FIXED', label: t('visits.dialog.discountFixed') },
              ]}
            />
            {dType === 'PERCENT' ? (
              <div className="relative w-24">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={100}
                  step={1}
                  value={dValue === 0 ? '' : String(dValue)}
                  onChange={(e) => setDValue(Math.max(0, Math.trunc(Number(e.target.value) || 0)))}
                  aria-label={t('visits.summary.globalDiscountValue')}
                  aria-invalid={percentInvalid || undefined}
                  placeholder="0"
                  className="tabular h-9 pr-7 text-right text-sm"
                  disabled={discountPending}
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-text-muted"
                >
                  %
                </span>
              </div>
            ) : dType === 'FIXED' ? (
              <MoneyField
                value={dValue}
                onChange={setDValue}
                size="sm"
                aria-label={t('visits.summary.globalDiscountValue')}
                className="w-36"
                disabled={discountPending}
              />
            ) : null}
            {dType !== 'NONE' ? (
              <Button
                type="submit"
                size="sm"
                variant={dirty ? 'default' : 'outline'}
                disabled={!dirty || percentInvalid}
                loading={discountPending}
              >
                {t('visits.summary.apply')}
              </Button>
            ) : null}
            {percentInvalid ? (
              <p role="alert" className="w-full text-xs text-danger">
                {t('visits.dialog.percentMax')}
              </p>
            ) : null}
          </form>
        ) : visit.globalDiscountType !== 'NONE' ? (
          <p className="mt-1 text-xs text-text-muted">
            {visit.globalDiscountType === 'PERCENT'
              ? `${visit.globalDiscountValue} %`
              : formatMoney(visit.globalDiscountValue, { suffix: t('common.currency') })}
          </p>
        ) : null}
      </div>

      <dl className="tabular mt-2 space-y-2 text-sm">
        {rawTotal !== visit.totalNet ? (
          <Row label={t('visits.summary.rounding', { n: visit.clinic.roundTo })} muted>
            <span className="text-xs text-text-muted">
              {t('visits.summary.beforeRounding', { v: formatMoney(rawTotal, { suffix: '' }) })}
            </span>
          </Row>
        ) : (
          <Row label={t('visits.summary.rounding', { n: visit.clinic.roundTo })} muted>
            <span className="text-xs text-text-muted">—</span>
          </Row>
        )}
      </dl>

      {/* JAMI */}
      <div className="mt-4 rounded-xl border border-primary/25 bg-gradient-accent-soft p-4">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
          {t('visits.summary.total')}
        </div>
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <Money
            value={visit.totalNet}
            suffix={null}
            className="text-gradient font-heading text-3xl font-bold leading-none sm:text-4xl"
            data-testid="visit-total"
          />
          <span className="text-sm text-text-muted">{t('common.currency')}</span>
        </div>
      </div>

      <dl className="tabular mt-3 space-y-2 text-sm">
        <Row label={t('visits.summary.paid')}>
          <Money value={visit.paidAmount} className={visit.paidAmount > 0 ? 'text-[#00FFB2]' : undefined} />
        </Row>
        <Row
          label={
            balance > 0
              ? t('visits.summary.debt')
              : balance < 0
                ? t('visits.summary.overpaid')
                : t('visits.summary.balance')
          }
          strong
        >
          <Money
            value={Math.abs(balance)}
            className={cn(
              'font-semibold',
              balance > 0 ? 'text-danger' : balance < 0 ? 'text-accent' : 'text-[#00FFB2]',
            )}
            data-testid="visit-balance"
          />
        </Row>
      </dl>

      {/* Toʻlovlar */}
      {visit.payments.length === 0 && visit.status !== 'CANCELLED' ? (
        <p className="mt-2 text-xs text-text-muted">{t('visits.summary.noPayments')}</p>
      ) : null}
      {visit.payments.length > 0 ? (
        <ul
          className="mt-3 space-y-1 border-t border-line pt-3 text-xs"
          aria-label={t('visits.summary.payments')}
        >
          {visit.payments.map((p) => (
            <li key={p.id} className="tabular flex items-center justify-between gap-2 text-text-muted">
              <span className="truncate">
                {t(`common.payMethod.${p.method}`)} · {fmtSmartDate(p.createdAt, locale)}
                {p.receiptNo ? ` · ${p.receiptNo}` : ''}
              </span>
              <Money
                value={p.amount}
                signed
                className={cn('shrink-0', p.amount < 0 ? 'text-danger' : 'text-text')}
              />
            </li>
          ))}
        </ul>
      ) : null}

      {/* Amallar */}
      <div className="mt-4 flex flex-col gap-2">
        {isOpen && canEdit ? (
          <Button
            type="button"
            variant="gradient"
            size="lg"
            className="glow w-full"
            disabled={!hasLines}
            onClick={() => setConfirmComplete(true)}
          >
            <CheckCircle2 aria-hidden="true" />
            {t('visits.summary.complete')}
          </Button>
        ) : null}
        {isOpen && canEdit && !hasLines ? (
          <p className="text-center text-xs text-text-muted">{t('visits.summary.noLines')}</p>
        ) : null}
        {visit.status !== 'CANCELLED' ? (
          <Button asChild variant="outline" size="lg" className="w-full">
            <Link href={`/dashboard/cashier?visit=${visit.id}`}>
              <Wallet aria-hidden="true" />
              {t('visits.summary.toCashier')}
            </Link>
          </Button>
        ) : null}
        {visit.payments.length > 0 ? (
          <Button asChild variant="ghost" className="w-full">
            <a href={`/print/receipt/${visit.id}`} target="_blank" rel="noopener noreferrer">
              <Receipt aria-hidden="true" />
              {t('visits.summary.receipt')}
              <ExternalLink className="ml-auto size-3.5 opacity-60" aria-hidden="true" />
            </a>
          </Button>
        ) : null}
        {isOpen && canCancel ? (
          <Button
            type="button"
            variant="ghost"
            className="w-full text-text-muted hover:text-danger"
            onClick={() => setConfirmCancel(true)}
          >
            <Ban aria-hidden="true" />
            {t('visits.summary.cancel')}
          </Button>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmComplete}
        onOpenChange={setConfirmComplete}
        title={t('visits.summary.completeTitle')}
        description={t('visits.summary.completeDescription', {
          total: formatMoney(visit.totalNet, { suffix: t('common.currency') }),
        })}
        confirmText={t('visits.summary.complete')}
        onConfirm={onComplete}
      />
      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={t('visits.summary.cancelTitle')}
        description={t('visits.summary.cancelDescription')}
        confirmText={t('visits.summary.cancel')}
        destructive
        onConfirm={onCancel}
      />
    </aside>
  );
}

function Row({
  label,
  hint,
  muted = false,
  strong = false,
  children,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  muted?: boolean;
  strong?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt
        className={cn(
          'min-w-0',
          muted ? 'text-text-muted' : strong ? 'font-medium text-text' : 'text-text-muted',
        )}
      >
        {label}
        {hint ? <span className="ml-1.5 text-xs text-muted-foreground/80">({hint})</span> : null}
      </dt>
      <dd className={cn('shrink-0 text-right', muted ? 'text-text-muted' : 'text-text')}>{children}</dd>
    </div>
  );
}
