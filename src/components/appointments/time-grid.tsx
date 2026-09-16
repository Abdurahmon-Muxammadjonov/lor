'use client';

import * as React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/client';
import { minutesToHm } from '@/lib/date';
import { nonWorkingRanges, type ScheduleReason } from '@/lib/appointments/availability';
import { placeAppointments, type CalendarColumn } from '@/lib/appointments/calendar';
import { AppointmentCard } from './appointment-card';
import { useCalendar } from './calendar-context';
import { AXIS_W, CARD_MIN_PX, COLUMN_MIN_W, SLOT_PX } from './constants';
import { dropIdFor } from './dnd-keyboard';

export interface TimeGridProps {
  columns: CalendarColumn[];
  renderHeader: (col: CalendarColumn) => React.ReactNode;
  /** Kartada shifokor rangi nuqtasi (hafta / "barchasi") */
  showDoctorOnCards: boolean;
  workStart: string;
  workEnd: string;
  onSlotClick?: (col: CalendarColumn, minutes: number) => void;
  className?: string;
}

const SHADE_LABEL: Record<ScheduleReason, string> = {
  DAY_OFF: 'appointments.grid.dayOff',
  BREAK: 'appointments.grid.break',
  OUTSIDE_HOURS: 'appointments.grid.offHours',
};

/**
 * Vaqt oʻqi + ustunlar toʻri (kun: shifokorlar, hafta: kunlar). Kartalar vaqt boʻyicha absolyut joylashadi,
 * har ustun @dnd-kit droppable, boʻsh katak — yangi yozilish tugmasi.
 */
