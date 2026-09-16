'use client';

import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/client';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';

export type ReportAlign = 'left' | 'right' | 'center';

export interface ReportColumn<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T, index: number) => React.ReactNode;
  /** Jami qatoridagi qiymat (berilmasa boʻsh; birinchi ustun — "Jami") */
  total?: React.ReactNode;
  align?: ReportAlign;
  className?: string;
  headerClassName?: string;
  hideOnMobile?: boolean;
  width?: number | string;
}

export interface ReportTableProps<T> {
  columns: ReportColumn<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  loading?: boolean;
  skeletonRows?: number;
  /** Jami qatorini koʻrsatish (ustunlarning `total` qiymatlari) */
  totals?: boolean;
  emptyTitle?: React.ReactNode;
  emptyDescription?: React.ReactNode;
  emptyIcon?: LucideIcon;
  emptyAction?: React.ReactNode;
  caption?: string;
  dense?: boolean;
  rowClassName?: (row: T, index: number) => string | undefined;
  /** Balandlik chegarasi (yopishqoq sarlavha bilan skroll) */
  maxHeight?: number | string;
  className?: string;
}

const ALIGN: Record<ReportAlign, string> = { left: 'text-left', right: 'text-right', center: 'text-center' };

function widthStyle(width: number | string | undefined): React.CSSProperties | undefined {
  if (width === undefined) return undefined;
  const w = typeof width === 'number' ? `${width}px` : width;
  return { width: w, minWidth: w };
}

/**
 * Hisobot jadvali: ustunlar, jami qatori (<tfoot>), skeleton, boʻsh holat, mobilda gorizontal skroll,
 * pul/son ustunlari `tabular`.
 */
export function ReportTable<T>({
  columns,
  rows,
  rowKey,
  loading = false,
  skeletonRows = 6,
  totals = false,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  emptyAction,
  caption,
  dense = false,
  rowClassName,
  maxHeight,
  className,
}: ReportTableProps<T>) {
  const t = useT();
  const pad = dense ? 'px-3 py-2' : 'px-4 py-3';
  const showTotals = totals && !loading && rows.length > 0;

  return (
    <div className={cn('overflow-hidden rounded-xl border border-line bg-surface shadow-card', className)}>
      <div className={cn(maxHeight !== undefined && 'overflow-auto scrollbar-thin')} style={maxHeight !== undefined ? { maxHeight } : undefined}>
        <Table>
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <TableHeader className={cn(maxHeight !== undefined && 'sticky top-0 z-10 bg-bg-elevated')}>
            <TableRow className="hover:bg-transparent">
              {columns.map((c) => (
                <TableHead
                  key={c.key}
                  scope="col"
                  style={widthStyle(c.width)}
                  className={cn(ALIGN[c.align ?? 'left'], c.hideOnMobile && 'hidden md:table-cell', dense && 'h-9 px-3', 'whitespace-nowrap', c.headerClassName)}
                >
                  {c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: Math.max(1, skeletonRows) }).map((_, i) => (
                <TableRow key={`skeleton-${i}`} className="hover:bg-transparent" aria-hidden="true">
                  {columns.map((c, ci) => (
                    <TableCell key={c.key} className={cn(pad, c.hideOnMobile && 'hidden md:table-cell', c.className)}>
                      <Skeleton
                        className={cn('h-4', c.align === 'right' ? 'ml-auto' : c.align === 'center' ? 'mx-auto' : '')}
                        style={{ width: `${ci === 0 ? 60 : 35 + ((i * 17 + ci * 23) % 40)}%` }}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="p-0">
                  <EmptyState
                    compact
                    icon={emptyIcon}
                    title={emptyTitle ?? t('reports.empty.title')}
                    description={emptyDescription ?? t('reports.empty.description')}
                    action={emptyAction}
                  />
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, i) => (
                <TableRow key={rowKey(row, i)} className={rowClassName?.(row, i)}>
                  {columns.map((c) => (
                    <TableCell
                      key={c.key}
                      className={cn(pad, ALIGN[c.align ?? 'left'], c.align === 'right' && 'tabular', c.hideOnMobile && 'hidden md:table-cell', c.className)}
                    >
                      {c.cell(row, i)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
          {showTotals ? (
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                {columns.map((c, ci) => (
                  <TableCell
                    key={c.key}
                    className={cn(pad, ALIGN[c.align ?? 'left'], 'font-semibold text-text', c.align === 'right' && 'tabular', c.hideOnMobile && 'hidden md:table-cell', c.className)}
                  >
                    {c.total !== undefined ? c.total : ci === 0 ? t('common.total') : null}
                  </TableCell>
                ))}
              </TableRow>
            </TableFooter>
          ) : null}
        </Table>
      </div>
    </div>
  );
}
