import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SectionTitleProps {
  /** Sarlavha ustidagi kichik yozuv (accent, katta harflar) */
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: 'left' | 'center';
  /** Sarlavha darajasi (default h2) */
  as?: 'h1' | 'h2' | 'h3';
  /** Oʻlcham: landing uchun `lg`, dashboard boʻlimlari uchun `sm` */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Sarlavhada gradient matn */
  gradient?: boolean;
}

const TITLE_SIZE = {
  sm: 'text-xl sm:text-2xl',
  md: 'text-2xl sm:text-3xl md:text-4xl',
  lg: 'text-3xl sm:text-4xl md:text-5xl',
} as const;

const DESC_SIZE = { sm: 'text-sm', md: 'text-base', lg: 'text-base sm:text-lg' } as const;

/**
 * Boʻlim sarlavhasi (landing / dashboard): eyebrow + sarlavha + tavsif.
 *
 *   <SectionTitle eyebrow="Navbat" title="Kiosk va tablo" description="…" align="center" />
 */
export function SectionTitle({ eyebrow, title, description, align = 'left', as = 'h2', size = 'md', className, gradient = false }: SectionTitleProps) {
  const Heading = as;
  const center = align === 'center';
  return (
    <div className={cn('flex flex-col gap-3', center ? 'items-center text-center' : 'items-start text-left', className)}>
      {eyebrow ? (
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
          <span aria-hidden="true" className="h-px w-6 bg-gradient-accent" />
          <span>{eyebrow}</span>
          {center ? <span aria-hidden="true" className="h-px w-6 bg-gradient-accent" /> : null}
        </div>
      ) : null}
      <Heading className={cn('font-heading font-bold tracking-tight text-balance', TITLE_SIZE[size], gradient ? 'text-gradient' : 'text-text')}>
        {title}
      </Heading>
      {description ? <p className={cn('max-w-2xl text-pretty text-text-muted', DESC_SIZE[size])}>{description}</p> : null}
    </div>
  );
}
