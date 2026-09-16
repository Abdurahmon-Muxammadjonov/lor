'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { useLocale } from '@/i18n/client';
import type { Locale } from '@/i18n/config';
import { Badge, type BadgeProps } from '@/components/ui/badge';

export type StatusKind = 'queue' | 'visit' | 'appointment' | 'payment' | 'shift';

type Variant = NonNullable<BadgeProps['variant']>;

interface StatusStyle {
  variant: Variant;
  dot?: boolean;
  pulse?: boolean;
}

const STYLES: Record<StatusKind, Record<string, StatusStyle>> = {
  queue: {
    WAITING: { variant: 'warning', dot: true },
    CALLED: { variant: 'accent', dot: true, pulse: true },
    SERVING: { variant: 'success', dot: true, pulse: true },
    DONE: { variant: 'secondary' },
    SKIPPED: { variant: 'danger' },
  },
  visit: {
    OPEN: { variant: 'accent', dot: true },
    COMPLETED: { variant: 'success' },
    CANCELLED: { variant: 'danger' },
  },
  appointment: {
    SCHEDULED: { variant: 'outline', dot: true },
    CONFIRMED: { variant: 'accent', dot: true },
    ARRIVED: { variant: 'warning', dot: true },
    DONE: { variant: 'success' },
    CANCELLED: { variant: 'danger' },
    NO_SHOW: { variant: 'secondary' },
  },
  payment: {
    PAID: { variant: 'success' },
    PARTIAL: { variant: 'warning', dot: true },
    UNPAID: { variant: 'danger', dot: true },
    DEBT: { variant: 'danger', dot: true },
    REFUNDED: { variant: 'secondary' },
    OVERPAID: { variant: 'accent' },
  },
  shift: {
    OPEN: { variant: 'success', dot: true, pulse: true },
    CLOSED: { variant: 'secondary' },
  },
};

/** `common.*Status` da yoʻq holatlar uchun mahalliy lugʻat */
const LOCAL_LABELS: Record<Locale, Partial<Record<StatusKind, Record<string, string>>>> = {
  uz: {
    payment: {
      PAID: 'Toʻlangan',
      PARTIAL: 'Qisman toʻlangan',
      UNPAID: 'Toʻlanmagan',
      DEBT: 'Qarz',
      REFUNDED: 'Qaytarilgan',
      OVERPAID: 'Ortiqcha toʻlov',
    },
    shift: {
      OPEN: 'Ochiq',
      CLOSED: 'Yopilgan',
    },
  },
  ru: {
    payment: {
      PAID: 'Оплачено',
      PARTIAL: 'Частично оплачено',
      UNPAID: 'Не оплачено',
      DEBT: 'Долг',
      REFUNDED: 'Возвращено',
      OVERPAID: 'Переплата',
    },
    shift: {
      OPEN: 'Открыта',
      CLOSED: 'Закрыта',
    },
  },
};

const COMMON_KEY: Partial<Record<StatusKind, string>> = {
  queue: 'common.queueStatus',
  visit: 'common.visitStatus',
  appointment: 'common.appointmentStatus',
};

export interface StatusBadgeProps extends Omit<BadgeProps, 'variant' | 'children'> {
  kind: StatusKind;
  status: string;
  /** Nuqta indikatorini majburan yoqish/oʻchirish */
  dot?: boolean;
  /** Matnni almashtirish */
  label?: React.ReactNode;
}

/**
 * Holat belgisi — turi va holat kodi boʻyicha rang va tarjima.
 *
 *   <StatusBadge kind="queue" status={row.status} />
 *   <StatusBadge kind="payment" status={visit.paidAmount >= visit.totalNet ? 'PAID' : 'PARTIAL'} />
 */
export const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ kind, status, dot, label, className, ...props }, ref) => {
    const { locale, t } = useLocale();
    const style = STYLES[kind][status] ?? { variant: 'outline' as const };

    let text: React.ReactNode = label;
    if (text === undefined) {
      const key = COMMON_KEY[kind];
      if (key) {
        const full = `${key}.${status}`;
        const translated = t(full);
        text = translated === full ? status : translated;
      } else {
        text = LOCAL_LABELS[locale][kind]?.[status] ?? status;
      }
    }

    const showDot = dot ?? style.dot ?? false;

    return (
      <Badge ref={ref} variant={style.variant} className={cn('gap-1.5', className)} data-status={status} data-kind={kind} {...props}>
        {showDot ? (
          <span aria-hidden="true" className="relative flex size-1.5">
            {style.pulse ? (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-60 motion-reduce:hidden" />
            ) : null}
            <span className="relative inline-flex size-1.5 rounded-full bg-current" />
          </span>
        ) : null}
        {text}
      </Badge>
    );
  },
);
StatusBadge.displayName = 'StatusBadge';
