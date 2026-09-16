'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale } from '@/i18n/client';
import { formatQuantity } from '@/lib/calc';
import { fmtSmartDate } from '@/lib/date';
import { Money } from '@/components/shared/money';
import { StatusBadge } from '@/components/shared/status-badge';
import { GenderAvatar } from '@/components/shared/gender-avatar';
import { paymentStatusOf } from '@/lib/cashier/format';
import type { CashierLineDTO, CashierVisitDTO } from '@/lib/cashier/types';

export interface VisitSummaryCardProps {
  visit: CashierVisitDTO;
  className?: string;
  /** Koʻrsatiladigan qatorlar soni (qolgani yigʻiladi) */
  maxLines?: number;
}

function lineLabel(line: CashierLineDTO, locale: 'uz' | 'ru', t: (k: string) => string): string {
  const name = locale === 'ru' && line.serviceNameRu ? line.serviceNameRu : line.serviceName;
  const parts: string[] = [];
  if (line.organ) parts.push(t(`common.organ.${line.organ}`));
  if (line.side) parts.push(t(`common.side.${line.side}`));
  if (line.detail) parts.push(line.detail);
  return parts.length ? `${name} (${parts.join(', ').toLowerCase()})` : name;
}

/** Toʻlov oynasidagi qabul xulosasi: bemor, shifokor, ixcham qatorlar, jamlar va toʻlov holati */
export function VisitSummaryCard({ visit, className, maxLines = 4 }: VisitSummaryCardProps) {
  const { t, locale } = useLocale();
  const [expanded, setExpanded] = React.useState(false);
  const lines = expanded ? visit.lines : visit.lines.slice(0, maxLines);
  const hidden = visit.lines.length - lines.length;
  const totals = visit.totals;

  return (
    <section
      className={cn('bg-bg-elevated/70 rounded-xl border border-line', className)}
      aria-label={t('cashier.pay.visitSummary')}
    >
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <GenderAvatar gender={visit.patient.gender} name={visit.patient.fullName} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-text">{visit.patient.fullName}</div>
          <div className="truncate text-xs text-text-muted">
            <span className="tabular font-mono">{visit.patient.cardNumber}</span> · {visit.doctor.fullName} ·{' '}
            <span className="tabular">{fmtSmartDate(visit.createdAt, locale)}</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadge kind="visit" status={visit.status} />
          <StatusBadge kind="payment" status={paymentStatusOf(totals)} />
        </div>
      </header>

      <div className="px-4 py-3">
        {visit.lines.length === 0 ? (
          <p className="text-sm text-text-muted">{t('cashier.pay.noLines')}</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {lines.map((line) => (
              <li key={line.id} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 flex-1 truncate text-text">
                  {lineLabel(line, locale, t)}
                  <span className="tabular ml-1.5 text-xs text-text-muted">
                    × {formatQuantity(line.quantity)} {line.unit}
                  </span>
                </span>
                <Money value={line.lineTotal} suffix={null} className="shrink-0 text-text" />
              </li>
            ))}
          </ul>
        )}
        {hidden > 0 || expanded ? (
          <button
            type="button"
            className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
          >
            <ChevronDown
              className={cn('size-3.5 transition-transform', expanded && 'rotate-180')}
              aria-hidden="true"
            />
            {expanded ? t('common.less') : t('cashier.pay.moreLines', { n: hidden })}
          </button>
        ) : null}
      </div>

      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-t border-line px-4 py-3 text-sm">
        <dt className="text-text-muted">{t('cashier.pay.total')}</dt>
        <dd className="text-right">
          <Money value={totals.totalNet} className="font-medium text-text" />
        </dd>
        {totals.discount > 0 ? (
          <>
            <dt className="text-text-muted">{t('cashier.pay.discount')}</dt>
            <dd className="text-right">
              <Money value={-totals.discount} className="text-[#00FFB2]" />
            </dd>
          </>
        ) : null}
        <dt className="text-text-muted">{t('cashier.pay.paid')}</dt>
        <dd className="text-right">
          <Money value={totals.paidAmount} className="text-text" />
        </dd>
        <dt className="font-medium text-text">{t('cashier.pay.balance')}</dt>
        <dd className="text-right">
          <Money
            value={totals.balance}
            className={cn(
              'font-heading text-lg font-bold',
              totals.balance > 0 ? 'text-danger' : 'text-[#00FFB2]',
            )}
          />
        </dd>
      </dl>
    </section>
  );
}
