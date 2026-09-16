import * as React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** Kalendar yuklanish holati (server-safe): panel + ustunli toʻr */
export function CalendarSkeleton({
  columns = 3,
  rows = 8,
  withToolbar = false,
  className,
}: {
  columns?: number;
  rows?: number;
  withToolbar?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-4', className)} aria-busy="true" aria-live="polite">
      {withToolbar ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Skeleton className="h-9 w-20 rounded-md" />
            <Skeleton className="h-9 w-20 rounded-md" />
            <Skeleton className="h-9 w-56 rounded-md" />
            <div className="ml-auto flex gap-2">
              <Skeleton className="h-8 w-36 rounded-full" />
              <Skeleton className="h-9 w-32 rounded-md" />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-8 w-32 rounded-full" />
            ))}
          </div>
        </div>
      ) : null}
      <div className="glass overflow-hidden rounded-xl">
        <div className="grid" style={{ gridTemplateColumns: `3.5rem repeat(${columns}, minmax(0, 1fr))` }}>
          <div className="border-b border-r border-line" />
          {Array.from({ length: columns }, (_, i) => (
            <div key={i} className="border-b border-l border-line p-3">
              <Skeleton className="mb-2 h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
          {Array.from({ length: rows }, (_, r) => (
            <React.Fragment key={r}>
              <div className="flex h-14 items-start justify-end border-r border-line pr-2 pt-1">
                <Skeleton className="h-3 w-8" />
              </div>
              {Array.from({ length: columns }, (_, c) => (
                <div key={c} className="h-14 border-l border-t border-line p-1">
                  {(r + c) % 3 === 0 ? <Skeleton className="h-full w-full rounded-md" /> : null}
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
