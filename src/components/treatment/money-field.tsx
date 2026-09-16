'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { groupDigits } from '@/lib/money';
import { useT } from '@/i18n/client';

export interface MoneyFieldProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'size'
> {
  /** Butun soʻm */
  value: number;
  onChange: (value: number) => void;
  /** Oʻng tomondagi qoʻshimcha (default: valyuta; `null` — yoʻq) */
  suffix?: React.ReactNode | null;
  invalid?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  inputClassName?: string;
  /** Maksimal raqamlar soni (default 12) */
  maxDigits?: number;
}

/** "1 250 000" → 1250000 */
export function parseMoneyField(raw: string): number {
  const digits = raw.replace(/\D/g, '');
  return digits ? Number(digits) : 0;
}

/**
 * Pul maydoni (musbat butun soʻm): yozayotganda raqamlar guruhlanadi ("1 250 000"),
 * qiymat sifatida butun number qaytaradi. Chegirma summasi va shunga oʻxshash maydonlar uchun.
 */
export const MoneyField = React.forwardRef<HTMLInputElement, MoneyFieldProps>(
  (
    {
      value,
      onChange,
      suffix,
      invalid,
      size = 'md',
      className,
      inputClassName,
      maxDigits = 12,
      onFocus,
      onBlur,
      ...rest
    },
    ref,
  ) => {
    const t = useT();
    const [focused, setFocused] = React.useState(false);
    const [text, setText] = React.useState(() => (value > 0 ? groupDigits(String(Math.trunc(value))) : ''));
    const lastEmitted = React.useRef(value);

    React.useEffect(() => {
      if (focused) return;
      if (value !== lastEmitted.current) {
        lastEmitted.current = value;
        setText(value > 0 ? groupDigits(String(Math.trunc(value))) : '');
      }
    }, [value, focused]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const digits = e.target.value.replace(/\D/g, '').slice(0, maxDigits);
      setText(digits ? groupDigits(digits) : '');
      const n = digits ? Number(digits) : 0;
      lastEmitted.current = n;
      onChange(n);
    };

    const suffixNode = suffix === undefined ? t('common.currency') : suffix;

    return (
      <div className={cn('relative', className)}>
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={text}
          onChange={handleChange}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          aria-invalid={invalid || undefined}
          placeholder="0"
          className={cn(
            'tabular flex w-full rounded-md border border-line bg-bg-elevated text-right text-text shadow-sm transition-[border-color,box-shadow] duration-150',
            'placeholder:text-muted-foreground/75 hover:border-[#2B3A57]',
            'focus-visible:border-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-destructive/25',
            size === 'sm' ? 'h-9 px-2.5 text-sm' : 'h-10 px-3 text-sm',
            suffixNode ? (size === 'sm' ? 'pr-12' : 'pr-14') : '',
            inputClassName,
          )}
          {...rest}
        />
        {suffixNode ? (
          <span
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-muted',
              size === 'sm' ? 'text-xs' : 'text-sm',
            )}
          >
            {suffixNode}
          </span>
        ) : null}
      </div>
    );
  },
);
MoneyField.displayName = 'MoneyField';
