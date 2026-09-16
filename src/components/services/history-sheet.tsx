'use client';

import * as React from 'react';
import { ArrowRight, History, Sparkles, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import { fmtDateTime } from '@/lib/date';
import { useLocale, pickLang } from '@/i18n/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { PRICE_FIELDS, type PriceField } from '@/lib/services/schemas';
import type { ServiceDTO, ServiceHistoryItemDTO } from '@/lib/services/types';
import { useServiceHistoryQuery } from './use-services';

export interface HistorySheetProps {
  service: ServiceDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FIELD_LABEL_KEY: Record<PriceField, string> = {
  priceAdultNoMed: 'services.prices.adultNoMed',
  priceAdultMed: 'services.prices.adultMed',
  priceChildNoMed: 'services.prices.childNoMed',
  priceChildMed: 'services.prices.childMed',
};

/** Boshqa (narx boʻlmagan) maydonlar uchun yorliq kalitlari */
const OTHER_FIELD_LABEL_KEY: Record<string, string> = {
  code: 'services.fields.code',
  categoryId: 'services.fields.category',
  name: 'services.fields.name',
  nameRu: 'services.fields.nameRu',
  unit: 'services.fields.unit',
  allowHalf: 'services.fields.allowHalf',
  medicineOptional: 'services.fields.medicineOptional',
  durationMin: 'services.fields.duration',
  defaultOrgan: 'services.fields.defaultOrgan',
  isActive: 'services.fields.isActive',
};

const isPriceField = (k: string): k is PriceField => (PRICE_FIELDS as readonly string[]).includes(k);

function labelFor(key: string, t: (k: string) => string): string {
  const labelKey = OTHER_FIELD_LABEL_KEY[key];
  return labelKey ? t(labelKey) : key;
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim())) return Number(v);
  return null;
}

interface BulkMeta {
  mode: string;
  value: number;
  roundTo: number;
}

function bulkMetaOf(after: Record<string, unknown> | null): BulkMeta | null {
  const b = after?.bulk;
  if (!b || typeof b !== 'object') return null;
  const rec = b as Record<string, unknown>;
  const value = asNumber(rec.value);
  const roundTo = asNumber(rec.roundTo);
  if (typeof rec.mode !== 'string' || value === null || roundTo === null) return null;
  return { mode: rec.mode, value, roundTo };
}

