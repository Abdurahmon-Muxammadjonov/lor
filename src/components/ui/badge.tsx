import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold leading-5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base [&_svg]:size-3.5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-accent text-bg-base',
        secondary: 'border-transparent bg-secondary text-text',
        outline: 'border-line bg-transparent text-text-muted',
        success: 'border-[#00FFB2]/20 bg-[#00FFB2]/10 text-[#00FFB2]',
        warning: 'border-warning/25 bg-warning/10 text-warning',
        danger: 'border-destructive/25 bg-destructive/10 text-danger',
        accent: 'border-primary/25 bg-primary/10 text-accent',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  /** Chap tomonda kichik nuqta (holat indikatori) */
  dot?: boolean;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(({ className, variant, dot, children, ...props }, ref) => (
  <span ref={ref} className={cn(badgeVariants({ variant }), className)} {...props}>
    {dot ? <span aria-hidden="true" className="size-1.5 rounded-full bg-current" /> : null}
    {children}
  </span>
));
Badge.displayName = 'Badge';

export { Badge, badgeVariants };
