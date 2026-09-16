'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/client';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface PaginationProps {
  /** 1 dan boshlanadi */
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizes?: number[];
  className?: string;
  /** Oʻrtadagi raqamli tugmalarni yashirish (faqat oldingi/keyingi) */
  simple?: boolean;
}

type PageToken = number | 'dots-left' | 'dots-right';

const range = (from: number, to: number): number[] => (to < from ? [] : Array.from({ length: to - from + 1 }, (_, i) => from + i));

/** 1 2 3 4 5 … 20  ·  1 … 5 [6] 7 … 20  ·  1 … 16 17 18 19 20 (chekkalarda kamida 5 ta raqam) */
export function buildPageRange(page: number, pages: number, siblings = 1): PageToken[] {
  if (pages <= 0) return [];
  const boundary = 1;
  const totalSlots = siblings * 2 + boundary * 2 + 3;
  if (pages <= totalSlots) return range(1, pages);

  const siblingsStart = Math.max(Math.min(page - siblings, pages - boundary - siblings * 2 - 1), boundary + 2);
  const siblingsEnd = Math.min(Math.max(page + siblings, boundary + siblings * 2 + 2), pages - boundary - 1);

  const tokens: PageToken[] = [...range(1, boundary)];
  if (siblingsStart > boundary + 2) tokens.push('dots-left');
  else if (boundary + 1 < pages - boundary) tokens.push(boundary + 1);
  tokens.push(...range(siblingsStart, siblingsEnd));
  if (siblingsEnd < pages - boundary - 1) tokens.push('dots-right');
  else if (pages - boundary > boundary) tokens.push(pages - boundary);
  tokens.push(...range(pages - boundary + 1, pages));
  return tokens;
}

/**
 * Sahifalash: "1–20 / 134", raqamli tugmalar, oldingi/keyingi va sahifa hajmi.
 *
 *   <Pagination page={page} pageSize={pageSize} total={total} onChange={setPage} onPageSizeChange={setPageSize} />
 */
export function Pagination({
  page,
  pageSize,
  total,
  onChange,
  onPageSizeChange,
  pageSizes = [10, 20, 50, 100],
  className,
  simple = false,
}: PaginationProps) {
  const t = useT();
  const safeSize = Math.max(1, pageSize);
  const pages = Math.max(1, Math.ceil(total / safeSize));
  const current = Math.min(Math.max(1, page), pages);
  const from = total === 0 ? 0 : (current - 1) * safeSize + 1;
  const to = Math.min(total, current * safeSize);
  const tokens = React.useMemo(() => buildPageRange(current, pages), [current, pages]);
  const sizes = React.useMemo(() => (pageSizes.includes(safeSize) ? pageSizes : [...pageSizes, safeSize].sort((a, b) => a - b)), [pageSizes, safeSize]);

  const go = (p: number) => {
    const next = Math.min(Math.max(1, p), pages);
    if (next !== current) onChange(next);
  };

  return (
    <nav
      aria-label={t('common.page')}
      className={cn('flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between', className)}
    >
      <div className="flex items-center gap-3 text-xs text-text-muted">
        <span className="tabular">{t('common.showing', { from, to, total })}</span>
        {onPageSizeChange ? (
          <label className="flex items-center gap-2">
            <span className="hidden sm:inline">{t('common.perPage')}:</span>
            <Select value={String(safeSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
              <SelectTrigger className="h-8 w-[4.5rem] px-2 text-xs" aria-label={t('common.perPage')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sizes.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        ) : null}
      </div>

      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => go(current - 1)}
          disabled={current <= 1}
          aria-label={t('common.prevPage')}
        >
          <ChevronLeft aria-hidden="true" />
        </Button>

        {simple ? (
          <span className="min-w-[4.5rem] px-2 text-center text-xs tabular text-text-muted">
            {t('common.pageOf', { page: current, pages })}
          </span>
        ) : (
          <>
            <div className="hidden items-center gap-1 sm:flex">
              {tokens.map((tok) =>
                typeof tok === 'number' ? (
                  <Button
                    key={tok}
                    type="button"
                    variant={tok === current ? 'default' : 'ghost'}
                    size="icon"
                    className={cn('size-8 text-xs tabular', tok === current && 'pointer-events-none')}
                    onClick={() => go(tok)}
                    aria-current={tok === current ? 'page' : undefined}
                    aria-label={`${t('common.page')} ${tok}`}
                  >
                    {tok}
                  </Button>
                ) : (
                  <span key={tok} aria-hidden="true" className="flex size-8 items-center justify-center text-text-muted">
                    <MoreHorizontal className="size-4" />
                  </span>
                ),
              )}
            </div>
            <span className="min-w-[4.5rem] px-2 text-center text-xs tabular text-text-muted sm:hidden">
              {t('common.pageOf', { page: current, pages })}
            </span>
          </>
        )}

        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8"
          onClick={() => go(current + 1)}
          disabled={current >= pages}
          aria-label={t('common.nextPage')}
        >
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
