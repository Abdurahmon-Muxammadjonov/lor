'use client';

import * as React from 'react';
import { useT } from '@/i18n/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useDoctorOptions } from '@/lib/queue/queries';

export const ANY_DOCTOR = '__any__';

export interface DoctorSelectProps {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  id?: string;
  /** "Istalgan shifokor" variantini koʻrsatish (default true) */
  allowAny?: boolean;
  enabled?: boolean;
}

/** Faol shifokorlar (GET /api/users?role=DOCTOR&active=1 — staff moduli) */
export function DoctorSelect({ value, onChange, disabled, id, allowAny = true, enabled = true }: DoctorSelectProps) {
  const t = useT();
  const doctors = useDoctorOptions(enabled);
  const items = doctors.data ?? [];
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled || doctors.isLoading}>
      <SelectTrigger id={id} aria-label={t('common.doctor')}>
        <SelectValue placeholder={doctors.isLoading ? t('common.loading') : t('queue.dialog.new.anyDoctor')} />
      </SelectTrigger>
      <SelectContent>
        {allowAny ? <SelectItem value={ANY_DOCTOR}>{t('queue.dialog.new.anyDoctor')}</SelectItem> : null}
        {items.map((d) => (
          <SelectItem key={d.id} value={d.id}>
            <span className="inline-flex items-center gap-2">
              <span className="inline-block size-2.5 rounded-full" style={{ backgroundColor: d.color }} aria-hidden="true" />
              {d.fullName}
              {d.room ? <span className="tabular text-xs text-text-muted">· {t('queue.ticket.room', { room: d.room })}</span> : null}
            </span>
          </SelectItem>
        ))}
        {!doctors.isLoading && items.length === 0 ? (
          <div className="px-2 py-2 text-sm text-text-muted">{t('common.noData')}</div>
        ) : null}
      </SelectContent>
    </Select>
  );
}
