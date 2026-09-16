'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface DashboardCardProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Sarlavha oʻng tomonidagi tugmalar / toggle */
  actions?: React.ReactNode;
  /** Qayta yuklanmoqda — oldingi render xira holda saqlanadi (skeleton emas) */
  dimmed?: boolean;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

/** Bosh sahifa paneli: shisha karta, sarlavha + tavsif + amallar, kontent */
export function DashboardCard({ title, description, actions, dimmed = false, className, bodyClassName, children }: DashboardCardProps) {
  const id = React.useId();
  return (
    <section aria-labelledby={id} className={cn('glass flex min-w-0 flex-col p-5', className)} aria-busy={dimmed || undefined}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <h2 id={id} className="font-heading text-base font-bold leading-tight text-text">
            {title}
          </h2>
          {description ? <p className="mt-0.5 text-xs text-text-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
      <div className={cn('mt-4 min-w-0 flex-1 transition-opacity duration-300', dimmed && 'opacity-60', bodyClassName)}>{children}</div>
    </section>
  );
}
