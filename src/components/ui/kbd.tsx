import * as React from 'react';
import { cn } from '@/lib/utils';

export type KbdProps = React.HTMLAttributes<HTMLElement>;

/** Klaviatura tugmasi koʻrinishi: <Kbd>⌘</Kbd><Kbd>K</Kbd> */
const Kbd = React.forwardRef<HTMLElement, KbdProps>(({ className, ...props }, ref) => (
  <kbd ref={ref} className={cn('kbd', className)} {...props} />
));
Kbd.displayName = 'Kbd';

export { Kbd };
