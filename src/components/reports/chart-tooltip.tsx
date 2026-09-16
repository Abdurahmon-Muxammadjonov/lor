'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ChartTooltipRow {
  key: string;
  label: React.ReactNode;
  value: React.ReactNode;
  /** Seriya rangi (kalit belgisi) */
  color?: string;
  /** Kalit shakli: chiziq (line) yoki toʻrtburchak (bar/pie) */
  kind?: 'line' | 'rect';
}

/** Recharts uchun umumiy tooltip qobigʻi: sarlavha + qatorlar (qiymat oldinda, matn tokenlarida) */
export function ChartTooltipFrame({ title, rows, className }: { title?: React.ReactNode; rows: ChartTooltipRow[]; className?: string }) {
  return (
    <div role="presentation" className={cn('glass-strong min-w-[170px] rounded-lg px-3 py-2.5 text-xs shadow-card', className)}>
      {title ? <div className="mb-1.5 font-medium text-text-muted">{title}</div> : null}
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center gap-2">
            {r.color ? (
              <span
                aria-hidden="true"
                className={cn('inline-block shrink-0', r.kind === 'line' ? 'h-0.5 w-3 rounded-full' : 'size-2.5 rounded-[2px]')}
                style={{ backgroundColor: r.color }}
              />
            ) : null}
            <span className="font-heading text-sm font-bold text-text tabular">{r.value}</span>
            <span className="text-text-muted">{r.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface ChartLegendItem {
  key: string;
  label: React.ReactNode;
  color: string;
  kind?: 'line' | 'rect';
}

/** Legenda — 2+ seriya boʻlganda doim koʻrsatiladi (rang yagona identifikator boʻlmasligi uchun) */
export function ChartLegend({ items, className }: { items: ChartLegendItem[]; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted', className)} aria-label="Legenda">
      {items.map((i) => (
        <li key={i.key} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={cn('inline-block shrink-0', i.kind === 'line' ? 'h-0.5 w-3.5 rounded-full' : 'size-2.5 rounded-[2px]')}
            style={{ backgroundColor: i.color }}
          />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
