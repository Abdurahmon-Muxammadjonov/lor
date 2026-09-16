'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/client';
import { breadcrumbsFor } from '@/lib/dashboard/nav';

const NAV_LABEL = { uz: 'Sahifa yoʻli', ru: 'Навигация' } as const;

/** Yoʻl (pathname) dan tuzilgan breadcrumb — maʼlumot soʻralmaydi. Mobilda faqat oxirgi 2 ta boʻlim. */
export function Breadcrumbs({ className, locale }: { className?: string; locale: 'uz' | 'ru' }) {
  const t = useT();
  const pathname = usePathname();
  const crumbs = React.useMemo(() => breadcrumbsFor(pathname), [pathname]);
  if (crumbs.length === 0) return null;

  return (
    <nav aria-label={NAV_LABEL[locale]} className={cn('min-w-0', className)}>
      <ol className="flex min-w-0 items-center text-sm">
        {crumbs.map((c, i) => {
          const last = i === crumbs.length - 1;
          const label = c.labelKey ? t(c.labelKey) : (c.raw ?? '');
          const hideOnMobile = i < crumbs.length - 2;
          return (
            <li key={`${c.href ?? 'last'}-${i}`} className={cn('flex min-w-0 items-center', hideOnMobile && 'hidden sm:flex')}>
              {c.href && !last ? (
                <Link
                  href={c.href}
                  className="truncate rounded-sm text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {label}
                </Link>
              ) : (
                <span aria-current={last ? 'page' : undefined} className={cn('truncate', last ? 'font-heading font-semibold text-text' : 'text-text-muted')}>
                  {label}
                </span>
              )}
              {last ? null : <ChevronRight className="mx-1 size-3.5 shrink-0 text-muted-foreground/60" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
