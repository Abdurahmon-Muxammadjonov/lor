import * as React from 'react';
import { cn } from '@/lib/utils';

export interface PrintColumn {
  key: string;
  header: React.ReactNode;
  align?: 'left' | 'right' | 'center';
  width?: string;
}

export interface PrintTableProps {
  columns: PrintColumn[];
  rows: React.ReactNode[][];
  rowKeys?: string[];
  totals?: React.ReactNode[];
  emptyText: string;
  caption?: string;
  className?: string;
}

const ALIGN = { left: 'text-left', right: 'text-right tabular', center: 'text-center' } as const;

/** Qogʻoz uchun jadval (server-safe): ochiq fon, ingichka chiziqlar, sarlavha har sahifada takrorlanadi */
export function PrintTable({ columns, rows, rowKeys, totals, emptyText, caption, className }: PrintTableProps) {
  return (
    <table className={cn('print-table w-full border-collapse text-[11px] leading-tight', className)}>
      {caption ? <caption className="sr-only">{caption}</caption> : null}
      <thead>
        <tr>
          {columns.map((c) => (
            <th key={c.key} scope="col" style={c.width ? { width: c.width } : undefined} className={cn('border-b border-neutral-400 bg-neutral-100 px-2 py-1.5 align-bottom text-[10px] font-semibold uppercase tracking-wide text-neutral-700', ALIGN[c.align ?? 'left'])}>
              {c.header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length} className="px-2 py-6 text-center text-neutral-500">
              {emptyText}
            </td>
          </tr>
        ) : (
          rows.map((r, ri) => (
            <tr key={rowKeys?.[ri] ?? ri} className="break-inside-avoid">
              {r.map((cell, ci) => (
                <td key={columns[ci]?.key ?? ci} className={cn('border-b border-neutral-200 px-2 py-1 align-top', ALIGN[columns[ci]?.align ?? 'left'])}>
                  {cell}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
      {totals && rows.length > 0 ? (
        <tfoot>
          <tr>
            {totals.map((cell, ci) => (
              <td key={columns[ci]?.key ?? ci} className={cn('border-t border-neutral-400 bg-neutral-50 px-2 py-1.5 font-semibold', ALIGN[columns[ci]?.align ?? 'left'])}>
                {cell}
              </td>
            ))}
          </tr>
        </tfoot>
      ) : null}
    </table>
  );
}
