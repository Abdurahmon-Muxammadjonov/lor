'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface ReportCardProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Oʻng tomondagi boshqaruvlar (Segmented, tugmalar) */
  actions?: React.ReactNode;
  /** Qayta yuklanish paytida oldingi natija xira koʻrsatiladi (skeleton miltillamaydi) */
  dimmed?: boolean;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  /** Sarlavha darajasi (default h2) */
  as?: 'h2' | 'h3';
}

/** Hisobot boʻlimi kartasi — shisha yuza, sarlavha + tavsif + boshqaruvlar */
export function ReportCard({ title, description, actions, dimmed = false, children, className, contentClassName, as = 'h2' }: ReportCardProps) {
  const Heading = as;
  return (
    <section
      aria-busy={dimmed || undefined}
      className={cn('glass relative flex flex-col p-4 transition-opacity duration-300 sm:p-5', dimmed && 'opacity-60', className)}
    >
      <header className="mb-4 flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <Heading className="font-heading text-base font-semibold tracking-tight text-text">{title}</Heading>
          {description ? <p className="mt-0.5 text-xs text-text-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
      <div className={cn('min-w-0 flex-1', contentClassName)}>{children}</div>
    </section>
  );
}
