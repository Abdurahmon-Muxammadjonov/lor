'use client';

import * as React from 'react';
import Link from 'next/link';
import { CalendarClock, CalendarPlus, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale, useT } from '@/i18n/client';
import { format } from 'date-fns';
import { ru as dfRu, uz as dfUz } from 'date-fns/locale';
import { fmtTime, fmtWeekday } from '@/lib/date';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/empty-state';
import { StatusBadge } from '@/components/shared/status-badge';
import type { PatientAppointmentDTO } from '@/lib/patients/types';
import { CardListSkeleton } from './skeletons';
import { patientErrorMessage, usePatientAppointments } from './use-patients';

export interface PatientAppointmentsTabProps {
  patientId: string;
  enabled: boolean;
  canBook: boolean;
}

function AppointmentItem({ a, upcoming }: { a: PatientAppointmentDTO; upcoming: boolean }) {
  const t = useT();
  const { locale } = useLocale();
  return (
    <li
      className={cn(
        'glass flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl p-4',
        !upcoming && 'opacity-90',
      )}
    >
      <div
        className={cn(
          'tabular flex size-12 shrink-0 flex-col items-center justify-center rounded-lg border',
          upcoming
            ? 'border-primary/30 bg-primary/10 text-accent'
            : 'border-line bg-bg-elevated text-text-muted',
        )}
      >
        <span className="font-heading text-lg font-bold leading-none">{new Date(a.startAt).getDate()}</span>
        <span className="text-[10px] uppercase leading-tight">
          {format(new Date(a.startAt), 'LLL', { locale: locale === 'ru' ? dfRu : dfUz })}
        </span>
      </div>
      <div className="min-w-0 flex-1 basis-48">
        <div className="font-medium text-text">{fmtWeekday(a.startAt, locale)}</div>
        <div className="tabular text-sm text-text-muted">
          {fmtTime(a.startAt, locale)}–{fmtTime(a.endAt, locale)}
          <span className="mx-1.5" aria-hidden="true">
            ·
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-2 rounded-full"
              style={{ backgroundColor: a.doctor.color }}
            />
            {a.doctor.fullName}
            {a.doctor.room ? ` · ${a.doctor.room} ${t('patients.visits.room')}` : ''}
          </span>
        </div>
        {a.note ? (
          <div className="mt-1 text-xs text-text-muted">
            {t('patients.appointments.note')}: {a.note}
          </div>
        ) : null}
      </div>
      <StatusBadge kind="appointment" status={a.status} />
      {a.visitId ? (
        <Button asChild variant="ghost" size="sm" className="text-accent hover:text-accent">
          <Link href={`/dashboard/visits/${a.visitId}`}>
            {t('patients.appointments.visit')}
            <ExternalLink aria-hidden="true" />
          </Link>
        </Button>
      ) : null}
    </li>
  );
}

/** Yozilishlar: kelgusi va oʻtgan */
export function PatientAppointmentsTab({ patientId, enabled, canBook }: PatientAppointmentsTabProps) {
  const t = useT();
  const q = usePatientAppointments(patientId, enabled);
  const bookHref = `/dashboard/appointments?patientId=${encodeURIComponent(patientId)}`;

  if (q.isLoading) return <CardListSkeleton rows={2} />;
  if (q.isError || !q.data) {
    return (
      <div className="rounded-xl border border-line bg-surface">
        <EmptyState
          icon={CalendarClock}
          title={t('patients.errors.loadFailed')}
          description={q.error ? patientErrorMessage(q.error, t) : undefined}
          action={
            <Button type="button" variant="outline" size="sm" onClick={() => void q.refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      </div>
    );
  }
  const { upcoming, past } = q.data;
  const bookButton = canBook ? (
    <Button asChild size="sm">
      <Link href={bookHref}>
        <CalendarPlus aria-hidden="true" />
        {t('patients.appointments.book')}
      </Link>
    </Button>
  ) : undefined;

  if (upcoming.length === 0 && past.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-surface">
        <EmptyState
          icon={CalendarClock}
          title={t('patients.appointments.empty')}
          description={t('patients.appointments.emptyDescription')}
          action={bookButton}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section aria-labelledby="appt-upcoming">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 id="appt-upcoming" className="font-heading text-base font-semibold text-text">
            {t('patients.appointments.upcoming')}
            <span className="tabular ml-2 text-sm font-normal text-text-muted">{upcoming.length}</span>
          </h3>
          {bookButton}
        </div>
        {upcoming.length === 0 ? (
          <p className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-text-muted">
            {t('patients.appointments.noUpcoming')}
          </p>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((a) => (
              <AppointmentItem key={a.id} a={a} upcoming />
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby="appt-past">
        <h3 id="appt-past" className="mb-2 font-heading text-base font-semibold text-text">
          {t('patients.appointments.past')}
          <span className="tabular ml-2 text-sm font-normal text-text-muted">{past.length}</span>
        </h3>
        {past.length === 0 ? (
          <p className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-text-muted">
            {t('patients.appointments.noPast')}
          </p>
        ) : (
          <ul className="space-y-2">
            {past.map((a) => (
              <AppointmentItem key={a.id} a={a} upcoming={false} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
