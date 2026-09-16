'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale } from '@/i18n/client';

export interface Breadcrumb {
  label: React.ReactNode;
  href?: string;
}

export interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Oʻng tomondagi tugmalar */
  actions?: React.ReactNode;
  breadcrumbs?: Breadcrumb[];
  /** Sarlavha oldidagi ikonka/belgi */
  leading?: React.ReactNode;
  className?: string;
  /** Sarlavha darajasi (default h1) */
  as?: 'h1' | 'h2';
}

const NAV_LABEL = { uz: 'Sahifa yoʻli', ru: 'Навигация' } as const;

/**
 * Sahifa sarlavhasi: breadcrumb, sarlavha, tavsif va amallar.
 *
 *   <PageHeader title={t('patients.title')} actions={<Button>…</Button>} breadcrumbs={[{ label: t('common.nav.dashboard'), href: '/dashboard' }, { label: t('patients.title') }]} />
 */
export function PageHeader({ title, description, actions, breadcrumbs, leading, className, as = 'h1' }: PageHeaderProps) {
  const { locale } = useLocale();
  const Heading = as;

  return (
    <header className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0 flex-1">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav aria-label={NAV_LABEL[locale]} className="mb-2">
            <ol className="flex flex-wrap items-center gap-1 text-xs text-text-muted">
              {breadcrumbs.map((b, i) => {
                const last = i === breadcrumbs.length - 1;
                return (
                  <li key={i} className="flex items-center gap-1">
                    {b.href && !last ? (
                      <Link href={b.href} className="rounded-sm transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                        {b.label}
                      </Link>
                    ) : (
                      <span aria-current={last ? 'page' : undefined} className={cn(last && 'text-text')}>
                        {b.label}
                      </span>
                    )}
                    {last ? null : <ChevronRight className="size-3 shrink-0 opacity-60" aria-hidden="true" />}
                  </li>
                );
              })}
            </ol>
          </nav>
        ) : null}
        <div className="flex items-center gap-3">
          {leading ? <div className="shrink-0 text-accent [&_svg]:size-6">{leading}</div> : null}
          <Heading className="truncate font-heading text-2xl font-bold tracking-tight text-text sm:text-3xl">{title}</Heading>
        </div>
        {description ? <p className="mt-1 max-w-2xl text-sm text-text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}
