'use client';

import * as React from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { QUANTITY_MAX, formatQuantity, snapQuantity } from '@/lib/calc';
import { useLocale } from '@/i18n/client';

export type NumberStepperSize = 'sm' | 'md' | 'lg';

export interface NumberStepperProps {
  value: number;
  onChange: (v: number) => void;
  /** Qadam (default 0.5) */
  step?: number;
  min?: number;
  max?: number;
  /** `false` boʻlsa yarim qadam taqiqlanadi (qadam butun songa keltiriladi) */
  allowHalf?: boolean;
  disabled?: boolean;
  size?: NumberStepperSize;
  className?: string;
  ariaLabel?: string;
  /** "qadam 0.5" koʻrsatkichini yashirish */
  hideHint?: boolean;
  id?: string;
  name?: string;
}

const SIZE: Record<NumberStepperSize, { btn: string; input: string; icon: string; hint: string }> = {
  sm: { btn: 'size-8', input: 'h-8 w-12 text-sm', icon: 'size-3.5', hint: 'text-[10px]' },
  md: { btn: 'size-10', input: 'h-10 w-16 text-base', icon: 'size-4', hint: 'text-[11px]' },
  lg: { btn: 'size-12', input: 'h-12 w-20 text-lg', icon: 'size-5', hint: 'text-xs' },
};

const HINT: Record<'uz' | 'ru', { step: string; inc: string; dec: string; value: string }> = {
  uz: { step: 'qadam', inc: 'Koʻpaytirish', dec: 'Kamaytirish', value: 'Miqdor' },
  ru: { step: 'шаг', inc: 'Увеличить', dec: 'Уменьшить', value: 'Количество' },
};

function decimalsOf(step: number): number {
  const s = String(step);
  const i = s.indexOf('.');
  return i === -1 ? 0 : Math.min(4, s.length - i - 1);
}

function effectiveStep(step: number, allowHalf: boolean): number {
  const s = Number.isFinite(step) && step > 0 ? step : 0.5;
  return !allowHalf && s < 1 ? 1 : s;
}

/** Eng yaqin toʻgʻri qiymatga keltirish + chegaralash */
export function normalizeStepperValue(
  raw: number,
  opts: { step?: number; min?: number; max?: number; allowHalf?: boolean },
): number {
  const allowHalf = opts.allowHalf ?? true;
  const step = effectiveStep(opts.step ?? 0.5, allowHalf);
  const decimals = decimalsOf(step);
  const lo = opts.min ?? (step === 0.5 || step === 1 ? step : 0);
  const hi = opts.max ?? QUANTITY_MAX;

  let v: number;
  if (step === 0.5 || step === 1) {
    v = snapQuantity(raw, step === 0.5);
  } else if (!Number.isFinite(raw)) {
    v = lo;
  } else {
    v = Math.round(raw / step) * step;
  }
  v = Math.min(hi, Math.max(lo, v));
  return Number(v.toFixed(Math.max(decimals, decimalsOf(lo), decimalsOf(hi))));
}

function fmt(v: number, step: number): string {
  const d = decimalsOf(step);
  if (!Number.isFinite(v)) return '';
  return d <= 1 ? formatQuantity(v) : v.toFixed(d);
}

/**
 * [−] [qiymat] [+] — miqdor tanlagich. Yozish mumkin; blur/Enter da qadamga yaxlitlanadi va chegaralanadi.
 * Qabul mezoni #4: allowHalf=false → 0.5 rad etiladi (qadam 1 ga keltiriladi).
 */
