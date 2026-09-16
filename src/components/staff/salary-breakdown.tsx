'use client';

import * as React from 'react';
import { CalendarDays, Stethoscope } from 'lucide-react';
import { pickLang, useLocale } from '@/i18n/client';
import { fmtDate } from '@/lib/date';
import { formatQuantity } from '@/lib/calc';
import { cn } from '@/lib/utils';
import type { SalaryDoctorDTO } from '@/lib/staff/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Money } from '@/components/shared/money';
import { EmptyState } from '@/components/shared/empty-state';

export interface SalaryBreakdownProps {
  item: SalaryDoctorDTO;
  className?: string;
  /** Kompakt (dialog) koʻrinish */
  compact?: boolean;
}

/** Kunlik taqsimot + eng koʻp xizmatlar (jadval qatorida yoki dialogda) */
export function SalaryBreakdown({ item, className, compact = false }: SalaryBreakdownProps) {
  const { t, locale } = useLocale();
  const isPercent = item.salaryType === 'PERCENT';

  if (item.visits === 0) {
    return <EmptyState compact icon={CalendarDays} title={t('staff.salary.noVisits')} className={className} />;
  }

  return (
    <div className={cn('grid gap-4', !compact && 'lg:grid-cols-[3fr,2fr]', className)}>
      <section aria-labelledby={`daily-${item.doctor.id}`} className="min-w-0 overflow-hidden rounded-lg border border-line bg-bg-elevated">
        <h4 id={`daily-${item.doctor.id}`} className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
          <CalendarDays className="size-4" aria-hidden="true" />
          {t('staff.salary.daily')}
        </h4>
        <div className="max-h-72 overflow-auto scrollbar-thin">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-bg-elevated">
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-9 px-3">{t('staff.salary.date')}</TableHead>
                <TableHead className="h-9 px-3 text-right">{t('staff.salary.visits')}</TableHead>
                <TableHead className="h-9 px-3 text-right">{t('staff.salary.revenue')}</TableHead>
                <TableHead className="h-9 px-3 text-right">{t('staff.salary.calculated')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {item.days.map((d) => (
                <TableRow key={d.date}>
                  <TableCell className="px-3 py-2 tabular">{fmtDate(`${d.date}T00:00:00`, locale)}</TableCell>
                  <TableCell className="px-3 py-2 text-right tabular">
                    {d.visits}
                    {d.patients !== d.visits ? <span className="text-text-muted"> / {d.patients}</span> : null}
                  </TableCell>
                  <TableCell className="px-3 py-2 text-right">
                    <Money value={d.revenue} suffix={null} />
                  </TableCell>
                  <TableCell className="px-3 py-2 text-right">
                    {d.salary === null ? <span className="text-text-muted">—</span> : <Money value={d.salary} suffix={null} className="text-accent" />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {!isPercent ? <p className="border-t border-line px-4 py-2 text-xs text-text-muted">{t('staff.salary.fixedNote')}</p> : null}
      </section>

      <section aria-labelledby={`services-${item.doctor.id}`} className="min-w-0 overflow-hidden rounded-lg border border-line bg-bg-elevated">
        <h4 id={`services-${item.doctor.id}`} className="flex items-center gap-2 border-b border-line px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
          <Stethoscope className="size-4" aria-hidden="true" />
          {t('staff.salary.topServices')}
        </h4>
        <ol className="max-h-72 divide-y divide-line overflow-auto scrollbar-thin">
          {item.services.map((s, i) => {
            const share = item.revenue > 0 ? Math.round((s.revenue / item.revenue) * 100) : 0;
            return (
              <li key={s.code} className="relative px-4 py-2.5">
                <div aria-hidden="true" className="absolute inset-y-0 left-0 bg-primary/5" style={{ width: `${share}%` }} />
                <div className="relative flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-text">
                      <span className="mr-1.5 text-xs text-text-muted tabular">{i + 1}.</span>
                      {pickLang(s, locale)}
                    </div>
                    <div className="text-xs text-text-muted tabular">
                      {s.code} · {t('staff.salary.count')}: {s.count} · {t('staff.salary.quantity')}: {formatQuantity(s.quantity)}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <Money value={s.revenue} suffix={null} className="text-sm" />
                    <div className="text-xs text-text-muted tabular">{share} %</div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
