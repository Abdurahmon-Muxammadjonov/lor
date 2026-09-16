'use client';

import * as React from 'react';
import { useT } from '@/i18n/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import type { DoctorOptionDTO } from '@/lib/patients/types';

export interface DoctorSelectProps {
  id?: string;
  doctors: DoctorOptionDTO[] | undefined;
  loading?: boolean;
  value: string;
  onChange: (id: string) => void;
  /** Boʻsh tanlov ("Istalgan shifokor") — navbat uchun */
  anyLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
}

export const ANY_DOCTOR = '__any__';

/** Shifokor tanlash: rang belgisi, ism, mutaxassislik va xona */
export function DoctorSelect({
  id,
  doctors,
  loading,
  value,
  onChange,
  anyLabel,
  placeholder,
  disabled,
  invalid,
}: DoctorSelectProps) {
  const t = useT();
  if (loading) return <Skeleton className="h-10 w-full" />;
  const list = doctors ?? [];
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled || (list.length === 0 && !anyLabel)}>
      <SelectTrigger id={id} aria-invalid={invalid || undefined}>
        <SelectValue placeholder={placeholder ?? t('patients.visitDialog.selectDoctor')} />
      </SelectTrigger>
      <SelectContent>
        {anyLabel ? (
          <SelectItem value={ANY_DOCTOR}>
            <span className="text-text-muted">{anyLabel}</span>
          </SelectItem>
        ) : null}
        {list.length === 0 ? (
          <div className="px-3 py-2 text-sm text-text-muted">{t('patients.visitDialog.noDoctors')}</div>
        ) : (
          list.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: d.color }}
                />
                <span className="font-medium">{d.fullName}</span>
                {d.specialty ? <span className="text-xs text-text-muted">· {d.specialty}</span> : null}
                {d.room ? (
                  <span className="text-xs text-text-muted">
                    · {d.room} {t('patients.visits.room')}
                  </span>
                ) : null}
              </span>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
