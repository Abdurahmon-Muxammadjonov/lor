'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, CalendarClock, Clock3, HeartPulse, Lock, Ticket } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fmtDate, fmtSmartDate } from '@/lib/date';
import { useLocale } from '@/i18n/client';
import type { VisitDetailDTO } from '@/lib/visits/dto';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { GenderAvatar } from '@/components/shared/gender-avatar';
import { PhoneLink } from '@/components/shared/phone-link';
import { StatusBadge } from '@/components/shared/status-badge';
import { isMeaningfulText, patientAgeInfo } from './visit-utils';

export interface VisitHeaderProps {
  visit: VisitDetailDTO;
  /** Foydalanuvchida umuman tahrirlash huquqi yoʻq (RECEPTION/CASHIER) */
  readOnly: boolean;
  className?: string;
}

/**
 * Qabul sarlavhasi: bemor (karta, yosh, avto bemor turi, jins, telefon, allergiya),
 * shifokor (rang nuqtasi), navbat raqami, holat, ochilgan vaqt.
 */
export function VisitHeader({ visit, readOnly, className }: VisitHeaderProps) {
  const { locale, t } = useLocale();
  const { patient, doctor } = visit;
  const age = React.useMemo(
    () => patientAgeInfo(patient.birthDate, visit.clinic.childAgeLimit, new Date(visit.createdAt)),
    [patient.birthDate, visit.clinic.childAgeLimit, visit.createdAt],
  );
  const hasAllergy = isMeaningfulText(patient.allergies);
  const hasChronic = isMeaningfulText(patient.chronic);

  return (
    <header className={cn('glass-strong rounded-2xl p-4 sm:p-5', className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:gap-4">
          <GenderAvatar gender={patient.gender} name={patient.fullName} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <h1 className="font-heading text-xl font-bold tracking-tight text-text sm:text-2xl">
                <Link
                  href={`/dashboard/patients/${patient.id}`}
                  className="rounded-sm hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`${patient.fullName} — ${t('visits.header.openPatient')}`}
                >
                  {patient.fullName}
                </Link>
              </h1>
              <Badge variant={age.type === 'CHILD' ? 'warning' : 'secondary'} className="font-semibold">
                {age.type === 'CHILD' ? t('visits.header.child', { n: age.age }) : t('visits.header.adult')}
              </Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-muted">
              <span className="tabular">
                {t('visits.header.card')} <span className="font-medium text-text">{patient.cardNumber}</span>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {t('visits.header.age', { n: age.age })} · {fmtDate(patient.birthDate, locale)}
              </span>
              <span aria-hidden="true">·</span>
              <span>{t(`common.gender.${patient.gender}`)}</span>
              <span aria-hidden="true">·</span>
              {patient.phone ? (
                <PhoneLink phone={patient.phone} withIcon className="text-text hover:text-accent" />
              ) : (
                <span>{t('visits.header.noPhone')}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <StatusBadge kind="visit" status={visit.status} className="text-xs" />
          {visit.queue ? (
            <Badge variant="accent" className="tabular gap-1 font-semibold" title={t('visits.header.queue')}>
              <Ticket aria-hidden="true" />
              <span className="sr-only">{t('visits.header.queue')}: </span>
              {visit.queue.number}
            </Badge>
          ) : null}
          {visit.appointment ? (
            <Badge variant="outline" className="gap-1">
              <CalendarClock aria-hidden="true" />
              {t('visits.header.appointment')}
            </Badge>
          ) : null}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-line pt-3 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="size-2.5 shrink-0 rounded-full ring-2 ring-white/10"
            style={{ backgroundColor: doctor.color }}
          />
          <span className="text-text-muted">{t('visits.header.doctor')}:</span>
          <span className="font-medium text-text">{doctor.fullName}</span>
          {doctor.specialty ? (
            <span className="hidden text-text-muted sm:inline">· {doctor.specialty}</span>
          ) : null}
          {doctor.room ? (
            <span className="text-text-muted">
              · {doctor.room} {t('visits.header.room')}
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-2 text-text-muted">
          <Clock3 className="size-4" aria-hidden="true" />
          <span>{t('visits.header.created')}:</span>
          <time dateTime={visit.createdAt} className="text-text">
            {fmtSmartDate(visit.createdAt, locale)}
          </time>
          {visit.completedAt ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{t('visits.header.completed')}:</span>
              <time dateTime={visit.completedAt} className="text-text">
                {fmtSmartDate(visit.completedAt, locale)}
              </time>
            </>
          ) : null}
        </div>
        {readOnly ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-text-muted sm:ml-auto">
            <Lock className="size-3.5" aria-hidden="true" />
            {t('visits.header.readOnly')}
          </span>
        ) : visit.status !== 'OPEN' ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-text-muted sm:ml-auto">
            <Lock className="size-3.5" aria-hidden="true" />
            {visit.status === 'CANCELLED' ? t('visits.header.cancelled') : t('visits.header.closed')}
          </span>
        ) : null}
      </div>

      {hasAllergy || hasChronic ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {hasAllergy ? (
            <Alert variant="danger" className="py-3">
              <AlertTriangle aria-hidden="true" />
              <AlertTitle>{t('visits.header.allergies')}</AlertTitle>
              <AlertDescription className="text-text">{patient.allergies}</AlertDescription>
            </Alert>
          ) : null}
          {hasChronic ? (
            <Alert variant="warning" className="py-3">
              <HeartPulse aria-hidden="true" />
              <AlertTitle>{t('visits.header.chronic')}</AlertTitle>
              <AlertDescription className="text-text">{patient.chronic}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}
