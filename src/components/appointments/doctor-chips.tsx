'use client';

import * as React from 'react';
import { Check, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/client';
import type { DoctorOption } from '@/lib/appointments/types';
import { withAlpha } from './constants';

export interface DoctorChipsProps {
  doctors: DoctorOption[];
  /** Boʻsh — barchasi */
  selected: string[];
  onChange: (ids: string[]) => void;
  className?: string;
}

/** Shifokor filtri: rangli chiplar, bir nechtasini tanlash mumkin; "Barchasi" — filtrni tozalaydi */
export function DoctorChips({ doctors, selected, onChange, className }: DoctorChipsProps) {
  const t = useT();
  const allActive = selected.length === 0;
  if (doctors.length === 0) return null;

  const toggle = (id: string) => {
    if (selected.includes(id)) onChange(selected.filter((x) => x !== id));
    else onChange([...selected, id]);
  };

  return (
    <div
      className={cn('flex flex-wrap items-center gap-1.5', className)}
      role="group"
      aria-label={t('appointments.filter.doctors')}
    >
      <button
        type="button"
        aria-pressed={allActive}
        onClick={() => onChange([])}
        className={cn(
          'inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base',
          allActive
            ? 'border-primary/60 bg-primary/10 text-accent'
            : 'border-line bg-bg-elevated text-text-muted hover:border-[#2B3A57] hover:text-text',
        )}
      >
        <Users className="size-3.5" aria-hidden="true" />
        {t('appointments.filter.allDoctors')}
      </button>
      {doctors.map((d) => {
        const active = selected.includes(d.id);
        return (
          <button
            key={d.id}
            type="button"
            aria-pressed={active}
            onClick={() => toggle(d.id)}
            title={d.specialty ?? undefined}
            style={
              active
                ? { borderColor: withAlpha(d.color, 0.7), backgroundColor: withAlpha(d.color, 0.14) }
                : undefined
            }
            className={cn(
              'inline-flex h-8 max-w-[14rem] items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base',
              active
                ? 'text-text'
                : 'border-line bg-bg-elevated text-text-muted hover:border-[#2B3A57] hover:text-text',
            )}
          >
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-full ring-1 ring-black/30"
              style={{ backgroundColor: d.color }}
            />
            <span className="truncate">{d.fullName}</span>
            {d.room ? (
              <span className="shrink-0 text-[10px] uppercase tracking-wider opacity-70">{d.room}</span>
            ) : null}
            {active ? <Check className="size-3.5 shrink-0" aria-hidden="true" /> : null}
          </button>
        );
      })}
    </div>
  );
}
