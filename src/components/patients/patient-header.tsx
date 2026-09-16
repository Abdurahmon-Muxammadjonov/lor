'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Activity,
  Baby,
  BadgeInfo,
  CalendarClock,
  CalendarPlus,
  ChevronRight,
  EllipsisVertical,
  HeartPulse,
  MapPin,
  MessageSquareText,
  Pencil,
  Phone,
  Stethoscope,
  Ticket,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale, useT } from '@/i18n/client';
import { fmtDateTime } from '@/lib/date';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GenderAvatar } from '@/components/shared/gender-avatar';
import { PhoneLink } from '@/components/shared/phone-link';
import { CopyButton } from '@/components/shared/copy-button';
import type { PatientDTO } from '@/lib/patients/types';
import { formatAge, formatBirthDate, isNoneText } from '@/lib/patients/format';

export interface PatientHeaderProps {
  patient: PatientDTO;
  canEdit: boolean;
  canVisit: boolean;
  canQueue: boolean;
  canBook: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onStartVisit: () => void;
  onEnqueue: () => void;
  onDelete: () => void;
  visitPending?: boolean;
}

function InfoRow({
  icon: Icon,
  label,
  children,
  className,
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start gap-2.5', className)}>
      <Icon className="mt-0.5 size-4 shrink-0 text-text-muted" aria-hidden="true" />
      <div className="min-w-0">
        <dt className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{label}</dt>
        <dd className="mt-0.5 break-words text-sm text-text">{children}</dd>
      </div>
    </div>
  );
}

