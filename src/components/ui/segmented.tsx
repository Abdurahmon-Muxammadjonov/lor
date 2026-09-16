'use client';

import * as React from 'react';
import { LayoutGroup, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export type SegmentedSize = 'sm' | 'md' | 'lg';

export interface SegmentedProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: SegmentedOption<T>[];
  size?: SegmentedSize;
  className?: string;
  ariaLabel?: string;
  /** Faol indikator uslubi: `default` — yuza, `accent` — gradient */
  variant?: 'default' | 'accent';
  /** Toʻliq kenglik, variantlar teng boʻlinadi */
  fullWidth?: boolean;
  disabled?: boolean;
}

const SIZE: Record<SegmentedSize, { root: string; item: string; inner: string }> = {
  sm: { root: 'h-8 p-0.5 text-xs', item: 'px-2.5', inner: 'gap-1 [&_svg]:size-3.5' },
  md: { root: 'h-10 p-1 text-sm', item: 'px-3.5', inner: 'gap-1.5 [&_svg]:size-4' },
  lg: { root: 'h-12 p-1 text-base', item: 'px-5', inner: 'gap-2 [&_svg]:size-5' },
};

/**
 * Pill koʻrinishidagi radio-guruh (sirpanuvchi faol indikator, framer-motion layoutId).
 *
 *   <Segmented value={type} onChange={setType} options={[{ value: 'ADULT', label: 'Kattalar' }, ...]} />
 */
function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
  className,
  ariaLabel,
  variant = 'default',
  fullWidth = false,
  disabled = false,
}: SegmentedProps<T>) {
  const id = React.useId();
  const reduced = useReducedMotion();
  const refs = React.useRef<Map<T, HTMLButtonElement>>(new Map());

  const enabledOptions = options.filter((o) => !o.disabled);
  const hasActive = options.some((o) => o.value === value);
  const firstEnabled = enabledOptions[0];

  const selectAndFocus = (opt: SegmentedOption<T> | undefined) => {
    if (!opt) return;
    onChange(opt.value);
    refs.current.get(opt.value)?.focus();
  };

  const move = (dir: 1 | -1) => {
    if (enabledOptions.length === 0) return;
    const idx = enabledOptions.findIndex((o) => o.value === value);
    const nextIdx = idx === -1 ? 0 : (idx + dir + enabledOptions.length) % enabledOptions.length;
    selectAndFocus(enabledOptions[nextIdx]);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        move(1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        move(-1);
        break;
      case 'Home':
        e.preventDefault();
        selectAndFocus(enabledOptions[0]);
        break;
      case 'End':
        e.preventDefault();
        selectAndFocus(enabledOptions[enabledOptions.length - 1]);
        break;
      default:
        break;
    }
  };

  const s = SIZE[size];

  return (
    <LayoutGroup id={id}>
      <div
        role="radiogroup"
        aria-label={ariaLabel}
        aria-disabled={disabled || undefined}
        onKeyDown={onKeyDown}
        className={cn(
          'relative inline-flex items-stretch rounded-lg border border-line bg-bg-elevated',
          s.root,
          fullWidth && 'flex w-full',
          disabled && 'pointer-events-none opacity-50',
          className,
        )}
      >
        {options.map((o) => {
          const active = o.value === value;
          const isTabStop = active || (!hasActive && firstEnabled?.value === o.value);
          return (
            <button
              key={o.value}
              ref={(el) => {
                if (el) refs.current.set(o.value, el);
                else refs.current.delete(o.value);
              }}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={isTabStop ? 0 : -1}
              disabled={disabled || o.disabled}
              onClick={() => onChange(o.value)}
              className={cn(
                'relative inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-elevated',
                'disabled:cursor-not-allowed disabled:opacity-40',
                s.item,
                fullWidth && 'flex-1',
                active ? (variant === 'accent' ? 'text-bg-base' : 'text-text') : 'text-text-muted hover:text-text',
              )}
            >
              {active ? (
                <motion.span
                  layoutId={`${id}-indicator`}
                  aria-hidden="true"
                  className={cn(
                    'absolute inset-0 rounded-md',
                    variant === 'accent'
                      ? 'bg-gradient-accent shadow-[0_0_0_1px_rgba(0,212,255,0.2),0_4px_14px_-4px_rgba(0,212,255,0.5)]'
                      : 'bg-surface shadow-[0_1px_0_0_rgba(255,255,255,0.05)_inset,0_1px_3px_rgba(0,0,0,0.45)] ring-1 ring-line',
                  )}
                  transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 42, mass: 0.8 }}
                />
              ) : null}
              <span className={cn('relative z-10 inline-flex items-center', s.inner)}>
                {o.icon ? <span className="inline-flex shrink-0 items-center">{o.icon}</span> : null}
                {o.label}
              </span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
Segmented.displayName = 'Segmented';

export { Segmented };