export function TimeGrid({
  columns,
  renderHeader,
  showDoctorOnCards,
  workStart,
  workEnd,
  onSlotClick,
  className,
}: TimeGridProps) {
  const cal = useCalendar();
  const t = useT();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const rows = React.useMemo(() => {
    const out: number[] = [];
    for (let m = cal.workStartMin; m < cal.workEndMin; m += cal.slotMinutes) out.push(m);
    return out;
  }, [cal.workStartMin, cal.workEndMin, cal.slotMinutes]);
  const totalPx = (cal.workEndMin - cal.workStartMin) * cal.pxPerMin;

  // Birinchi ochilishda: bugun boʻlsa hozirgi vaqtga, aks holda birinchi kartaga aylantirish
  const scrolledRef = React.useRef(false);
  React.useEffect(() => {
    if (scrolledRef.current || cal.now.minutes < 0) return;
    const el = scrollRef.current;
    if (!el) return;
    scrolledRef.current = true;
    const firstStart = columns
      .flatMap((c) => c.items)
      .map((a) => {
        const d = new Date(a.startAt);
        return (d.getTime() / 60000 + 300) % 1440;
      })
      .sort((a, b) => a - b)[0];
    const isTodayVisible = columns.some((c) => c.dateKey === cal.now.dateKey);
    const target = isTodayVisible ? cal.now.minutes : firstStart;
    if (target === undefined) return;
    const y = (Math.max(target, cal.workStartMin) - cal.workStartMin) * cal.pxPerMin - SLOT_PX * 2;
    el.scrollTop = Math.max(0, y);
  }, [columns, cal.now, cal.workStartMin, cal.pxPerMin]);

  const template = `${AXIS_W} repeat(${Math.max(1, columns.length)}, minmax(${COLUMN_MIN_W}, 1fr))`;

  return (
    <div className={cn('glass overflow-hidden rounded-xl', className)}>
      <div
        ref={scrollRef}
        className="scrollbar-thin relative max-h-[calc(100dvh-15rem)] min-h-[20rem] overflow-auto overscroll-contain"
        role="region"
        aria-label={t('appointments.grid.time')}
      >
        <div className="grid min-w-max" style={{ gridTemplateColumns: template }}>
          {/* Sarlavha qatori */}
          <div
            className="sticky left-0 top-0 z-40 border-b border-r border-line bg-popover/95 backdrop-blur"
            aria-hidden="true"
          />
          {columns.map((col) => (
            <div
              key={col.key}
              className="sticky top-0 z-30 min-w-0 border-b border-l border-border/60 bg-popover/95 backdrop-blur"
            >
              {renderHeader(col)}
            </div>
          ))}

          {/* Vaqt oʻqi */}
          <div
            className="sticky left-0 z-20 border-r border-line bg-popover/95 text-right backdrop-blur"
            style={{ height: totalPx }}
            aria-hidden="true"
          >
            {rows.map((m) => {
              const hour = m % 60 === 0;
              return (
                <div
                  key={m}
                  className={cn(
                    'tabular absolute right-0 flex w-full justify-end pr-2 text-[11px] leading-none',
                    hour ? 'text-text-muted' : 'text-muted-foreground/50',
                  )}
                  style={{ top: Math.max(0, (m - cal.workStartMin) * cal.pxPerMin - 6) }}
                >
                  {hour || cal.slotMinutes >= 30 ? minutesToHm(m) : null}
                </div>
              );
            })}
          </div>

          {columns.map((col) => (
            <GridColumn
              key={col.key}
              column={col}
              rows={rows}
              totalPx={totalPx}
              workStart={workStart}
              workEnd={workEnd}
              showDoctor={showDoctorOnCards}
              shadeLabel={(r) => t(SHADE_LABEL[r])}
              onSlotClick={onSlotClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface GridColumnProps {
  column: CalendarColumn;
  rows: number[];
  totalPx: number;
  workStart: string;
  workEnd: string;
  showDoctor: boolean;
  shadeLabel: (r: ScheduleReason) => string;
  onSlotClick?: (col: CalendarColumn, minutes: number) => void;
}

function GridColumn({
  column: col,
  rows,
  totalPx,
  workStart,
  workEnd,
  showDoctor,
  shadeLabel,
  onSlotClick,
}: GridColumnProps) {
  const cal = useCalendar();
  const t = useT();
  const { setNodeRef, isOver } = useDroppable({ id: dropIdFor(col.key), data: { columnKey: col.key } });

  const placed = React.useMemo(
    () =>
      placeAppointments(col.items, {
        workStartMin: cal.workStartMin,
        workEndMin: cal.workEndMin,
        pxPerMin: cal.pxPerMin,
        minHeightPx: CARD_MIN_PX,
      }),
    [col.items, cal.workStartMin, cal.workEndMin, cal.pxPerMin],
  );
  const shades = React.useMemo(
    () => nonWorkingRanges(col.schedule, col.dateKey, workStart, workEnd),
    [col.schedule, col.dateKey, workStart, workEnd],
  );
  const dayOff = shades.some((s) => s.reason === 'DAY_OFF');
  const isToday = col.dateKey === cal.now.dateKey;
  const isPastDay = col.dateKey < cal.now.dateKey;
  const nowTop =
    isToday && cal.now.minutes >= cal.workStartMin && cal.now.minutes <= cal.workEndMin
      ? (cal.now.minutes - cal.workStartMin) * cal.pxPerMin
      : null;
  const preview = cal.dragPreview && cal.dragPreview.columnKey === col.key ? cal.dragPreview : null;
  const previewItem = preview
    ? (col.items.find((a) => a.id === preview.id) ?? cal.dragPreview?.appointment ?? null)
    : null;
  const previewDuration = previewItem
    ? Math.max(
        1,
        Math.round((new Date(previewItem.endAt).getTime() - new Date(previewItem.startAt).getTime()) / 60000),
      )
    : cal.slotMinutes;

  const slotDisabled = (m: number) => isPastDay || (isToday && m + cal.slotMinutes <= cal.now.minutes);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'relative min-w-0 border-l border-border/60 transition-colors duration-150',
        isOver && 'bg-primary/5',
        isPastDay && 'bg-black/10',
      )}
      style={{ height: totalPx }}
      data-column={col.key}
    >
      {/* Ishlanmaydigan oraliqlar */}
      {shades.map((s, i) => (
        <div
          key={`${s.reason}-${i}`}
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 z-[1] flex items-start justify-center overflow-hidden bg-[repeating-linear-gradient(135deg,transparent_0_7px,rgba(138,153,184,0.07)_7px_8px)]"
          style={{ top: (s.from - cal.workStartMin) * cal.pxPerMin, height: (s.to - s.from) * cal.pxPerMin }}
        >
          {(s.to - s.from) * cal.pxPerMin >= 40 ? (
            <span
              className={cn(
                'mt-2 rounded-full border border-border/70 bg-popover/80 px-2 py-0.5 text-[10px] uppercase tracking-wider text-text-muted',
                dayOff && 'sticky top-14',
              )}
            >
              {shadeLabel(s.reason)}
            </span>
          ) : null}
        </div>
      ))}

      {/* Slot qatorlari */}
      {rows.map((m) => {
        const hour = m % 60 === 0;
        const top = (m - cal.workStartMin) * cal.pxPerMin;
        const disabled = slotDisabled(m);
        const time = minutesToHm(m);
        if (cal.canWrite && onSlotClick && !disabled) {
          return (
            <button
              key={m}
              type="button"
              className={cn(
                'group absolute inset-x-0 z-[2] flex items-start justify-end border-t px-1.5 text-[10px] text-transparent transition-colors',
                hour ? 'border-border/70' : 'border-border/30',
                'hover:bg-primary/5 hover:text-accent focus-visible:z-[3] focus-visible:bg-primary/10 focus-visible:text-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring',
              )}
              style={{ top, height: cal.slotMinutes * cal.pxPerMin }}
              aria-label={t('appointments.grid.newAt', { time })}
              onClick={() => onSlotClick(col, m)}
            >
              <span className="tabular mt-0.5 inline-flex items-center gap-0.5">
                <Plus className="size-3" aria-hidden="true" />
                {time}
              </span>
            </button>
          );
        }
        return (
          <div
            key={m}
            aria-hidden="true"
            className={cn(
              'absolute inset-x-0 z-[2] border-t',
              hour ? 'border-border/70' : 'border-border/30',
              disabled && 'bg-[repeating-linear-gradient(135deg,transparent_0_5px,rgba(0,0,0,0.12)_5px_6px)]',
            )}
            style={{ top, height: cal.slotMinutes * cal.pxPerMin }}
          />
        );
      })}

      {/* Hozirgi vaqt chizigʻi */}
      {nowTop !== null ? (
        <div
          className="pointer-events-none absolute inset-x-0 z-20 flex items-center"
          style={{ top: nowTop }}
          aria-label={t('appointments.grid.now')}
          role="presentation"
        >
          <span className="-ml-1 size-2 rounded-full bg-danger shadow-[0_0_8px_rgba(255,77,109,0.8)]" />
          <span className="h-px flex-1 bg-destructive/80" />
        </div>
      ) : null}

      {/* Sudrash koʻrsatkichi */}
      {preview ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-1 z-[5] rounded-md border-2 border-dashed border-accent bg-primary/10"
          style={{
            top: (preview.startMin - cal.workStartMin) * cal.pxPerMin,
            height: Math.max(CARD_MIN_PX, previewDuration * cal.pxPerMin - 2),
          }}
        >
          <span className="tabular absolute left-1.5 top-1 rounded bg-popover/90 px-1 text-[10px] font-semibold text-accent">
            {minutesToHm(preview.startMin)}–{minutesToHm(preview.startMin + previewDuration)}
          </span>
        </div>
      ) : null}

      {/* Kartalar */}
      {placed.map((p) => (
        <AppointmentCard
          key={p.appointment.id}
          appointment={p.appointment}
          columnKey={col.key}
          top={p.top}
          height={p.height}
          lane={p.lane}
          lanes={p.lanes}
          showDoctor={showDoctor}
        />
      ))}
    </div>
  );
}
