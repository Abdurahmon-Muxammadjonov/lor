'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  [
    'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium',
    'transition-[background-color,color,box-shadow,border-color,transform,filter,opacity] duration-200 ease-out',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base',
    'disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
    '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
  ].join(' '),
  {
    variants: {
      variant: {
        default: 'bg-accent text-bg-base shadow-sm hover:bg-[#33DDFF] hover:shadow-glow',
        secondary: 'bg-secondary text-text shadow-sm hover:bg-[#28354F]',
        outline: 'border border-line bg-transparent text-text hover:border-[#2B3A57] hover:bg-surface',
        ghost: 'text-text-muted hover:bg-surface hover:text-text',
        destructive: 'bg-danger text-bg-base shadow-sm hover:bg-[#FF6683]',
        link: 'h-auto px-0 text-accent underline-offset-4 hover:underline',
        gradient:
          'bg-gradient-accent text-bg-base shadow-[0_0_0_1px_rgba(0,212,255,0.15)] hover:shadow-glow hover:brightness-110',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3 text-xs',
        lg: 'h-12 rounded-lg px-6 text-base',
        xl: 'h-14 rounded-lg px-8 text-lg [&_svg]:size-5',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Radix Slot orqali bolani (masalan <Link>) tugma sifatida koʻrsatish */
  asChild?: boolean;
  /** Yuklanish holati: spinner koʻrsatadi va tugmani oʻchiradi */
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const classes = cn(buttonVariants({ variant, size, className }));

    if (asChild) {
      return (
        <Slot className={classes} ref={ref} aria-busy={loading || undefined} data-loading={loading || undefined} {...props}>
          {children}
        </Slot>
      );
    }

    return (
      <button
        className={classes}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        data-loading={loading || undefined}
        {...props}
      >
        {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
        {children}
      </button>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
