'use client';

import { Radio, RefreshCw, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/client';
import type { RealtimeStatus } from '@/lib/realtime/types';

export interface RealtimeBadgeProps {
  status: RealtimeStatus;
  className?: string;
  compact?: boolean;
}

/** Jonli ulanish holati: jonli (SSE) / yangilanmoqda (polling) / aloqa yoʻq */
export function RealtimeBadge({ status, className, compact = false }: RealtimeBadgeProps) {
  const t = useT();
  const map = {
    idle: { icon: RefreshCw, label: t('queue.realtime.connecting'), cls: 'text-text-muted border-line' },
    connecting: { icon: RefreshCw, label: t('queue.realtime.connecting'), cls: 'text-text-muted border-line' },
    live: { icon: Radio, label: t('queue.realtime.live'), cls: 'text-[#00FFB2] border-[#00FFB2]/30 bg-[#00FFB2]/10' },
    polling: { icon: RefreshCw, label: t('queue.realtime.polling'), cls: 'text-accent border-primary/30 bg-primary/10' },
    offline: { icon: WifiOff, label: t('queue.realtime.offline'), cls: 'text-danger border-destructive/40 bg-destructive/10' },
  } as const;
  const m = map[status];
  const Icon = m.icon;
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn('inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium', m.cls, className)}
      title={m.label}
    >
      <Icon className={cn('size-3.5', (status === 'connecting' || status === 'idle') && 'animate-spin')} aria-hidden="true" />
      {status === 'live' ? (
        <span aria-hidden="true" className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-pulse-ring rounded-full bg-[#00FFB2] opacity-70" />
          <span className="relative inline-flex size-2 rounded-full bg-[#00FFB2]" />
        </span>
      ) : null}
      {compact ? <span className="sr-only">{m.label}</span> : <span>{m.label}</span>}
    </span>
  );
}
