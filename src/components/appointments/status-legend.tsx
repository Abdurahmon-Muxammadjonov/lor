'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/client';
import { STATUS_COLOR, STATUS_ORDER } from './constants';

/** Holat ranglari izohi (kalendar ostida) */
export function StatusLegend({ className }: { className?: string }) {
  const t = useT();
  return (
    <ul
      className={cn('flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted', className)}
      aria-label={t('appointments.legend.title')}
    >
      {STATUS_ORDER.map((s) => (
        <li key={s} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2.5 rounded-sm"
            style={{ backgroundColor: STATUS_COLOR[s] }}
          />
          {t(`common.appointmentStatus.${s}`)}
        </li>
      ))}
    </ul>
  );
}
