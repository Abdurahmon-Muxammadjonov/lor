import * as React from 'react';
import { cn } from '@/lib/utils';

export type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASS: Record<SpinnerSize, string> = {
  xs: 'size-3 border-[1.5px]',
  sm: 'size-4 border-2',
  md: 'size-6 border-2',
  lg: 'size-8 border-[3px]',
  xl: 'size-12 border-4',
};

export interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: SpinnerSize;
  /** Ekran oʻquvchilar uchun nom; berilmasa dekorativ (aria-hidden) */
  label?: string;
}

/** Aylanuvchi yuklanish indikatori (CSS, kutubxonasiz) */
const Spinner = React.forwardRef<HTMLSpanElement, SpinnerProps>(({ size = 'md', label, className, ...props }, ref) => (
  <span
    ref={ref}
    role={label ? 'status' : undefined}
    aria-label={label}
    aria-hidden={label ? undefined : true}
    className={cn(
      'inline-block shrink-0 animate-spin rounded-full border-solid border-current border-t-transparent text-accent',
      SIZE_CLASS[size],
      className,
    )}
    {...props}
  />
));
Spinner.displayName = 'Spinner';

export { Spinner };
