'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { groupDigits } from '@/lib/money';
import { parseAmount } from '@/lib/cashier/format';
import { useT } from '@/i18n/client';
import { Input } from '@/components/ui/input';

export interface MoneyInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'size'
> {
  /** Butun soʻm */
  value: number;
  onChange: (value: number) => void;
  /** Oʻng tomondagi valyuta belgisi (default t('common.currency')); null — yoʻq */
  suffix?: string | null;
  size?: 'md' | 'lg';
  invalid?: boolean;
}

/**
 * Pul kiritish maydoni: yozayotganda "1 250 000" koʻrinishida guruhlanadi, qiymat — butun number.
 * Faqat raqamlar qabul qilinadi; ArrowUp/ArrowDown — ±1 000 (Shift bilan ±10 000).
 */
export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  (
    { value, onChange, suffix, size = 'md', invalid = false, className, onKeyDown, onBlur, ...props },
    ref,
  ) => {
    const t = useT();
    const currency = suffix === undefined ? t('common.currency') : suffix;
    const [text, setText] = React.useState(() => (value > 0 ? groupDigits(String(value)) : ''));
    const lastValue = React.useRef(value);

    // Tashqi qiymat oʻzgarsa (tez tugmalar) — matnni yangilash
    React.useEffect(() => {
      if (value !== lastValue.current) {
        lastValue.current = value;
        setText(value > 0 ? groupDigits(String(value)) : '');
      }
    }, [value]);

    const commit = (raw: string) => {
      const n = parseAmount(raw);
      lastValue.current = n;
      setText(n > 0 ? groupDigits(String(n)) : raw.replace(/\D/g, '') === '0' ? '0' : '');
      onChange(n);
    };

    return (
      <div className={cn('relative', className)}>
        <Input
          ref={ref}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={text}
          aria-invalid={invalid || undefined}
          onChange={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault();
              const step = e.shiftKey ? 10_000 : 1_000;
              const next = Math.max(0, value + (e.key === 'ArrowUp' ? step : -step));
              commit(String(next));
            }
            onKeyDown?.(e);
          }}
          onBlur={(e) => {
            commit(e.target.value);
            onBlur?.(e);
          }}
          className={cn(
            'tabular font-medium',
            size === 'lg' ? 'h-14 pr-16 font-heading text-2xl font-bold' : 'pr-14 text-base',
            invalid && 'border-danger focus-visible:ring-destructive/25',
          )}
          {...props}
        />
        {currency ? (
          <span
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute inset-y-0 right-3 flex items-center text-text-muted',
              size === 'lg' ? 'text-base' : 'text-sm',
            )}
          >
            {currency}
          </span>
        ) : null}
      </div>
    );
  },
);
MoneyInput.displayName = 'MoneyInput';
