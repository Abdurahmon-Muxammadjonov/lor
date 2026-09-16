import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface SectionProps {
  id?: string;
  className?: string;
  containerClassName?: string;
  children: ReactNode;
  /** Boʻlim sarlavhasi (h2) id si — landmark nomi uchun */
  labelledBy?: string;
}

/** Landing boʻlimi: yopishqoq navbar uchun scroll-margin + container. Server-safe. */
export function Section({ id, className, containerClassName, children, labelledBy }: SectionProps) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn('relative scroll-mt-20 py-20 md:py-28', className)}
    >
      <div className={cn('container', containerClassName)}>{children}</div>
    </section>
  );
}
