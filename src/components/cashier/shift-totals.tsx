'use client';

import * as React from 'react';
import type { PayMethod } from '@prisma/client';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/client';
import { Money } from '@/components/shared/money';
import { PAY_METHODS } from '@/lib/cashier/schemas';
import type { MethodTotals } from '@/lib/cashier/types';
import { METHOD_ICONS } from './method-badge';

export interface MethodChipsProps {
  byMethod: MethodTotals;
  className?: string;
  /** Nol boʻlgan usullarni xira koʻrsatish (default) yoki yashirish */
  hideZero?: boolean;
  size?: 'sm' | 'md';
}

/** Usullar boʻyicha jamlar — chiplar qatori (ikonka, nomi, summa) */
export function MethodChips({ byMethod, className, hideZero = false, size = 'md' }: MethodChipsProps) {
  const t = useT();
  const methods = PAY_METHODS.filter((m) => !hideZero || byMethod[m] !== 0);
  return (
    <ul className={cn('flex flex-wrap gap-2', className)} aria-label={t('cashier.payments.byMethod')}>
      {methods.map((m: PayMethod) => {
        const Icon = METHOD_ICONS[m];
        const zero = byMethod[m] === 0;
        return (
          <li
            key={m}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border border-line bg-bg-elevated',
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm',
              zero ? 'text-text-muted' : 'text-text',
            )}
          >
            <Icon
              className={cn(
                'shrink-0',
                size === 'sm' ? 'size-3.5' : 'size-4',
                zero ? 'opacity-60' : 'text-accent',
              )}
              aria-hidden="true"
            />
            <span className="text-text-muted">{t(`common.payMethod.${m}`)}</span>
            <Money
              value={byMethod[m]}
              suffix={null}
              className={cn('font-medium', byMethod[m] < 0 && 'text-danger')}
            />
          </li>
        );
      })}
    </ul>
  );
}

export interface DifferenceProps {
  value: number;
  className?: string;
  /** Katta shrift */
  large?: boolean;
}

/** Smena farqi: 0 — yashil "Farq yoʻq", musbat — ortiqcha (sariq), manfiy — kamomad (qizil) */
export function ShiftDifference({ value, className, large = false }: DifferenceProps) {
  const t = useT();
  const tone = value === 0 ? 'text-[#00FFB2]' : value > 0 ? 'text-warning' : 'text-danger';
  const label =
    value === 0
      ? t('cashier.shift.exact')
      : value > 0
        ? t('cashier.shift.surplus')
        : t('cashier.shift.shortage');
  return (
    <span className={cn('inline-flex items-baseline gap-2', tone, className)}>
      <span className={cn('text-xs uppercase tracking-wide opacity-80', large && 'text-sm')}>{label}</span>
      {value !== 0 ? (
        <Money
          value={value}
          signed
          className={cn('font-heading font-bold', large ? 'text-2xl' : 'text-base')}
        />
      ) : null}
    </span>
  );
}
