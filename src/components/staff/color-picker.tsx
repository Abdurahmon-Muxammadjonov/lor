'use client';

import * as React from 'react';
import { Check } from 'lucide-react';
import { useT } from '@/i18n/client';
import { cn } from '@/lib/utils';
import { STAFF_COLORS } from '@/lib/staff/schemas';
import { hexToRgba, safeHex } from '@/lib/staff/color';

export interface ColorPickerProps {
  value: string;
  onChange: (hex: string) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
}

/** 8 ta palitra tugmasi — radiogroup, strelkalar bilan boshqariladi */
export function ColorPicker({ value, onChange, id, className, disabled = false }: ColorPickerProps) {
  const t = useT();
  const current = safeHex(value);
  const refs = React.useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let next: number | null = null;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % STAFF_COLORS.length;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + STAFF_COLORS.length) % STAFF_COLORS.length;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = STAFF_COLORS.length - 1;
    if (next === null) return;
    e.preventDefault();
    const hex = STAFF_COLORS[next];
    if (hex) {
      onChange(hex);
      refs.current[next]?.focus();
    }
  };

  return (
    <div id={id} role="radiogroup" aria-label={t('staff.form.color')} className={cn('flex flex-wrap gap-2', className)}>
      {STAFF_COLORS.map((hex, idx) => {
        const active = hex === current;
        return (
          <button
            key={hex}
            ref={(el) => {
              refs.current[idx] = el;
            }}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={t('staff.form.colorLabel', { c: hex })}
            tabIndex={active ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(hex)}
            onKeyDown={(e) => onKeyDown(e, idx)}
            className={cn(
              'relative flex size-9 items-center justify-center rounded-full border-2 transition-[transform,box-shadow] duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-elevated',
              'disabled:cursor-not-allowed disabled:opacity-50',
              active ? 'scale-110 border-bg-elevated' : 'border-transparent hover:scale-105',
            )}
            style={{
              backgroundColor: hex,
              boxShadow: active ? `0 0 0 2px ${hex}, 0 0 16px ${hexToRgba(hex, 0.55)}` : `0 0 0 1px ${hexToRgba(hex, 0.35)}`,
            }}
          >
            {active ? <Check className="size-4 text-bg-base" strokeWidth={3} aria-hidden="true" /> : null}
          </button>
        );
      })}
    </div>
  );
}
