import * as React from 'react';
import { cn } from '@/lib/utils';

export type SkeletonProps = React.HTMLAttributes<HTMLDivElement>;

/** Yuklanish holati uchun shimmer effektli toʻrtburchak */
function Skeleton({ className, ...props }: SkeletonProps) {
  return <div aria-hidden="true" className={cn('shimmer rounded-md', className)} {...props} />;
}

export { Skeleton };
