'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { formatMoney, MoneyError } from '@/lib/money';
import { useT } from '@/i18n/client';

export interface MoneyProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  value: number | string | null | undefined;
  /** Valyuta qoʻshimchasi; `null` — qoʻshimchasiz; berilmasa `t('common.currency')` (soʻm / сум) */
  suffix?: string | null;
  /** Musbat qiymat oldiga "+" */
  signed?: boolean;
  /** Xira rang (text-text-muted) */
  muted?: boolean;
  /** `null`/`undefined` uchun matn (default "—") */
  emptyText?: string;
  className?: string;
}

/**
 * Pul koʻrsatish: `formatMoney` + til boʻyicha valyuta + tabular raqamlar.
 *
 *   <Money value={visit.totalNet} />          → 1 250 000 soʻm
 *   <Money value={-5000} signed suffix={null} /> → −5 000
 */
export const Money = React.forwardRef<HTMLSpanElement, MoneyProps>(
  ({ value, suffix, signed = false, muted = false, emptyText = '—', className, ...props }, ref) => {
    const t = useT();
    const currency = suffix === undefined ? t('common.currency') : suffix ?? '';

    let text: string;
    if (value === null || value === undefined || value === '') {
      text = emptyText;
    } else {
      try {
        text = formatMoney(value, { suffix: currency, signed });
      } catch (e) {
        text = e instanceof MoneyError ? emptyText : String(value);
      }
    }

    return (
      <span ref={ref} className={cn('tabular whitespace-nowrap', muted && 'text-text-muted', className)} {...props}>
        {text}
      </span>
    );
  },
);
Money.displayName = 'Money';
