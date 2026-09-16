import * as React from 'react';
import { Inbox, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Tugma yoki havola */
  action?: React.ReactNode;
  /** Ixcham koʻrinish (jadval ichida) */
  compact?: boolean;
  className?: string;
}

/**
 * Boʻsh holat: ikonka, sarlavha, tavsif va amal.
 *
 *   <EmptyState icon={Users} title={t('patients.empty')} action={<Button>…</Button>} />
 */
export function EmptyState({ icon: Icon = Inbox, title, description, action, compact = false, className }: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'gap-2 px-4 py-8' : 'gap-3 rounded-xl border border-dashed border-line bg-card/40 px-6 py-14',
        className,
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          'flex items-center justify-center rounded-full border border-line bg-bg-elevated text-text-muted shadow-[0_0_0_6px_rgba(19,26,43,0.6)]',
          compact ? 'size-10 [&_svg]:size-5' : 'size-14 [&_svg]:size-7',
        )}
      >
        <Icon />
      </div>
      <div className={cn('font-heading font-semibold text-text', compact ? 'text-sm' : 'text-base')}>{title}</div>
      {description ? (
        <p className={cn('max-w-sm text-text-muted', compact ? 'text-xs' : 'text-sm')}>{description}</p>
      ) : null}
      {action ? <div className={cn('flex items-center gap-2', compact ? 'mt-1' : 'mt-2')}>{action}</div> : null}
    </div>
  );
}
