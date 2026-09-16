'use client';

import * as React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { MoreHorizontal, Phone } from 'lucide-react';
import { cn, formatPhone, normalizePhone } from '@/lib/utils';
import { useT } from '@/i18n/client';
import { minutesToHm } from '@/lib/date';
import { durationMinutes, isLockedForMove, tzTime } from '@/lib/appointments/availability';
import type { AppointmentStatusCode } from '@/lib/appointments/schemas';
import type { AppointmentDTO } from '@/lib/appointments/types';
import { STATUS_COLOR, withAlpha } from './constants';
import { useCalendar } from './calendar-context';
import { AppointmentMenu } from './status-menu';

export interface AppointmentCardProps {
  appointment: AppointmentDTO;
  columnKey: string;
  /** px */
  top: number;
  /** px */
  height: number;
  lane: number;
  lanes: number;
  /** Haftalik/"barchasi" koʻrinishida shifokor rangi nuqtasi */
  showDoctor: boolean;
}

export const dragIdFor = (id: string) => `appt:${id}`;

/**
 * Kalendar toʻridagi yozilish kartasi: sudraladi (@dnd-kit), Enter — ochish, "⋯" — amallar menyusi.
 */
export function AppointmentCard({
  appointment: a,
  columnKey,
  top,
  height,
  lane,
  lanes,
  showDoctor,
}: AppointmentCardProps) {
  const t = useT();
  const cal = useCalendar();
  const status = a.status as AppointmentStatusCode;
  const pending = cal.pendingIds.has(a.id);
  const locked = !cal.canWrite || isLockedForMove(status) || pending;
  const [menuOpen, setMenuOpen] = React.useState(false);

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: dragIdFor(a.id),
    data: { appointment: a, columnKey },
    disabled: locked,
  });

  const duration = durationMinutes(a.startAt, a.endAt);
  const timeLabel = `${tzTime(a.startAt)}–${tzTime(a.endAt)}`;
  const preview = cal.dragPreview?.id === a.id ? cal.dragPreview : null;
  const previewLabel = preview
    ? `${minutesToHm(preview.startMin)}–${minutesToHm(preview.startMin + duration)}`
    : null;

  const color = STATUS_COLOR[status];
  const muted = status === 'CANCELLED' || status === 'NO_SHOW';
  const compact = height < 44;
  const statusLabel = t(`common.appointmentStatus.${status}`);
  const ariaLabel = t('appointments.card.ariaLabel', {
    time: timeLabel,
    patient: a.patient.fullName,
    doctor: a.doctor.fullName,
    status: statusLabel,
  });

  const phone = normalizePhone(a.patient.phone);

  const style: React.CSSProperties = {
    top,
    height,
    left: `calc(${(lane / lanes) * 100}% + 2px)`,
    width: `calc(${100 / lanes}% - 4px)`,
    transform: CSS.Translate.toString(transform),
    borderLeftColor: color,
    backgroundColor: withAlpha(color, isDragging ? 0.28 : 0.13),
  };

  const open = () => {
    if (cal.suppressClickRef.current) return;
    cal.onOpen(a);
  };

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-disabled={undefined}
      aria-roledescription={locked ? undefined : attributes['aria-roledescription']}
      aria-describedby={locked ? undefined : attributes['aria-describedby']}
      data-status={status}
      data-cursor="hover"
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          cal.onOpen(a);
        }
      }}
      className={cn(
        'group absolute z-10 select-none overflow-hidden rounded-md border border-l-[3px] border-border/70 text-left shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_6px_16px_-8px_rgba(0,0,0,0.7)] backdrop-blur-sm [touch-action:manipulation]',
        'transition-[box-shadow,opacity,background-color] duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-bg-elevated',
        !locked &&
          'cursor-grab hover:shadow-[0_0_0_1px_rgba(0,212,255,0.35),0_8px_24px_-8px_rgba(0,0,0,0.8)] active:cursor-grabbing',
        locked && 'cursor-pointer',
        isDragging && 'z-40 cursor-grabbing shadow-glow ring-1 ring-primary/60',
        (menuOpen || pending) && 'z-30',
        muted && 'opacity-60',
        pending && 'animate-pulse',
      )}
    >
      <div
        className={cn(
          'flex h-full min-h-0 gap-1 px-2',
          compact ? 'flex-row items-center py-0' : 'flex-col py-1',
        )}
      >
        <div className={cn('flex min-w-0 items-start gap-1', compact ? 'flex-1' : '')}>
          {showDoctor ? (
            <span
              aria-hidden="true"
              className="mt-1 size-2 shrink-0 rounded-full ring-1 ring-black/30"
              style={{ backgroundColor: a.doctor.color }}
              title={a.doctor.fullName}
            />
          ) : null}
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-xs font-semibold leading-4 text-text',
              muted && 'line-through decoration-text-muted',
            )}
          >
            {a.patient.fullName}
          </span>
        </div>
        <div
          className={cn(
            'flex min-w-0 items-center gap-1.5 text-[11px] leading-4 text-text-muted',
            compact && 'shrink-0',
          )}
        >
          <span className={cn('tabular whitespace-nowrap', previewLabel && 'font-semibold text-accent')}>
            {previewLabel ?? timeLabel}
          </span>
          {!compact ? <span className="hidden truncate xl:inline">· {statusLabel}</span> : null}
        </div>
      </div>

      <div
        className={cn(
          'absolute right-1 top-1 flex items-center gap-0.5 rounded-md bg-popover/80 opacity-0 transition-opacity',
          'group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100',
          menuOpen && 'opacity-100',
        )}
        onPointerDown={stop}
        onClick={stop}
        onKeyDown={stop}
      >
        {phone ? (
          <a
            href={`tel:${phone}`}
            aria-label={`${t('appointments.card.phone')}: ${formatPhone(phone)}`}
            title={formatPhone(phone)}
            className="flex size-6 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Phone className="size-3.5" aria-hidden="true" />
          </a>
        ) : null}
        <AppointmentMenu appointment={a} onOpenChange={setMenuOpen}>
          <button
            type="button"
            aria-label={t('appointments.card.menu')}
            className="flex size-6 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </button>
        </AppointmentMenu>
      </div>
    </div>
  );
}
