'use client';

import * as React from 'react';
import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/client';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from './empty-state';

export type ColumnAlign = 'left' | 'right' | 'center';

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T, index: number) => React.ReactNode;
  className?: string;
  /** Sarlavha katagi klassi */
  headerClassName?: string;
  align?: ColumnAlign;
  /** Ustun kengligi (CSS qiymati yoki px) */
  width?: number | string;
  /** Mobilda yashirish (md dan kichik ekranlarda) */
  hideOnMobile?: boolean;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  rowKey: (row: T, index: number) => string;
  loading?: boolean;
  /** Yuklanish holatidagi qator soni (default 6) */
  skeletonRows?: number;
  emptyText?: React.ReactNode;
  emptyDescription?: React.ReactNode;
  emptyIcon?: LucideIcon;
  emptyAction?: React.ReactNode;
  onRowClick?: (row: T, index: number) => void;
  rowClassName?: (row: T, index: number) => string | undefined;
  /** Jadval ostidagi maydon (masalan <Pagination />) */
  footer?: React.ReactNode;
  stickyHeader?: boolean;
  /** Qator tanlanganligi (data-state=selected) */
  isRowSelected?: (row: T, index: number) => boolean;
  /** Tashqi konteyner klassi */
  className?: string;
  /** <table> klassi */
  tableClassName?: string;
  /** Jadval sarlavhasi (a11y, koʻrinmas) */
  caption?: string;
  /** Kompakt qatorlar */
  dense?: boolean;
}

const ALIGN: Record<ColumnAlign, string> = {
  left: 'text-left',
  right: 'text-right',
  center: 'text-center',
};

function widthStyle(width: number | string | undefined): React.CSSProperties | undefined {
  if (width === undefined) return undefined;
  const w = typeof width === 'number' ? `${width}px` : width;
  return { width: w, minWidth: w };
}

/**
 * Oddiy generic jadval: ustunlar, yuklanish (skeleton), boʻsh holat, qator bosish (klaviatura bilan ham),
 * yopishqoq sarlavha, mobilda gorizontal skroll.
 *
 *   <DataTable columns={cols} data={items} rowKey={(r) => r.id} loading={isLoading} onRowClick={(r) => router.push(`/dashboard/patients/${r.id}`)} />
 */
export function DataTable<T>({
  columns,
  data,
  rowKey,
  loading = false,
  skeletonRows = 6,
  emptyText,
  emptyDescription,
  emptyIcon,
  emptyAction,
  onRowClick,
  rowClassName,
  footer,
  stickyHeader = false,
  isRowSelected,
  className,
  tableClassName,
  caption,
  dense = false,
}: DataTableProps<T>) {
  const t = useT();
  const clickable = typeof onRowClick === 'function';
  const cellPad = dense ? 'px-3 py-2' : undefined;

  const handleKey = (e: React.KeyboardEvent<HTMLTableRowElement>, row: T, index: number) => {
    if (!clickable) return;
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onRowClick(row, index);
    }
  };

  return (
    <div className={cn('overflow-hidden rounded-xl border border-line bg-surface shadow-card', className)}>
      <div className={cn(stickyHeader && 'max-h-[70vh] overflow-auto scrollbar-thin')}>
        <Table className={tableClassName}>
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <TableHeader className={cn(stickyHeader && 'sticky top-0 z-10 bg-bg-elevated')}>
            <TableRow className="hover:bg-transparent">
              {columns.map((c) => (
                <TableHead
                  key={c.key}
                  scope="col"
                  style={widthStyle(c.width)}
                  className={cn(ALIGN[c.align ?? 'left'], c.hideOnMobile && 'hidden md:table-cell', dense && 'h-9 px-3', c.headerClassName)}
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
                    <TableCell key={c.key} className={cn(cellPad, c.hideOnMobile && 'hidden md:table-cell', c.className)}>
                      <Skeleton
                        className={cn('h-4', c.align === 'right' ? 'ml-auto' : c.align === 'center' ? 'mx-auto' : '')}
                        style={{ width: `${ci === 0 ? 60 : 35 + ((i * 17 + ci * 23) % 40)}%` }}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : data.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={columns.length} className="p-0">
                  <EmptyState compact icon={emptyIcon} title={emptyText ?? t('common.noData')} description={emptyDescription} action={emptyAction} />
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, i) => {
                const selected = isRowSelected?.(row, i) ?? false;
                return (
                  <TableRow
                    key={rowKey(row, i)}
                    data-state={selected ? 'selected' : undefined}
                    tabIndex={clickable ? 0 : undefined}
                    onClick={clickable ? () => onRowClick(row, i) : undefined}
                    onKeyDown={(e) => handleKey(e, row, i)}
                    className={cn(
                      clickable && 'cursor-pointer focus-visible:outline-none focus-visible:bg-primary/5 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring',
                      rowClassName?.(row, i),
                    )}
                  >
                    {columns.map((c) => (
                      <TableCell
                        key={c.key}
                        className={cn(cellPad, ALIGN[c.align ?? 'left'], c.hideOnMobile && 'hidden md:table-cell', c.className)}
                      >
                        {c.cell(row, i)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
      {footer ? <div className="border-t border-line bg-popover/60 px-4 py-3">{footer}</div> : null}
    </div>
  );
}
