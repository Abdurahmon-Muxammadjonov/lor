'use client';

import * as React from 'react';
import { ArrowDownUp, Baby, Users, Wallet, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/client';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SearchInput } from '@/components/shared/search-input';
import type { PatientListParams } from '@/lib/patients/types';
import { countActiveFilters } from '@/lib/patients/list-params';

export type TypeFilter = 'ALL' | 'ADULT' | 'CHILD';
type GenderFilter = 'ALL' | 'MALE' | 'FEMALE';
type SortValue = NonNullable<PatientListParams['sort']>;

export interface PatientFiltersProps {
  params: PatientListParams;
  onChange: (patch: Partial<PatientListParams>) => void;
  onReset: () => void;
  searching?: boolean;
  className?: string;
}

/** Qidiruv + filtrlar (jins, kattalar/bolalar, qarzdorlar) + saralash. Mobilda ikki qatorga oʻraladi. */
export function PatientFilters({
  params,
  onChange,
  onReset,
  searching = false,
  className,
}: PatientFiltersProps) {
  const t = useT();
  const active = countActiveFilters(params);
  const hasAny = active > 0 || !!params.q;

  return (
    <div
      className={cn('flex flex-col gap-3', className)}
      role="search"
      aria-label={t('patients.filters.title')}
    >
      <SearchInput
        value={params.q ?? ''}
        onChange={(q) => onChange({ q, page: 1 })}
        placeholder={t('patients.searchPlaceholder')}
        loading={searching}
        size="lg"
        className="w-full"
        aria-label={t('common.search')}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Segmented<TypeFilter>
          size="sm"
          ariaLabel={t('patients.filters.type')}
          value={params.type ?? 'ALL'}
          onChange={(v) => onChange({ type: v === 'ALL' ? undefined : v, page: 1 })}
          options={[
            { value: 'ALL', label: t('patients.filters.all') },
            { value: 'ADULT', label: t('patients.filters.adults'), icon: <Users aria-hidden="true" /> },
            { value: 'CHILD', label: t('patients.filters.children'), icon: <Baby aria-hidden="true" /> },
          ]}
        />

        <Select
          value={(params.gender ?? 'ALL') as GenderFilter}
          onValueChange={(v: GenderFilter) => onChange({ gender: v === 'ALL' ? undefined : v, page: 1 })}
        >
          <SelectTrigger
            className="h-9 w-auto min-w-[8.5rem] text-xs"
            aria-label={t('patients.filters.gender')}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">
              {t('patients.filters.gender')}: {t('patients.filters.all')}
            </SelectItem>
            <SelectItem value="MALE">{t('common.gender.MALE')}</SelectItem>
            <SelectItem value="FEMALE">{t('common.gender.FEMALE')}</SelectItem>
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-pressed={!!params.hasDebt}
          onClick={() => onChange({ hasDebt: !params.hasDebt, page: 1 })}
          className={cn(
            params.hasDebt &&
              'border-destructive/50 bg-destructive/10 text-danger hover:bg-destructive/15 hover:text-danger',
          )}
        >
          <Wallet aria-hidden="true" />
          {t('patients.filters.debtors')}
        </Button>

        <div className="ms-auto flex items-center gap-2">
          <Select
            value={params.sort ?? 'created'}
            onValueChange={(v: SortValue) => onChange({ sort: v, page: 1 })}
          >
            <SelectTrigger className="h-9 w-auto min-w-[10rem] text-xs" aria-label={t('patients.sort.label')}>
              <ArrowDownUp className="size-3.5 shrink-0 text-text-muted" aria-hidden="true" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created">{t('patients.sort.created')}</SelectItem>
              <SelectItem value="name">{t('patients.sort.name')}</SelectItem>
              <SelectItem value="lastVisit">{t('patients.sort.lastVisit')}</SelectItem>
            </SelectContent>
          </Select>
          {hasAny ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onReset}
              aria-label={t('patients.filters.reset')}
            >
              <X aria-hidden="true" />
              <span className="hidden sm:inline">{t('patients.filters.reset')}</span>
              {active > 0 ? (
                <span className="sr-only sm:not-sr-only sm:text-text-muted">
                  ({t('patients.filters.active', { n: active })})
                </span>
              ) : null}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