/** Bemor kartasi sarlavhasi: avatar, ism, karta №, yosh/tur, jins, aloqa, tibbiy maʼlumotlar va amallar */
export function PatientHeader({
  patient: p,
  canEdit,
  canVisit,
  canQueue,
  canBook,
  canDelete,
  onEdit,
  onStartVisit,
  onEnqueue,
  onDelete,
  visitPending = false,
}: PatientHeaderProps) {
  const t = useT();
  const { locale } = useLocale();
  const child = p.patientType === 'CHILD';

  return (
    <div className="space-y-4">
      <nav
        aria-label={t('patients.card.breadcrumb')}
        className="flex items-center gap-1 text-xs text-text-muted"
      >
        <Link
          href="/dashboard"
          className="rounded-sm hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t('common.nav.dashboard')}
        </Link>
        <ChevronRight className="size-3.5" aria-hidden="true" />
        <Link
          href="/dashboard/patients"
          className="rounded-sm hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t('patients.card.breadcrumb')}
        </Link>
        <ChevronRight className="size-3.5" aria-hidden="true" />
        <span className="truncate text-text" aria-current="page">
          {p.cardNumber}
        </span>
      </nav>

      <section
        className="glass relative overflow-hidden rounded-2xl p-5 sm:p-6"
        aria-labelledby="patient-name"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-28 size-72 rounded-full bg-accent opacity-[0.07] blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 left-1/3 size-64 rounded-full bg-accent-2 opacity-[0.06] blur-3xl"
        />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start">
          <GenderAvatar gender={p.gender} name={p.fullName} size="xl" className="shrink-0 shadow-glow" />

          <div className="min-w-0 flex-1">
            <h1
              id="patient-name"
              className="font-heading text-2xl font-bold leading-tight tracking-tight text-text sm:text-3xl"
            >
              {p.fullName}
            </h1>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1">
                <Badge variant="accent" className="tabular font-mono text-sm">
                  {p.cardNumber}
                </Badge>
                <CopyButton
                  text={p.cardNumber}
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label={t('patients.card.copyCard')}
                />
              </span>
              <Badge variant={child ? 'warning' : 'outline'} className="tabular">
                {child ? <Baby aria-hidden="true" /> : null}
                {formatAge(p.birthDate, t)} · {t(`common.patientType.${p.patientType}`)}
              </Badge>
              <Badge variant="outline">{t(`common.gender.${p.gender}`)}</Badge>
              <Badge variant="outline" className="tabular">
                {formatBirthDate(p.birthDate, locale)}
              </Badge>
              <Badge variant={p.smsConsent ? 'success' : 'secondary'}>
                SMS: {p.smsConsent ? t('patients.card.smsYes') : t('patients.card.smsNo')}
              </Badge>
            </div>

            {!isNoneText(p.allergies) ? (
              <div
                role="alert"
                className="mt-4 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5"
              >
                <HeartPulse className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-danger">
                    {t('patients.card.allergies')}
                  </div>
                  <div className="text-sm font-medium text-text">{p.allergies}</div>
                </div>
              </div>
            ) : (
              <p className="mt-4 inline-flex items-center gap-2 rounded-lg border border-line bg-bg-elevated px-3 py-1.5 text-xs text-text-muted">
                <HeartPulse className="size-3.5" aria-hidden="true" />
                {t('patients.card.allergiesNone')}
              </p>
            )}

            <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
              <InfoRow icon={Phone} label={t('patients.card.phones')}>
                <div className="tabular flex flex-wrap items-center gap-x-3 gap-y-1">
                  <PhoneLink phone={p.phone} className="font-medium hover:text-accent" />
                  {p.phone2 ? (
                    <PhoneLink phone={p.phone2} className="text-text-muted hover:text-accent" />
                  ) : null}
                </div>
              </InfoRow>
              <InfoRow icon={MapPin} label={t('patients.card.address')}>
                {p.address || <span className="text-text-muted">—</span>}
              </InfoRow>
              <InfoRow icon={Activity} label={t('patients.card.chronic')}>
                {isNoneText(p.chronic) ? <span className="text-text-muted">—</span> : p.chronic}
              </InfoRow>
              <InfoRow icon={BadgeInfo} label={t('patients.card.source')}>
                {p.source || <span className="text-text-muted">—</span>}
              </InfoRow>
              {p.notes ? (
                <InfoRow icon={MessageSquareText} label={t('patients.card.notes')} className="sm:col-span-2">
                  <span className="whitespace-pre-line">{p.notes}</span>
                </InfoRow>
              ) : null}
              <InfoRow icon={CalendarClock} label={t('patients.card.registered')} className="sm:col-span-2">
                <span className="tabular">{fmtDateTime(p.createdAt, locale)}</span>
                {p.updatedAt !== p.createdAt ? (
                  <span className="tabular ml-3 text-xs text-text-muted">
                    {t('patients.card.updated')}: {fmtDateTime(p.updatedAt, locale)}
                  </span>
                ) : null}
              </InfoRow>
            </dl>
          </div>

          <div className="flex flex-wrap gap-2 lg:w-56 lg:flex-col lg:items-stretch">
            {canVisit ? (
              <Button
                type="button"
                variant="gradient"
                className="shadow-glow"
                onClick={onStartVisit}
                loading={visitPending}
              >
                <Stethoscope aria-hidden="true" />
                {t('patients.actions.newVisit')}
              </Button>
            ) : null}
            {canQueue ? (
              <Button type="button" variant="secondary" onClick={onEnqueue}>
                <Ticket aria-hidden="true" />
                {t('patients.actions.queueAdd')}
              </Button>
            ) : null}
            {canBook ? (
              <Button asChild variant="outline">
                <Link href={`/dashboard/appointments?patientId=${encodeURIComponent(p.id)}`}>
                  <CalendarPlus aria-hidden="true" />
                  {t('patients.actions.book')}
                </Link>
              </Button>
            ) : null}
            <div className="flex gap-2">
              {canEdit ? (
                <Button type="button" variant="outline" onClick={onEdit} className="flex-1">
                  <Pencil aria-hidden="true" />
                  {t('patients.actions.edit')}
                </Button>
              ) : null}
              {canDelete ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={t('patients.actions.more')}
                    >
                      <EllipsisVertical aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem destructive onSelect={onDelete}>
                      <Trash2 aria-hidden="true" />
                      {t('patients.actions.delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