const NumberStepper = React.forwardRef<HTMLInputElement, NumberStepperProps>(
  (
    {
      value,
      onChange,
      step = 0.5,
      min,
      max,
      allowHalf = true,
      disabled = false,
      size = 'md',
      className,
      ariaLabel,
      hideHint = false,
      id,
      name,
    },
    ref,
  ) => {
    const { locale } = useLocale();
    const labels = HINT[locale];
    const effStep = effectiveStep(step, allowHalf);
    const lo = min ?? (effStep === 0.5 || effStep === 1 ? effStep : 0);
    const hi = max ?? QUANTITY_MAX;
    const normalize = React.useCallback(
      (raw: number) => normalizeStepperValue(raw, { step: effStep, min: lo, max: hi, allowHalf }),
      [effStep, lo, hi, allowHalf],
    );

    const [editing, setEditing] = React.useState(false);
    const [text, setText] = React.useState('');
    const inputRef = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

    const commit = React.useCallback(
      (next: number) => {
        const n = normalize(next);
        if (n !== value) onChange(n);
        return n;
      },
      [normalize, onChange, value],
    );

    const canDec = !disabled && value - effStep >= lo - 1e-9;
    const canInc = !disabled && value + effStep <= hi + 1e-9;

    const dec = () => {
      if (!canDec) return;
      commit(Number((value - effStep).toFixed(4)));
    };
    const inc = () => {
      if (!canInc) return;
      commit(Number((value + effStep).toFixed(4)));
    };

    const startEdit = () => {
      setText(fmt(value, effStep));
      setEditing(true);
      window.requestAnimationFrame(() => inputRef.current?.select());
    };

    const finishEdit = () => {
      if (!editing) return;
      const parsed = Number.parseFloat(text.replace(',', '.'));
      if (Number.isFinite(parsed)) commit(parsed);
      setEditing(false);
    };

    const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      if (!/^-?\d*[.,]?\d*$/.test(v)) return;
      if (!editing) setEditing(true);
      setText(v);
    };

    const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      switch (e.key) {
        case 'Enter':
          e.preventDefault();
          finishEdit();
          break;
        case 'Escape':
          e.preventDefault();
          setEditing(false);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setEditing(false);
          inc();
          break;
        case 'ArrowDown':
          e.preventDefault();
          setEditing(false);
          dec();
          break;
        default:
          break;
      }
    };

    const s = SIZE[size];
    const btnClass = cn(
      'inline-flex shrink-0 items-center justify-center text-text-muted transition-colors',
      'hover:bg-surface hover:text-text active:bg-secondary',
      'focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
      'disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent',
      s.btn,
    );
    const stepLabel = fmt(effStep, effStep);

    return (
      <div className={cn('inline-flex flex-col items-start gap-1', className)}>
        <div
          role="group"
          aria-label={ariaLabel ?? labels.value}
          className={cn(
            'inline-flex items-stretch overflow-hidden rounded-md border border-line bg-bg-elevated shadow-sm transition-[border-color,box-shadow]',
            'focus-within:border-accent focus-within:ring-[3px] focus-within:ring-ring/25',
            disabled && 'opacity-60',
          )}
        >
          <button
            type="button"
            onClick={dec}
            disabled={!canDec}
            aria-label={labels.dec}
            className={cn(btnClass, 'border-r border-line')}
          >
            <Minus className={s.icon} strokeWidth={2.5} aria-hidden="true" />
          </button>
          <input
            ref={inputRef}
            id={id}
            name={name}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            role="spinbutton"
            aria-label={ariaLabel ?? labels.value}
            aria-valuemin={lo}
            aria-valuemax={hi}
            aria-valuenow={value}
            aria-valuetext={fmt(value, effStep)}
            disabled={disabled}
            value={editing ? text : fmt(value, effStep)}
            onFocus={startEdit}
            onBlur={finishEdit}
            onChange={onInputChange}
            onKeyDown={onInputKeyDown}
            className={cn(
              'tabular bg-transparent text-center font-semibold text-text outline-none',
              'disabled:cursor-not-allowed',
              s.input,
            )}
          />
          <button
            type="button"
            onClick={inc}
            disabled={!canInc}
            aria-label={labels.inc}
            className={cn(btnClass, 'border-l border-line')}
          >
            <Plus className={s.icon} strokeWidth={2.5} aria-hidden="true" />
          </button>
        </div>
        {hideHint ? null : (
          <span className={cn('pl-0.5 leading-none text-text-muted', s.hint)} aria-hidden="true">
            {labels.step} {stepLabel}
            {allowHalf ? '' : ' · 1, 2, 3…'}
          </span>
        )}
      </div>
    );
  },
);
NumberStepper.displayName = 'NumberStepper';

export { NumberStepper };
