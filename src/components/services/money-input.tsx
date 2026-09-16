'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { groupDigits } from '@/lib/money';
import { useT } from '@/i18n/client';

export interface MoneyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'size'> {
  /** Butun soʻm (yoki "125 000" koʻrinishidagi matn) */
  value: number | string | null | undefined;
  onChange: (value: number) => void;
  /** Manfiy qiymatga ruxsat (ommaviy ± soʻm) */
  signed?: boolean;
  /** Oʻng tomondagi qoʻshimcha (default: valyuta; `null` — yoʻq) */
  suffix?: React.ReactNode | null;
  invalid?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  inputClassName?: string;
}

/** "-12 500" / "12500" → butun number (boʻsh → 0) */
export function parseMoneyText(raw: string, signed = false): number {
  const neg = signed && raw.trim().startsWith('-');
  const digits = raw.replace(/\D/g, '');
  if (!digits) return 0;
  const n = Number(digits);
  return neg ? -n : n;
}

/** Number → "12 500" (ishorali boʻlsa "−" bilan) */
export function formatMoneyText(v: number | string | null | undefined, signed = false): string {
  if (v === null || v === undefined || v === '') return '';
  const n = typeof v === 'number' ? v : parseMoneyText(String(v), signed);
  if (!Number.isFinite(n)) return '';
  const grouped = groupDigits(String(Math.abs(Math.trunc(n))));
  return n < 0 && signed ? `-${grouped}` : grouped;
}

/**
 * Pul maydoni: yozayotganda raqamlar guruhlanadi ("1 250 000"), qiymat sifatida butun number qaytaradi.
 * Klaviatura: raqamlar, Backspace; `signed` boʻlsa "-" ham.
 */
export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  (
    { value, onChange, signed = false, suffix, invalid, size = 'md', className, inputClassName, onBlur, onFocus, ...rest },
    ref,
  ) => {
    const t = useT();
    const [text, setText] = React.useState(() => formatMoneyText(value, signed));
    const [focused, setFocused] = React.useState(false);
    const lastEmitted = React.useRef<number | null>(typeof value === 'number' ? value : null);

    // Tashqi qiymat oʻzgarsa (masalan forma reset) — matnni moslash (faqat fokus boʻlmaganda)
    React.useEffect(() => {
      if (focused) return;
      const n = typeof value === 'number' ? value : value ? parseMoneyText(String(value), signed) : null;
      if (n !== lastEmitted.current) {
        lastEmitted.current = n;
        setText(formatMoneyText(value, signed));
      }
    }, [value, signed, focused]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const neg = signed && raw.trim().startsWith('-');
      const digits = raw.replace(/\D/g, '').slice(0, 12);
      const nextText = digits ? `${neg ? '-' : ''}${groupDigits(digits)}` : neg ? '-' : '';
      setText(nextText);
      const n = parseMoneyText(nextText, signed);
      lastEmitted.current = n;
      onChange(n);
    };

    const suffixNode = suffix === undefined ? t('common.currency') : suffix;

    return (
      <div className={cn('relative', className)}>
        <input
          ref={ref}
          type="text"
          inputMode={signed ? 'text' : 'numeric'}
          autoComplete="off"
          value={text}
          onChange={handleChange}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            if (text === '-') setText('');
            onBlur?.(e);
          }}
          aria-invalid={invalid || undefined}
          className={cn(
            'flex w-full rounded-md border border-line bg-bg-elevated text-text shadow-sm transition-[border-color,box-shadow] duration-150 tabular',
            'placeholder:text-muted-foreground/75 hover:border-[#2B3A57]',
            'focus-visible:border-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-destructive/25',
            size === 'sm' ? 'h-9 px-2.5 text-sm' : 'h-10 px-3 text-sm',
            suffixNode ? (size === 'sm' ? 'pr-12' : 'pr-14') : '',
            'text-right',
            inputClassName,
          )}
          placeholder="0"
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
MoneyInput.displayName = 'MoneyInput';
