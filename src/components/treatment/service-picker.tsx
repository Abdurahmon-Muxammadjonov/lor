'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, Pill } from 'lucide-react';
import { cn, normalizeSearch } from '@/lib/utils';
import { formatMoney } from '@/lib/money';
import { useLocale } from '@/i18n/client';
import type { TreatmentServiceDTO } from '@/lib/visits/dto';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { nameByLocale } from './visit-utils';

export interface ServicePickerProps {
  services: TreatmentServiceDTO[];
  value: string | null;
  onChange: (serviceId: string) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  /** Qiymat oʻzgarganda (va xizmat tanlanmagan boʻlsa) roʻyxatni avtomatik ochadi — dialog `onOpenAutoFocus` dan chaqiriladi */
  autoOpenKey?: number;
}

interface CategoryGroup {
  id: string;
  label: string;
  order: number;
  items: TreatmentServiceDTO[];
}

const m = (v: number) => formatMoney(v, { suffix: '' });

/** Toʻrt narx: "K 120 000 / 150 000 · B 90 000 / 110 000" (dorisiz / dori bilan) */
export function priceHint(s: TreatmentServiceDTO, labels: { adult: string; child: string }): string {
  const adult = s.medicineOptional ? `${m(s.priceAdultNoMed)} / ${m(s.priceAdultMed)}` : m(s.priceAdultMed);
  const child = s.medicineOptional ? `${m(s.priceChildNoMed)} / ${m(s.priceChildMed)}` : m(s.priceChildMed);
  return `${labels.adult} ${adult} · ${labels.child} ${child}`;
}

/**
 * Xizmat tanlagich: Command qidiruv (nom/kod, ikkala tilda), kategoriya boʻyicha guruhlangan,
 * har bir xizmatda 4 narx koʻrsatkichi.
 */
export function ServicePicker({
  services,
  value,
  onChange,
  disabled = false,
  id,
  className,
  autoOpenKey = 0,
}: ServicePickerProps) {
  const { locale, t } = useLocale();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const hasValue = !!value;

  // Dialog fokusni oʻrnatgandan soʻng (onOpenAutoFocus) ochiladi — shunda popover fokus tuzogʻi bilan toʻqnashmaydi
  React.useEffect(() => {
    if (!autoOpenKey || hasValue || disabled) return undefined;
    triggerRef.current?.focus();
    const id = window.setTimeout(() => setOpen(true), 60);
    return () => window.clearTimeout(id);
  }, [autoOpenKey, hasValue, disabled]);

  const current = React.useMemo(() => services.find((s) => s.id === value) ?? null, [services, value]);

  const groups = React.useMemo<CategoryGroup[]>(() => {
    const query = normalizeSearch(q);
    const map = new Map<string, CategoryGroup>();
    for (const s of services) {
      if (!s.isActive && s.id !== value) continue;
      if (query) {
        const hay = `${s.code} ${normalizeSearch(s.name)} ${normalizeSearch(s.nameRu)}`.toLowerCase();
        const words = query.split(' ').filter(Boolean);
        if (!words.every((w) => hay.includes(w))) continue;
      }
      const g = map.get(s.category.id) ?? {
        id: s.category.id,
        label: nameByLocale(s.category, locale),
        order: s.category.order,
        items: [],
      };
      g.items.push(s);
      map.set(s.category.id, g);
    }
    return [...map.values()].sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
  }, [services, q, value, locale]);

  const labels = {
    adult: t('visits.dialog.priceAdult').slice(0, 1),
    child: t('visits.dialog.priceChild').slice(0, 1),
  };

  const select = (s: TreatmentServiceDTO) => {
    onChange(s.id);
    setOpen(false);
    setQ('');
  };

  return (
    <Popover open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
      <PopoverTrigger asChild>
        <Button
          ref={triggerRef}
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label={t('visits.dialog.service')}
          disabled={disabled}
          className={cn(
            'h-auto min-h-11 w-full justify-between overflow-hidden px-3 py-2 text-left font-normal',
            !current && 'text-muted-foreground/75',
            current && 'border-primary/40 shadow-[0_0_0_1px_rgba(0,212,255,0.15)]',
            className,
          )}
        >
          {current ? (
            <span className="flex min-w-0 flex-1 items-center gap-2.5">
              <span className="tabular shrink-0 rounded-md border border-line bg-surface px-1.5 py-0.5 text-xs font-semibold text-accent">
                {current.code}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-text">
                  {nameByLocale(current, locale)}
                </span>
                <span className="block truncate text-xs text-text-muted">
                  {nameByLocale(current.category, locale)} · {priceHint(current, labels)}
                </span>
              </span>
            </span>
          ) : (
            <span className="min-w-0 truncate">{t('visits.dialog.servicePlaceholder')}</span>
          )}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-60" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(640px,calc(100vw-2rem))] p-0">
        <Command shouldFilter={false} loop>
          <CommandInput
            value={q}
            onValueChange={setQ}
            placeholder={t('visits.dialog.serviceSearch')}
            autoFocus
          />
          <CommandList className="max-h-[min(420px,60vh)]">
            <CommandEmpty>{t('visits.dialog.serviceNoResults')}</CommandEmpty>
            {groups.map((g) => (
              <CommandGroup key={g.id} heading={g.label}>
                {g.items.map((s) => {
                  const active = s.id === value;
                  return (
                    <CommandItem
                      key={s.id}
                      value={s.id}
                      onSelect={() => select(s)}
                      className="items-start gap-3 py-2"
                    >
                      <span className="tabular mt-0.5 w-14 shrink-0 rounded-md border border-line bg-surface px-1.5 py-0.5 text-center text-xs font-semibold text-accent">
                        {s.code}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm text-text">{nameByLocale(s, locale)}</span>
                          {!s.medicineOptional ? (
                            <Pill
                              className="size-3.5 shrink-0 text-[#7C5CFF]"
                              aria-label={t('visits.dialog.medicineForced')}
                            />
                          ) : null}
                          {!s.isActive ? (
                            <span className="text-[10px] uppercase tracking-wider text-danger">
                              {t('common.inactive')}
                            </span>
                          ) : null}
                        </span>
                        <span className="tabular block text-xs text-text-muted">
                          {priceHint(s, labels)} · {s.unit}
                          {s.allowHalf ? '' : ` · ${t('visits.dialog.wholeOnly')}`}
                        </span>
                      </span>
                      {active ? (
                        <Check className="mt-1 size-4 shrink-0 text-accent" aria-hidden="true" />
                      ) : null}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