/** Narx oʻzgarishi (AuditLog) — sheet (oʻng tomondan chiqadigan panel) */
export function HistorySheet({ service, open, onOpenChange }: HistorySheetProps) {
  const { t, locale } = useLocale();
  const query = useServiceHistoryQuery(open && service ? service.id : null);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader className="pr-8 text-left">
          <SheetTitle className="flex items-center gap-2">
            <History className="size-5 text-accent" aria-hidden="true" />
            {t('services.history.title')}
          </SheetTitle>
          <SheetDescription>
            {service ? (
              <span className="inline-flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-primary/25 bg-primary/10 px-1.5 py-0.5 font-mono text-xs font-semibold text-accent">
                  {service.code}
                </span>
                <span>{pickLang(service, locale)}</span>
              </span>
            ) : null}
          </SheetDescription>
        </SheetHeader>

        {service ? (
          <div className="mt-2 grid grid-cols-[auto_1fr_1fr] items-center gap-x-3 gap-y-1 rounded-xl border border-line bg-surface p-3 text-xs">
            <span aria-hidden="true" />
            <span className="text-right font-semibold uppercase tracking-wider text-text-muted">{t('services.prices.noMed')}</span>
            <span className="text-right font-semibold uppercase tracking-wider text-text-muted">{t('services.prices.med')}</span>
            <span className="text-text-muted">{t('services.prices.adult')}</span>
            <span className="text-right tabular font-medium text-text">{formatMoney(service.priceAdultNoMed, { suffix: '' })}</span>
            <span className="text-right tabular font-medium text-text">{formatMoney(service.priceAdultMed, { suffix: '' })}</span>
            <span className="text-text-muted">{t('services.prices.child')}</span>
            <span className="text-right tabular font-medium text-text">{formatMoney(service.priceChildNoMed, { suffix: '' })}</span>
            <span className="text-right tabular font-medium text-text">{formatMoney(service.priceChildMed, { suffix: '' })}</span>
          </div>
        ) : null}

        <div className="mt-2 flex-1">
          {query.isPending ? (
            <ul className="space-y-3" aria-busy="true">
              {Array.from({ length: 4 }).map((_, i) => (
                <li key={i} className="rounded-xl border border-line bg-surface p-4">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="mt-2 h-3 w-56 max-w-full" />
                  <Skeleton className="mt-3 h-3 w-48" />
                </li>
              ))}
            </ul>
          ) : query.isError ? (
            <EmptyState
              compact
              icon={History}
              title={t('services.history.loadError')}
              action={
                <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
                  {t('common.retry')}
                </Button>
              }
            />
          ) : query.data && query.data.length > 0 ? (
            <ol className="relative space-y-3 before:absolute before:bottom-3 before:left-[11px] before:top-3 before:w-px before:bg-line">
              {query.data.map((item) => (
                <HistoryEntry key={item.id} item={item} t={t} locale={locale} />
              ))}
            </ol>
          ) : (
            <EmptyState compact icon={History} title={t('services.history.empty')} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface HistoryEntryProps {
  item: ServiceHistoryItemDTO;
  t: (key: string, params?: Record<string, string | number>) => string;
  locale: 'uz' | 'ru';
}

function HistoryEntry({ item, t, locale }: HistoryEntryProps) {
  const bulk = item.action === 'PRICE_CHANGE' ? bulkMetaOf(item.after) : null;
  const before = item.before ?? {};
  const after = item.after ?? {};

  let title: string;
  let tone: 'accent' | 'success' | 'danger' | 'outline' | 'warning' = 'outline';
  switch (item.action) {
    case 'PRICE_CHANGE':
      title = bulk ? t('services.history.bulkChange') : t('services.history.priceChange');
      tone = 'accent';
      break;
    case 'CREATE':
      title = t('services.history.created');
      tone = 'success';
      break;
    case 'DELETE':
      title = t('services.history.deleted');
      tone = 'danger';
      break;
    case 'UPDATE': {
      const keys = Object.keys(after).filter((k) => k !== 'code');
      if (keys.length === 1 && keys[0] === 'isActive') {
        title = after.isActive ? t('services.history.activated') : t('services.history.deactivated');
        tone = after.isActive ? 'success' : 'warning';
      } else {
        title = t('services.history.updated');
      }
      break;
    }
    default:
      title = item.action;
  }

  const priceRows =
    item.action === 'PRICE_CHANGE'
      ? PRICE_FIELDS.map((f) => ({ field: f, from: asNumber(before[f]), to: asNumber(after[f]) })).filter(
          (r) => r.from !== null && r.to !== null && r.from !== r.to,
        )
      : item.action === 'CREATE'
        ? PRICE_FIELDS.map((f) => ({ field: f, from: null, to: asNumber(after[f]) })).filter((r) => r.to !== null)
        : [];

  const otherRows =
    item.action === 'UPDATE'
      ? Object.keys(after)
          .filter((k) => k !== 'code' && !isPriceField(k))
          .map((k) => ({ key: k, from: before[k], to: after[k] }))
      : [];

  const bulkModeLabel = bulk
    ? bulk.mode === 'PERCENT'
      ? t('services.history.modePercent')
      : bulk.mode === 'FIXED'
        ? t('services.history.modeFixed')
        : t('services.history.modeSet')
    : '';
  const bulkValueLabel = bulk
    ? bulk.mode === 'PERCENT'
      ? `${bulk.value > 0 ? '+' : ''}${bulk.value} %`
      : formatMoney(bulk.value, { signed: bulk.mode === 'FIXED', suffix: t('common.currency') })
    : '';

  const fmtValue = (v: unknown): string => {
    if (v === null || v === undefined || v === '') return '—';
    if (typeof v === 'boolean') return v ? t('common.yes') : t('common.no');
    if (typeof v === 'number') return String(v);
    if (typeof v === 'string') {
      if (/^(EAR|NOSE|THROAT|LARYNX|OTHER)$/.test(v)) return t(`common.organ.${v}`);
      if (/^(ta|seans|kun)$/.test(v)) return t(`services.units.${v}`);
      return v;
    }
    return JSON.stringify(v);
  };

  return (
    <li className="relative pl-8">
      <span
        aria-hidden="true"
        className={cn(
          'absolute left-0 top-4 flex size-6 items-center justify-center rounded-full border bg-bg-elevated',
          tone === 'accent' && 'border-primary/40 text-accent shadow-glow',
          tone === 'success' && 'border-[#00FFB2]/40 text-[#00FFB2]',
          tone === 'danger' && 'border-destructive/40 text-danger',
          tone === 'warning' && 'border-warning/40 text-warning',
          tone === 'outline' && 'border-line text-text-muted',
        )}
      >
        {bulk ? <Sparkles className="size-3" /> : <History className="size-3" />}
      </span>
      <article className="rounded-xl border border-line bg-surface p-4">
        <header className="flex flex-wrap items-center justify-between gap-2">
          <Badge variant={tone}>{title}</Badge>
          <time dateTime={item.createdAt} className="text-xs text-text-muted tabular">
            {fmtDateTime(item.createdAt, locale)}
          </time>
        </header>

        {priceRows.length > 0 ? (
          <dl className="mt-3 space-y-1.5">
            {priceRows.map((r) => (
              <div key={r.field} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-sm">
                <dt className="text-xs text-text-muted">{t(FIELD_LABEL_KEY[r.field])}</dt>
                <dd className="inline-flex items-center gap-1.5 tabular">
                  {r.from !== null ? (
                    <>
                      <span className="text-text-muted line-through">{formatMoney(r.from, { suffix: '' })}</span>
                      <ArrowRight className="size-3 text-text-muted" aria-hidden="true" />
                    </>
                  ) : null}
                  <span
                    className={cn(
                      'font-semibold',
                      r.from !== null && r.to !== null && r.to > r.from && 'text-[#00FFB2]',
                      r.from !== null && r.to !== null && r.to < r.from && 'text-warning',
                      (r.from === null || r.to === null || r.to === r.from) && 'text-text',
                    )}
                  >
                    {formatMoney(r.to ?? 0, { suffix: '' })}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        {otherRows.length > 0 ? (
          <dl className="mt-3 space-y-1.5">
            {otherRows.map((r) => (
              <div key={r.key} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-sm">
                <dt className="text-xs text-text-muted">{labelFor(r.key, t)}</dt>
                <dd className="inline-flex items-center gap-1.5">
                  <span className="text-text-muted line-through">{fmtValue(r.from)}</span>
                  <ArrowRight className="size-3 text-text-muted" aria-hidden="true" />
                  <span className="font-medium text-text">{fmtValue(r.to)}</span>
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        {bulk ? (
          <p className="mt-3 text-xs text-text-muted">
            {t('services.history.bulkRule', {
              mode: bulkModeLabel,
              value: bulkValueLabel,
              roundTo: formatMoney(bulk.roundTo, { suffix: '' }),
            })}
          </p>
        ) : null}

        <footer className="mt-3 flex items-center gap-1.5 text-xs text-text-muted">
          <UserRound className="size-3.5" aria-hidden="true" />
          <span>{item.user?.fullName ?? t('services.history.system')}</span>
        </footer>
      </article>
    </li>
  );
}
