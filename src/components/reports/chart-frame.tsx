'use client';

import * as React from 'react';
import { BarChart3, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/client';
import { useMounted } from '@/hooks/use-mounted';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';

export interface ChartFrameProps {
  height: number;
  loading?: boolean;
  empty?: boolean;
  emptyTitle?: React.ReactNode;
  emptyDescription?: React.ReactNode;
  emptyIcon?: LucideIcon;
  className?: string;
  children: React.ReactNode;
}

/**
 * Grafik konteyneri: brauzerda montaj boʻlguncha (ResponsiveContainer serverda 0 kenglik) va yuklanishda skeleton,
 * boʻsh maʼlumotda EmptyState, aks holda belgilangan balandlikdagi grafik.
 */
export function ChartFrame({ height, loading = false, empty = false, emptyTitle, emptyDescription, emptyIcon, className, children }: ChartFrameProps) {
  const t = useT();
  const mounted = useMounted();
  if (loading || !mounted) {
    return (
      <div className={cn('flex flex-col justify-end gap-2', className)} style={{ height }} aria-hidden="true">
        <div className="flex h-full items-end gap-2 px-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="w-full rounded-t-md" style={{ height: `${28 + ((i * 37) % 60)}%` }} />
          ))}
        </div>
        <Skeleton className="h-3 w-full" />
      </div>
    );
  }
  if (empty) {
    return (
      <div className={cn('flex items-center justify-center', className)} style={{ minHeight: height }}>
        <EmptyState compact icon={emptyIcon ?? BarChart3} title={emptyTitle ?? t('reports.empty.title')} description={emptyDescription ?? t('reports.empty.description')} />
      </div>
    );
  }
  return (
    <div className={cn('w-full', className)} style={{ height }}>
      {children}
    </div>
  );
}
