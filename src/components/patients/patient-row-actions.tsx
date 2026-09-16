'use client';

import * as React from 'react';
import Link from 'next/link';
import { IdCard, Stethoscope, Ticket } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/client';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { PatientRef } from './start-visit-dialog';

export interface PatientRowActionsProps {
  patient: PatientRef;
  canVisit: boolean;
  canQueue: boolean;
  onVisit: (p: PatientRef) => void;
  onQueue: (p: PatientRef) => void;
  /** Jadval qatori: faqat ikonkalar (tooltip bilan); karta koʻrinishi: matnli tugmalar */
  variant?: 'icons' | 'buttons';
  className?: string;
}

const stop = (e: React.SyntheticEvent) => e.stopPropagation();

/** Qator amallari: Karta · Yangi qabul · Navbatga */
export function PatientRowActions({
  patient,
  canVisit,
  canQueue,
  onVisit,
  onQueue,
  variant = 'icons',
  className,
}: PatientRowActionsProps) {
  const t = useT();
  const href = `/dashboard/patients/${patient.id}`;

  if (variant === 'buttons') {
    return (
      <div className={cn('flex flex-wrap gap-2', className)} onClick={stop} onKeyDown={stop}>
        <Button asChild variant="outline" size="sm">
          <Link href={href} aria-label={`${t('patients.actions.openCard')}: ${patient.fullName}`}>
            <IdCard aria-hidden="true" />
            {t('patients.actions.open')}
          </Link>
        </Button>
        {canVisit ? (
          <Button type="button" size="sm" onClick={() => onVisit(patient)}>
            <Stethoscope aria-hidden="true" />
            {t('patients.actions.newVisit')}
          </Button>
        ) : null}
        {canQueue ? (
          <Button type="button" variant="secondary" size="sm" onClick={() => onQueue(patient)}>
            <Ticket aria-hidden="true" />
            {t('patients.actions.toQueue')}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center justify-end gap-1', className)} onClick={stop} onKeyDown={stop}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button asChild variant="ghost" size="icon" className="size-8">
            <Link href={href} aria-label={`${t('patients.actions.openCard')}: ${patient.fullName}`}>
              <IdCard aria-hidden="true" />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('patients.actions.open')}</TooltipContent>
      </Tooltip>
      {canVisit ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8 text-accent hover:text-accent"
              aria-label={`${t('patients.actions.newVisit')}: ${patient.fullName}`}
              onClick={() => onVisit(patient)}
            >
              <Stethoscope aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('patients.actions.newVisit')}</TooltipContent>
        </Tooltip>
      ) : null}
      {canQueue ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-8"
              aria-label={`${t('patients.actions.queueAdd')}: ${patient.fullName}`}
              onClick={() => onQueue(patient)}
            >
              <Ticket aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t('patients.actions.queueAdd')}</TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}
