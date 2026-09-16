'use client';

import * as React from 'react';
import { CalendarRange, FileSpreadsheet, Layers, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale } from '@/i18n/client';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Segmented } from '@/components/ui/segmented';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  MAX_RANGE_DAYS,
  RANGE_PRESETS,
  dateKeyLocal,
  dateKeyToLocalDate,
  daysInRange,
  detectPreset,
  formatRangeLabel,
  normalizeRange,
  presetRange,
  type RangePreset,
} from '@/lib/reports/period';
import type { DoctorOptionDTO, GroupBy, ReportRange } from '@/lib/reports/types';

export interface ReportsToolbarProps {
  range: ReportRange;
  onRangeChange: (r: ReportRange) => void;
  groupBy: GroupBy;
  onGroupByChange: (g: GroupBy) => void;
  /** Guruhlash faqat davrli boʻlimlarda (tushum, kattalar/bolalar) */
  showGroupBy: boolean;
  doctorId: string | null;
  onDoctorChange: (id: string | null) => void;
  doctors: DoctorOptionDTO[];
  doctorsLoading?: boolean;
  /** Shifokor filtri boʻlimga taʼsir qilmasa yashiriladi */
  showDoctor: boolean;
  onExport: (kind: 'current' | 'full') => void;
  exporting: boolean;
  /** reports.full — toʻliq eksport tugmasi */
  canFull: boolean;
  printHref: string;
  className?: string;
}

const ALL = 'all';

/**
 * Yopishqoq filtr paneli: davr presetlari, ixtiyoriy davr (ikki kalendar), guruhlash, shifokor, Excel/PDF.
 * Bitta filtr qatori — barcha grafik/jadvallar shu kesimda qayta chiziladi.
 */
export function ReportsToolbar({
  range,
  onRangeChange,
  groupBy,
  onGroupByChange,
  showGroupBy,
  doctorId,
  onDoctorChange,
  doctors,
  doctorsLoading = false,
  showDoctor,
  onExport,
  exporting,
  canFull,
  printHref,
  className,
}: ReportsToolbarProps) {
  const { t, locale } = useLocale();
  const [open, setOpen] = React.useState(false);
  const [draftFrom, setDraftFrom] = React.useState<Date>(() => dateKeyToLocalDate(range.from));
  const [draftTo, setDraftTo] = React.useState<Date>(() => dateKeyToLocalDate(range.to));
  const preset = detectPreset(range);
  const today = React.useMemo(() => new Date(), []);

  React.useEffect(() => {
    if (open) {
      setDraftFrom(dateKeyToLocalDate(range.from));
      setDraftTo(dateKeyToLocalDate(range.to));
    }
  }, [open, range.from, range.to]);

  const applyDraft = () => {
    const next = normalizeRange(dateKeyLocal(draftFrom), dateKeyLocal(draftTo));
    onRangeChange(next);
    setOpen(false);
  };

  const presetOptions: { value: RangePreset | 'custom'; label: string }[] = RANGE_PRESETS.map((p) => ({ value: p, label: t(`reports.presets.${p}`) }));
  const groupOptions: { value: GroupBy; label: string }[] = [
    { value: 'day', label: t('reports.toolbar.day') },
    { value: 'week', label: t('reports.toolbar.week') },
    { value: 'month', label: t('reports.toolbar.month') },
  ];
  const days = daysInRange(range.from, range.to);

  return (
    <div
      className={cn(
        'glass-strong sticky top-[4.5rem] z-10 flex flex-col gap-3 rounded-xl p-3 sm:flex-row sm:flex-wrap sm:items-center',
        className,
      )}
      role="group"
      aria-label={t('reports.toolbar.range')}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <div className="max-w-full overflow-x-auto scrollbar-none">
          <Segmented<RangePreset | 'custom'>
            value={preset ?? 'custom'}
            onChange={(p) => {
              if (p !== 'custom') onRangeChange(presetRange(p));
            }}
            options={presetOptions}
            size="sm"
            ariaLabel={t('reports.toolbar.range')}
          />
        </div>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={preset ? 'outline' : 'secondary'}
              size="sm"
              aria-label={t('reports.toolbar.rangeLabel')}
              className={cn('tabular', !preset && 'ring-1 ring-primary/40')}
            >
              <CalendarRange aria-hidden="true" />
              <span>{formatRangeLabel(range)}</span>
              <span className="hidden text-text-muted sm:inline">· {t('reports.toolbar.days', { n: days })}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto max-w-[calc(100vw-2rem)] p-3">
            <div className="flex flex-col gap-3 md:flex-row">
              <div>
                <Label className="mb-1.5 block text-xs text-text-muted">{t('reports.toolbar.from')}</Label>
                <Calendar value={draftFrom} onChange={setDraftFrom} max={draftTo < today ? draftTo : today} locale={locale} />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs text-text-muted">{t('reports.toolbar.to')}</Label>
                <Calendar value={draftTo} onChange={setDraftTo} min={draftFrom} max={today} locale={locale} />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
              <span className="text-xs text-text-muted tabular">
                {formatRangeLabel(normalizeRange(dateKeyLocal(draftFrom), dateKeyLocal(draftTo)))} ·{' '}
                {t('reports.toolbar.days', { n: Math.min(MAX_RANGE_DAYS, daysInRange(...sorted(dateKeyLocal(draftFrom), dateKeyLocal(draftTo)))) })}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button variant="gradient" size="sm" onClick={applyDraft}>
                  {t('reports.toolbar.apply')}
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex min-w-0 flex-wrap items-center gap-2 sm:ml-auto">
        {showGroupBy ? (
          <Segmented<GroupBy> value={groupBy} onChange={onGroupByChange} options={groupOptions} size="sm" ariaLabel={t('reports.toolbar.groupBy')} />
        ) : null}
        {showDoctor ? (
          <Select value={doctorId ?? ALL} onValueChange={(v) => onDoctorChange(v === ALL ? null : v)} disabled={doctorsLoading}>
            <SelectTrigger className="h-9 w-full min-w-[160px] text-xs sm:w-auto sm:max-w-[240px]" aria-label={t('reports.toolbar.doctor')}>
              <SelectValue placeholder={t('reports.toolbar.allDoctors')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('reports.toolbar.allDoctors')}</SelectItem>
              {doctors.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  <span className="inline-flex items-center gap-2">
                    <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: d.color ?? '#00D4FF' }} />
                    {d.fullName}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        <div className="flex items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={() => onExport('current')} loading={exporting} aria-label={t('reports.toolbar.excelHint')}>
                {exporting ? null : <FileSpreadsheet aria-hidden="true" />}
                {t('reports.toolbar.excel')}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('reports.toolbar.excelHint')}</TooltipContent>
          </Tooltip>
          {canFull ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-9" onClick={() => onExport('full')} disabled={exporting} aria-label={t('reports.toolbar.excelFull')}>
                  <Layers aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {t('reports.toolbar.excelFull')} — {t('reports.toolbar.excelFullHint')}
              </TooltipContent>
            </Tooltip>
          ) : null}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button asChild variant="gradient" size="sm">
                <a href={printHref} target="_blank" rel="noopener" aria-label={t('reports.toolbar.pdfHint')}>
                  <Printer aria-hidden="true" />
                  {t('reports.toolbar.pdf')}
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-[280px] text-pretty">{t('reports.toolbar.pdfHint')}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}

function sorted(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a];
}
