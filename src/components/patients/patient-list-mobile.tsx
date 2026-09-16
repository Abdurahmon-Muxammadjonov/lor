'use client';

import * as React from 'react';
import Link from 'next/link';
import { Baby, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale, useT } from '@/i18n/client';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { GenderAvatar } from '@/components/shared/gender-avatar';
import { Money } from '@/components/shared/money';
import { PhoneLink } from '@/components/shared/phone-link';
import type { PatientListItemDTO } from '@/lib/patients/types';
import { formatAge, formatLastVisit } from '@/lib/patients/format';
import { PatientRowActions, type PatientRowActionsProps } from './patient-row-actions';

export interface PatientListMobileProps extends Pick<
  PatientRowActionsProps,
  'canVisit' | 'canQueue' | 'onVisit' | 'onQueue'
> {
  items: PatientListItemDTO[];
  loading?: boolean;
  emptyTitle: React.ReactNode;
  emptyDescription?: React.ReactNode;
  emptyAction?: React.ReactNode;
  className?: string;
}

/** Mobil karta roʻyxati (md dan kichik ekranlar) */
export function PatientListMobile({
  items,
  loading = false,
  emptyTitle,
  emptyDescription,
  emptyAction,
  canVisit,
  canQueue,
  onVisit,
  onQueue,
  className,
}: PatientListMobileProps) {
  const t = useT();
  const { locale } = useLocale();

  if (loading && items.length === 0) {
    return (
      <div className={cn('space-y-3', className)} aria-busy="true">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center gap-3">
              <Skeleton className="size-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={cn('rounded-xl border border-line bg-surface', className)}>
        <EmptyState
          icon={Users}
          title={emptyTitle}
          description={emptyDescription}
          action={emptyAction}
          compact
        />
      </div>
    );
  }

  return (
    <ul
      className={cn('space-y-3', loading && 'opacity-70 transition-opacity', className)}
      aria-busy={loading || undefined}
    >
      {items.map((p) => {
        const child = p.patientType === 'CHILD';
        return (
          <li key={p.id} className="glass rounded-xl p-4">
            <div className="flex items-start gap-3">
              <GenderAvatar gender={p.gender} name={p.fullName} size="md" />
              <div className="min-w-0 flex-1">
                <Link
                  href={`/dashboard/patients/${p.id}`}
                  className="block truncate rounded-sm font-heading text-base font-semibold text-text hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {p.fullName}
                </Link>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
                  <span className="tabular font-mono">{p.cardNumber}</span>
                  <PhoneLink phone={p.phone} className="tabular hover:text-accent" />
                </div>
              </div>
              {child ? (
                <Badge variant="warning" className="shrink-0">
                  <Baby aria-hidden="true" />
                  {t('patients.child')}
                </Badge>
              ) : null}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-text-muted">
                  {t('patients.table.age')}
                </dt>
                <dd className="tabular">{formatAge(p.birthDate, t)}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wider text-text-muted">
                  {t('patients.table.lastVisit')}
                </dt>
                <dd className={cn('tabular', !p.lastVisitAt && 'text-text-muted')}>
                  {formatLastVisit(p.lastVisitAt, locale, t)}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[11px] uppercase tracking-wider text-text-muted">
                  {t('patients.table.debt')}
                </dt>
                <dd>
                  {p.debt > 0 ? (
                    <Money value={p.debt} className="font-semibold text-danger" />
                  ) : (
                    <span className="text-[#00FFB2]">{t('patients.noDebt')}</span>
                  )}
                </dd>
              </div>
            </dl>
            <PatientRowActions
              patient={{ id: p.id, fullName: p.fullName }}
              variant="buttons"
              canVisit={canVisit}
              canQueue={canQueue}
              onVisit={onVisit}
              onQueue={onQueue}
              className="mt-3"
            />
          </li>
        );
      })}
    </ul>
  );
}
