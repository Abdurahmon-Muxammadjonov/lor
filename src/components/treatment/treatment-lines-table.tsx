'use client';

import * as React from 'react';
import { ClipboardList, Pencil, Pill, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatQuantity } from '@/lib/calc';
import { useLocale } from '@/i18n/client';
import type { TreatmentLineDTO } from '@/lib/visits/types';
import { Money } from '@/components/shared/money';
import { EmptyState } from '@/components/shared/empty-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { lineName, sumLines } from './visit-utils';

export interface TreatmentLinesTableProps {
  lines: TreatmentLineDTO[];
  canEdit: boolean;
  onAdd: () => void;
  onEdit: (line: TreatmentLineDTO) => void;
  onDelete: (line: TreatmentLineDTO) => void;
  /** Oʻchirilayotgan qator (spinner) */
  deletingId?: string | null;
  className?: string;
}

/** "Quloq · Chap · Tashqi eshitish yoʻli" */
function anatomyText(line: TreatmentLineDTO, t: (k: string) => string): string {
  const parts: string[] = [];
  if (line.organ) parts.push(t(`common.organ.${line.organ}`));
  if (line.side) parts.push(t(`common.side.${line.side}`));
  if (line.detail) parts.push(line.detail);
  return parts.join(' · ');
}

function discountText(
  line: TreatmentLineDTO,
  t: (k: string, p?: Record<string, string | number>) => string,
): string | null {
  if (line.discountType === 'PERCENT' && line.discountValue > 0)
    return t('visits.lines.percentOf', { p: formatQuantity(line.discountValue) });
  if (line.discountType === 'FIXED' && line.discountValue > 0) return t('common.discountType.FIXED');
  return null;
}

/**
 * Muolaja qatorlari jadvali: desktopda toʻliq jadval (tfoot jamlari bilan), mobilda kartochkalar.
 * Barcha summalar qator snapshotidan (serverda hisoblangan) oʻqiladi.
 */
