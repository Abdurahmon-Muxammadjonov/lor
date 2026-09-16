import * as React from 'react';
import { cn } from '@/lib/utils';
import { formatPercent } from '@/lib/reports/format';

export interface ShareBarProps {
  /** Foiz (0..100) */
  percent: number;
  color?: string;
  className?: string;
  /** Foiz matnini yashirish */
  hideLabel?: boolean;
  label?: string;
}

/** Jadval ichidagi ulush chizigʻi: yupqa trek + rangli toʻldirish + tabular foiz (server-safe) */
export function ShareBar({ percent, color = '#00A3C4', className, hideLabel = false, label }: ShareBarProps) {
  const pct = Math.min(100, Math.max(0, Number.isFinite(percent) ? percent : 0));
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct * 10) / 10}
        aria-label={label}
        className="h-1.5 w-full min-w-[48px] max-w-[140px] overflow-hidden rounded-full bg-secondary"
      >
        <div className="h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      {hideLabel ? null : <span className="w-14 shrink-0 text-right text-xs text-text-muted tabular">{formatPercent(pct)}</span>}
    </div>
  );
}
