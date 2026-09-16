'use client';

import * as React from 'react';
import { CalendarX2, MoreHorizontal, Phone } from 'lucide-react';
import { cn, formatPhone, normalizePhone } from '@/lib/utils';
import { useLocale } from '@/i18n/client';
import { fmtWeekday } from '@/lib/date';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/empty-state';
import { StatusBadge } from '@/components/shared/status-badge';
import { durationMinutes, keyToLocalDate, tzTime } from '@/lib/appointments/availability';
import { groupByDate, type CalendarView } from '@/lib/appointments/calendar';
import type { AppointmentStatusCode } from '@/lib/appointments/schemas';
import type { AppointmentDTO } from '@/lib/appointments/types';
import { useCalendar } from './calendar-context';
import { STATUS_COLOR } from './constants';
import { AppointmentMenu } from './status-menu';

export interface AgendaViewProps {
  items: AppointmentDTO[];
  keys: string[];
  view: CalendarView;
  onNew: () => void;
  className?: string;
}

/** Mobil roʻyxat koʻrinishi: kun — vaqt boʻyicha, hafta — kunlarga guruhlangan */
export function AgendaView({ items, keys, view, onNew, className }: AgendaViewProps) {
  const { t, locale } = useLocale();
  const cal = useCalendar();
  const groups = React.useMemo(() => groupByDate(items), [items]);

  if (items.length === 0) {
    return (
      <EmptyState
        icon={CalendarX2}
        title={view === 'week' ? t('appointments.empty.week') : t('appointments.empty.day')}
        description={cal.canWrite ? t('appointments.empty.description') : t('appointments.empty.readOnly')}
        action={cal.canWrite ? <Button onClick={onNew}>{t('appointments.new')}</Button> : undefined}
        className={className}
      />
    );
  }

  const dayKeys = view === 'week' ? keys : keys.slice(0, 1);

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {dayKeys.map((key) => {
        const list = groups.get(key) ?? [];
        if (view === 'week' && list.length === 0) return null;
        const label = fmtWeekday(keyToLocalDate(key), locale);
        return (
          <section key={key} aria-label={label} className="flex flex-col gap-2">
            {view === 'week' ? (
              <h3 className="flex items-center gap-2 font-heading text-sm font-semibold text-text">
                <span className={cn(key === cal.now.dateKey && 'text-accent')}>
                  {label.charAt(0).toUpperCase() + label.slice(1)}
                </span>
                <span className="text-xs font-normal text-text-muted">
                  {t('appointments.grid.count', { n: list.length })}
                </span>
              </h3>
            ) : null}
            <ul className="flex flex-col gap-2">
              {list.map((a) => (
                <AgendaRow key={a.id} appointment={a} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function AgendaRow({ appointment: a }: { appointment: AppointmentDTO }) {
  const { t } = useLocale();
  const cal = useCalendar();
  const status = a.status as AppointmentStatusCode;
  const phone = normalizePhone(a.patient.phone);
  const muted = status === 'CANCELLED' || status === 'NO_SHOW';
  const pending = cal.pendingIds.has(a.id);

  return (
    <li
      className={cn(
        'glass relative flex items-stretch gap-3 rounded-lg border-l-[3px] p-3 transition-opacity',
        muted && 'opacity-60',
        pending && 'animate-pulse',
      )}
      style={{ borderLeftColor: STATUS_COLOR[status] }}
    >
      <button
        type="button"
        onClick={() => cal.onOpen(a)}
        className="flex min-w-0 flex-1 flex-col gap-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={t('appointments.card.ariaLabel', {
          time: `${tzTime(a.startAt)}–${tzTime(a.endAt)}`,
          patient: a.patient.fullName,
          doctor: a.doctor.fullName,
          status: t(`common.appointmentStatus.${status}`),
        })}
      >
        <div className="flex items-center gap-2">
          <span className="tabular font-heading text-sm font-semibold text-text">
            {tzTime(a.startAt)}–{tzTime(a.endAt)}
          </span>
          <span className="text-[11px] text-text-muted">
            {t('appointments.card.minutes', { n: durationMinutes(a.startAt, a.endAt) })}
          </span>
          <StatusBadge kind="appointment" status={status} className="ml-auto" />
        </div>
        <span
          className={cn(
            'truncate text-sm font-medium text-text',
            muted && 'line-through decoration-text-muted',
          )}
        >
          {a.patient.fullName}
        </span>
        <span className="flex items-center gap-1.5 truncate text-xs text-text-muted">
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: a.doctor.color }}
          />
          <span className="truncate">{a.doctor.fullName}</span>
          {a.doctor.room ? (
            <span className="shrink-0">
              · {t('common.room')} {a.doctor.room}
            </span>
          ) : null}
        </span>
      </button>
      <div className="flex shrink-0 flex-col items-center justify-between gap-1">
        {phone ? (
          <a
            href={`tel:${phone}`}
            aria-label={`${t('appointments.card.phone')}: ${formatPhone(phone)}`}
            className="flex size-8 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Phone className="size-4" aria-hidden="true" />
          </a>
        ) : null}
        <AppointmentMenu appointment={a}>
          <button
            type="button"
            aria-label={t('appointments.card.menu')}
            className="flex size-8 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </button>
        </AppointmentMenu>
      </div>
    </li>
  );
}
