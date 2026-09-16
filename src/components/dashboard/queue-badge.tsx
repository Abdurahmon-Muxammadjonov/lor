'use client';

import * as React from 'react';
import Link from 'next/link';
import { ListOrdered } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/client';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useQueueCount } from './queries';

/** Navbatda kutayotganlar — jonli belgi (15 s polling), navbat sahifasiga havola */
export function QueueBadge({ className }: { className?: string }) {
  const t = useT();
  const { data, isError } = useQueueCount();
  const waiting = data?.waiting ?? 0;
  const label = t('dashboard.queue.badge', { n: waiting });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href="/dashboard/queue"
          aria-label={label}
          className={cn(
            'relative inline-flex h-9 items-center gap-2 rounded-full border border-line bg-bg-elevated px-3 text-sm font-medium text-text-muted transition-colors',
            'hover:border-primary/30 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            waiting > 0 && 'border-primary/30 text-text',
            className,
          )}
        >
          <ListOrdered className="size-4" aria-hidden="true" />
          <span className="tabular" aria-live="polite" aria-atomic="true">
            {isError ? '—' : waiting}
          </span>
          {waiting > 0 ? (
            <span aria-hidden="true" className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-pulse-ring rounded-full bg-accent opacity-70" />
              <span className="relative inline-flex size-2 rounded-full bg-accent shadow-[0_0_8px_rgba(0,212,255,0.8)]" />
            </span>
          ) : null}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="bottom">{isError ? t('dashboard.errors.queue') : `${label} · ${t('dashboard.queue.open')}`}</TooltipContent>
    </Tooltip>
  );
}
