import * as React from 'react';
import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export type StatAccent = 'cyan' | 'violet' | 'mint' | 'danger';

export interface StatCardProps {
  title: React.ReactNode;
  value: React.ReactNode;
  /** Oʻzgarish foizi: musbat — yashil ↑, manfiy — qizil ↓ */
  delta?: number;
  /** Delta yonidagi izoh, masalan "kechaga nisbatan" */
  deltaLabel?: React.ReactNode;
  icon?: LucideIcon;
  /** Pastki izoh */
  hint?: React.ReactNode;
  loading?: boolean;
  accent?: StatAccent;
  className?: string;
  /** Karta bosilganda */
  onClick?: () => void;
}

const ACCENT: Record<StatAccent, { icon: string; glow: string; bar: string }> = {
  cyan: {
    icon: 'bg-primary/10 text-accent border-primary/20',
    glow: 'hover:shadow-glow',
    bar: 'from-[#00D4FF]',
  },
  violet: {
    icon: 'bg-[#7C5CFF]/15 text-[#B7A8FF] border-[#7C5CFF]/30',
    glow: 'hover:shadow-glow-violet',
    bar: 'from-[#7C5CFF]',
  },
  mint: {
    icon: 'bg-[#00FFB2]/10 text-[#00FFB2] border-[#00FFB2]/20',
    glow: 'hover:shadow-glow-mint',
    bar: 'from-[#00FFB2]',
  },
  danger: {
    icon: 'bg-destructive/10 text-danger border-destructive/25',
    glow: 'hover:shadow-[0_0_0_1px_rgba(255,77,109,0.3),0_0_24px_rgba(255,77,109,0.3)]',
    bar: 'from-[#FF4D6D]',
  },
};

/**
 * Statistika kartasi (shisha uslub, accent nur).
 *
 *   <StatCard title={t('dashboard.todayRevenue')} value={<Money value={1250000} />} delta={12.5} icon={Wallet} accent="mint" />
 */
export function StatCard({
  title,
  value,
  delta,
  deltaLabel,
  icon: Icon,
  hint,
  loading = false,
  accent = 'cyan',
  className,
  onClick,
}: StatCardProps) {
  const a = ACCENT[accent];
  const hasDelta = typeof delta === 'number' && Number.isFinite(delta);
  const dir = hasDelta ? (delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat') : 'flat';
  const deltaText = hasDelta
    ? `${delta > 0 ? '+' : ''}${(Math.abs(delta) >= 100 ? String(Math.round(delta)) : delta.toFixed(1).replace(/\.0$/, '')).replace(/^-/, '−')}%`
    : '';
  const DeltaIcon = dir === 'up' ? ArrowUpRight : dir === 'down' ? ArrowDownRight : Minus;
  const interactive = typeof onClick === 'function';

  const body = (
    <>
      <div aria-hidden="true" className={cn('absolute inset-x-0 top-0 h-px bg-gradient-to-r to-transparent opacity-70', a.bar)} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-semibold uppercase tracking-wider text-text-muted">{title}</div>
          {loading ? (
            <Skeleton className="mt-2 h-8 w-28" />
          ) : (
            <div className="mt-1.5 truncate font-heading text-2xl font-bold tracking-tight text-text tabular sm:text-3xl">{value}</div>
          )}
        </div>
        {Icon ? (
          <div aria-hidden="true" className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg border [&_svg]:size-5', a.icon)}>
            <Icon />
          </div>
        ) : null}
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-4 w-36" />
      ) : hasDelta || hint ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
          {hasDelta ? (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold tabular',
                dir === 'up' && 'bg-[#00FFB2]/10 text-[#00FFB2]',
                dir === 'down' && 'bg-destructive/10 text-danger',
                dir === 'flat' && 'bg-secondary text-text-muted',
              )}
            >
              <DeltaIcon className="size-3.5" aria-hidden="true" />
              {deltaText}
            </span>
          ) : null}
          {deltaLabel ? <span className="text-text-muted">{deltaLabel}</span> : null}
          {hint && !deltaLabel ? <span className="text-text-muted">{hint}</span> : null}
        </div>
      ) : null}
      {hint && deltaLabel && !loading ? <div className="mt-1 text-xs text-text-muted">{hint}</div> : null}
    </>
  );

  const classes = cn(
    'glass relative overflow-hidden p-5 transition-[box-shadow,transform] duration-300',
    interactive && cn('w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', a.glow, 'hover:-translate-y-0.5'),
    className,
  );

  if (interactive) {
    return (
      <button type="button" onClick={onClick} className={classes} aria-busy={loading || undefined}>
        {body}
      </button>
    );
  }
  return (
    <div className={classes} aria-busy={loading || undefined}>
      {body}
    </div>
  );
}
