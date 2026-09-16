'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/client';
import type { PriceField } from '@/lib/services/schemas';
import type { ServiceDTO } from '@/lib/services/types';
import { PriceCell } from './price-cell';

export interface PriceGridProps {
  service: ServiceDTO;
  canEdit: boolean;
  onSave: (field: PriceField, value: number) => Promise<void>;
  className?: string;
}

/**
 * 4 xil narx — 2×2 mini-jadval:
 *            Dorisiz     Dori bilan
 *  Kattalar  [80 000]    [100 000]
 *  Bolalar   [60 000]    [80 000]
 */
export function PriceGrid({ service, canEdit, onSave, className }: PriceGridProps) {
  const t = useT();
  const medOnly = !service.medicineOptional;
  const hint = t('services.prices.medOnlyHint');

  const head = 'px-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted';
  const rowLabel = 'pr-2 text-[11px] font-medium text-text-muted whitespace-nowrap';

  return (
    <div
      role="group"
      aria-label={t('services.table.prices')}
      className={cn('grid grid-cols-[auto_1fr_1fr] items-center gap-x-1 gap-y-0.5', className)}
    >
      <span aria-hidden="true" />
      <span className={cn(head, 'text-right')}>{t('services.prices.noMed')}</span>
      <span className={cn(head, 'text-right')}>{t('services.prices.med')}</span>

      <span className={rowLabel}>{t('services.prices.adult')}</span>
      <PriceCell
        field="priceAdultNoMed"
        value={service.priceAdultNoMed}
        label={t('services.prices.adultNoMed')}
        canEdit={canEdit}
        dimmed={medOnly}
        dimmedHint={medOnly ? hint : undefined}
        onSave={onSave}
      />
      <PriceCell
        field="priceAdultMed"
        value={service.priceAdultMed}
        label={t('services.prices.adultMed')}
        canEdit={canEdit}
        onSave={onSave}
      />

      <span className={rowLabel}>{t('services.prices.child')}</span>
      <PriceCell
        field="priceChildNoMed"
        value={service.priceChildNoMed}
        label={t('services.prices.childNoMed')}
        canEdit={canEdit}
        dimmed={medOnly}
        dimmedHint={medOnly ? hint : undefined}
        onSave={onSave}
      />
      <PriceCell
        field="priceChildMed"
        value={service.priceChildMed}
        label={t('services.prices.childMed')}
        canEdit={canEdit}
        onSave={onSave}
      />
    </div>
  );
}