export function TreatmentLinesTable({
  lines,
  canEdit,
  onAdd,
  onEdit,
  onDelete,
  deletingId,
  className,
}: TreatmentLinesTableProps) {
  const { locale, t } = useLocale();
  const sums = React.useMemo(() => sumLines(lines), [lines]);

  if (lines.length === 0) {
    return (
      <EmptyState
        icon={ClipboardList}
        title={t('visits.lines.empty')}
        description={t('visits.lines.emptyDescription')}
        className={cn('bg-card/30', className)}
        action={
          canEdit ? (
            <Button type="button" variant="gradient" className="glow" onClick={onAdd}>
              <Plus aria-hidden="true" />
              {t('visits.lines.addFirst')}
            </Button>
          ) : undefined
        }
      />
    );
  }

  const medBadge = (line: TreatmentLineDTO) => (
    <Badge variant={line.withMedicine ? 'accent' : 'outline'} className="gap-1 font-medium">
      {line.withMedicine ? <Pill aria-hidden="true" /> : null}
      {line.withMedicine ? t('visits.lines.medYes') : t('visits.lines.medNo')}
    </Badge>
  );
  const typeBadge = (line: TreatmentLineDTO) => (
    <Badge variant={line.patientType === 'CHILD' ? 'warning' : 'secondary'} className="font-medium">
      {t(`common.patientType.${line.patientType}`)}
    </Badge>
  );
  const actions = (line: TreatmentLineDTO) =>
    canEdit ? (
      <div className="flex items-center justify-end gap-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={t('visits.lines.edit')}
          onClick={() => onEdit(line)}
        >
          <Pencil aria-hidden="true" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-text-muted hover:text-danger"
          aria-label={t('visits.lines.delete')}
          onClick={() => onDelete(line)}
          loading={deletingId === line.id}
        >
          {deletingId === line.id ? null : <Trash2 aria-hidden="true" />}
        </Button>
      </div>
    ) : null;

  return (
    <div className={cn('space-y-3', className)}>
      {/* ── Desktop jadval ── */}
      <div className="hidden overflow-hidden rounded-xl border border-line bg-surface shadow-card md:block">
        <Table className="tabular">
          <caption className="sr-only">{t('visits.lines.title')}</caption>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead scope="col" className="w-10 text-center">
                {t('visits.lines.columns.n')}
              </TableHead>
              <TableHead scope="col">{t('visits.lines.columns.treatment')}</TableHead>
              <TableHead scope="col">{t('visits.lines.columns.patientType')}</TableHead>
              <TableHead scope="col">{t('visits.lines.columns.medicine')}</TableHead>
              <TableHead scope="col" className="text-right">
                {t('visits.lines.columns.quantity')}
              </TableHead>
              <TableHead scope="col" className="text-right">
                {t('visits.lines.columns.unitPrice')}
              </TableHead>
              <TableHead scope="col" className="text-right">
                {t('visits.lines.columns.discount')}
              </TableHead>
              <TableHead scope="col" className="text-right">
                {t('visits.lines.columns.total')}
              </TableHead>
              {canEdit ? (
                <TableHead scope="col" className="w-24 text-right">
                  <span className="sr-only">{t('visits.lines.columns.actions')}</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line, i) => {
              const anatomy = anatomyText(line, t);
              const dt = discountText(line, t);
              return (
                <TableRow key={line.id} data-line-id={line.id}>
                  <TableCell className="text-center text-text-muted">{i + 1}</TableCell>
                  <TableCell className="max-w-[320px]">
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 shrink-0 rounded-md border border-line bg-bg-elevated px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                        {line.serviceCode}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-text">{lineName(line, locale)}</div>
                        {anatomy ? <div className="truncate text-xs text-text-muted">{anatomy}</div> : null}
                        {line.note ? (
                          <div className="truncate text-xs italic text-muted-foreground/80">{line.note}</div>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{typeBadge(line)}</TableCell>
                  <TableCell>{medBadge(line)}</TableCell>
                  <TableCell className="text-right">
                    {formatQuantity(line.quantity)}{' '}
                    <span className="text-xs text-text-muted">{line.unit}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Money value={line.unitPrice} suffix={null} />
                  </TableCell>
                  <TableCell className="text-right">
                    {line.discountTotal > 0 ? (
                      <div className="leading-tight">
                        <span className="text-warning">
                          − <Money value={line.discountTotal} suffix={null} />
                        </span>
                        {dt ? <div className="text-[11px] text-text-muted">{dt}</div> : null}
                      </div>
                    ) : (
                      <span className="text-text-muted">{t('visits.lines.noDiscount')}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-text">
                    <Money value={line.lineTotal} suffix={null} />
                  </TableCell>
                  {canEdit ? <TableCell className="text-right">{actions(line)}</TableCell> : null}
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow className="bg-bg-elevated/60 hover:bg-transparent">
              <TableCell
                colSpan={4}
                className="font-heading text-xs font-semibold uppercase tracking-wider text-text-muted"
              >
                {t('visits.lines.totals')} · {t('visits.lines.count', { n: lines.length })}
              </TableCell>
              <TableCell className="text-right text-text-muted">
                {formatQuantity(lines.reduce((a, l) => a + l.quantity, 0))}
              </TableCell>
              <TableCell className="text-right text-text-muted">
                <Money value={sums.gross} suffix={null} />
              </TableCell>
              <TableCell className="text-right text-warning">
                {sums.discount > 0 ? (
                  <>
                    − <Money value={sums.discount} suffix={null} />
                  </>
                ) : (
                  '—'
                )}
              </TableCell>
              <TableCell className="text-right font-heading text-base font-bold text-text">
                <Money value={sums.net} suffix={null} />
              </TableCell>
              {canEdit ? <TableCell /> : null}
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      {/* ── Mobil kartochkalar ── */}
      <ul className="space-y-2 md:hidden" aria-label={t('visits.lines.title')}>
        {lines.map((line, i) => {
          const anatomy = anatomyText(line, t);
          const dt = discountText(line, t);
          return (
            <li key={line.id} className="glass rounded-xl p-3" data-line-id={line.id}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-text-muted">#{i + 1}</span>
                    <span className="rounded-md border border-line bg-bg-elevated px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                      {line.serviceCode}
                    </span>
                  </div>
                  <div className="mt-1 font-medium text-text">{lineName(line, locale)}</div>
                  {anatomy ? <div className="text-xs text-text-muted">{anatomy}</div> : null}
                </div>
                {actions(line)}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {typeBadge(line)}
                {medBadge(line)}
                <Badge variant="outline" className="tabular">
                  {formatQuantity(line.quantity)} {line.unit} × <Money value={line.unitPrice} suffix={null} />
                </Badge>
              </div>
              <div className="tabular mt-2 flex items-center justify-between border-t border-line pt-2 text-sm">
                <span className="text-text-muted">
                  {line.discountTotal > 0 ? (
                    <>
                      {t('common.discount')}:{' '}
                      <span className="text-warning">
                        − <Money value={line.discountTotal} suffix={null} />
                      </span>
                      {dt ? ` (${dt})` : ''}
                    </>
                  ) : (
                    t('common.discountType.NONE')
                  )}
                </span>
                <Money value={line.lineTotal} className="font-heading text-base font-bold text-text" />
              </div>
            </li>
          );
        })}
        <li className="glass-strong tabular flex items-center justify-between rounded-xl px-3 py-2.5 text-sm">
          <span className="font-heading text-xs font-semibold uppercase tracking-wider text-text-muted">
            {t('visits.lines.totals')}
          </span>
          <Money value={sums.net} className="font-heading text-base font-bold text-text" />
        </li>
      </ul>
    </div>
  );
}
