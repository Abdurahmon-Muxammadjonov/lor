import * as React from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export interface LoadingBlockProps {
  /** Qatorlar soni (default 3) */
  rows?: number;
  className?: string;
  /** Qator balandligi klassi (default h-4) */
  rowClassName?: string;
}

const WIDTHS = ['w-full', 'w-11/12', 'w-4/5', 'w-2/3', 'w-3/4', 'w-5/6'] as const;

/** Matn qatorlari skeletoni */
export function LoadingBlock({ rows = 3, className, rowClassName }: LoadingBlockProps) {
  return (
    <div className={cn('space-y-2.5', className)} aria-busy="true" aria-hidden="true">
      {Array.from({ length: Math.max(1, rows) }).map((_, i) => (
        <Skeleton key={i} className={cn('h-4', WIDTHS[i % WIDTHS.length], rowClassName)} />
      ))}
    </div>
  );
}

export interface PageSkeletonProps {
  /** Statistika kartalari soni (default 4; 0 — koʻrsatilmaydi) */
  stats?: number;
  /** Jadval qatorlari (default 6) */
  rows?: number;
  className?: string;
}

/** Butun sahifa skeletoni: sarlavha + statistika kartalari + jadval */
export function PageSkeleton({ stats = 4, rows = 6, className }: PageSkeletonProps) {
  return (
    <div className={cn('space-y-6', className)} aria-busy="true" aria-hidden="true">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
      {stats > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: stats }).map((_, i) => (
            <div key={i} className="card-surface p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-3 h-8 w-32" />
              <Skeleton className="mt-3 h-4 w-28" />
            </div>
          ))}
        </div>
      ) : null}
      <div className="card-surface overflow-hidden">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <Skeleton className="h-9 w-64 max-w-full" />
          <Skeleton className="ml-auto h-9 w-24" />
        </div>
        <div className="divide-y divide-line">
          {Array.from({ length: Math.max(1, rows) }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5">
              <Skeleton className="size-8 rounded-full" />
              <Skeleton className="h-4 w-40" />
              <Skeleton className="hidden h-4 w-28 md:block" />
              <Skeleton className="hidden h-4 w-24 lg:block" />
              <Skeleton className="ml-auto h-5 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
