import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-md border border-line bg-bg-elevated px-3 py-2 text-sm text-text shadow-sm transition-[border-color,box-shadow,background-color] duration-150',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-text',
        'placeholder:text-muted-foreground/75',
        'hover:border-[#2B3A57]',
        'focus-visible:border-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:ring-destructive/25',
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = 'Input';

export { Input };
