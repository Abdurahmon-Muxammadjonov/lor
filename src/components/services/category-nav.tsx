'use client';

import * as React from 'react';
import { LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale } from '@/i18n/client';
import { Skeleton } from '@/components/ui/skeleton';
import type { CategoryDTO } from '@/lib/services/types';
import { CategoryIcon } from './category-icon';

export const ALL_CATEGORIES = 'all';

export interface CategoryNavProps {
  categories: CategoryDTO[];
  /** Kategoriya id → koʻrsatiladigan son (filtrlangan) */
  counts: ReadonlyMap<string, number>;
  totalCount: number;
  value: string;
  onChange: (id: string) => void;
  loading?: boolean;
  className?: string;
}

/**
 * Kategoriyalar navigatsiyasi: katta ekranda yon panel (vertikal roʻyxat),
 * kichik ekranda gorizontal skroll qilinadigan pill'lar. Klaviatura: tab + Enter/Space, strelkalar.
 */
export function CategoryNav({ categories, counts, totalCount, value, onChange, loading = false, className }: CategoryNavProps) {
  const { t, locale } = useLocale();
  const listRef = React.useRef<HTMLDivElement>(null);

  const items = React.useMemo(
    () => [
      { id: ALL_CATEGORIES, label: t('services.allCategories'), icon: null as string | null, count: totalCount, isAll: true },
      ...categories.map((c) => ({
        id: c.id,
        label: locale === 'ru' ? c.nameRu : c.name,
        icon: c.icon,
        count: counts.get(c.id) ?? 0,
        isAll: false,
      })),
    ],
    [categories, counts, totalCount, t, locale],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const keys = ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
    if (!keys.includes(e.key)) return;
    const buttons = Array.from(listRef.current?.querySelectorAll<HTMLButtonElement>('button[data-cat]') ?? []);
    if (buttons.length === 0) return;
    const current = buttons.findIndex((b) => b === document.activeElement);
    let next = current;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = (current + 1) % buttons.length;
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = (current - 1 + buttons.length) % buttons.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = buttons.length - 1;
    e.preventDefault();
    buttons[next]?.focus();
  };

  if (loading) {
    return (
      <div className={cn('flex gap-2 lg:flex-col', className)} aria-busy="true" aria-hidden="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-28 shrink-0 rounded-lg lg:h-10 lg:w-full" />
        ))}
      </div>
    );
  }

  return (
    <nav aria-label={t('services.category.list')} className={cn('min-w-0', className)}>
      <div
        ref={listRef}
        role="list"
        onKeyDown={onKeyDown}
        className="-mx-1 flex snap-x gap-1.5 overflow-x-auto px-1 pb-1 scrollbar-none lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0 lg:pb-0"
      >
        {items.map((item) => {
          const active = item.id === value;
          return (
            <div role="listitem" key={item.id} className="shrink-0 snap-start lg:w-full">
              <button
                type="button"
                data-cat={item.id}
                aria-current={active ? 'true' : undefined}
                onClick={() => onChange(item.id)}
                className={cn(
                  'group flex w-full items-center gap-2 whitespace-nowrap rounded-lg border px-3 py-2 text-left text-sm transition-[background-color,border-color,color,box-shadow] duration-150',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base',
                  active
                    ? 'border-primary/40 bg-primary/10 text-text shadow-[0_0_0_1px_rgba(0,212,255,0.15)]'
                    : 'border-line bg-card/60 text-text-muted hover:border-border/80 hover:bg-popover/60 hover:text-text',
                )}
              >
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-md transition-colors',
                    active ? 'text-accent' : 'text-text-muted group-hover:text-text',
                  )}
                >
                  {item.isAll ? <LayoutGrid className="size-4" aria-hidden="true" /> : <CategoryIcon name={item.icon} />}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium">{item.label}</span>
                <span
                  className={cn(
                    'ml-1 shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular',
                    active ? 'bg-accent text-bg-base' : 'bg-bg-elevated text-text-muted',
                  )}
                  aria-label={t('services.count', { n: item.count })}
                >
                  {item.count}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
