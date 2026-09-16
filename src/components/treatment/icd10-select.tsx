'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Stethoscope, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';
import { useLocale } from '@/i18n/client';
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
import { Spinner } from '@/components/ui/spinner';
import { icd10Key, visitApi } from './visit-api';

export interface Icd10SelectProps {
  value: string | null | undefined;
  /** `null` — kod olib tashlandi; `title` — tanlangan kodning joriy tildagi nomi */
  onChange: (code: string | null, title: string | null) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
}

interface Icd10Item {
  code: string;
  uz: string;
  ru: string;
}

/**
 * ICD-10 kod tanlagich: Popover + Command, `GET /api/icd10?q=` orqali qidiradi.
 * Kod + joriy tildagi nom koʻrsatiladi; tanlangach `onChange(code, title)`.
 */
export function Icd10Select({ value, onChange, disabled = false, id, className }: Icd10SelectProps) {
  const { locale, t } = useLocale();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState('');
  const dq = useDebounce(q.trim(), 250);

  const search = useQuery({
    queryKey: icd10Key(dq),
    queryFn: () => visitApi.icd10(dq, 30),
    enabled: open,
    staleTime: 5 * 60_000,
  });

  // Joriy kodning nomi (aynan mos yozuv 0-reytingda birinchi keladi)
  const current = useQuery({
    queryKey: ['icd10', 'code', value ?? ''] as const,
    queryFn: () => visitApi.icd10(value ?? '', 1),
    enabled: !!value,
    staleTime: 60 * 60_000,
  });
  const currentEntry = React.useMemo<Icd10Item | null>(() => {
    if (!value) return null;
    const hit = current.data?.items.find((i) => i.code.toUpperCase() === value.toUpperCase());
    return hit ?? null;
  }, [current.data, value]);

  const items: Icd10Item[] = search.data?.items ?? [];
  const title = (i: Icd10Item) => (locale === 'ru' ? i.ru : i.uz);

  const select = (item: Icd10Item) => {
    onChange(item.code, title(item));
    setOpen(false);
    setQ('');
  };

  return (
    <div className={cn('flex min-w-0 items-stretch gap-1', className)}>
      <Popover open={open} onOpenChange={(o) => !disabled && setOpen(o)}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-label={t('visits.diagnosis.icd10Select')}
            disabled={disabled}
            className={cn(
              'h-10 min-w-0 flex-1 justify-between overflow-hidden px-3 font-normal',
              !value && 'text-muted-foreground/75',
            )}
          >
            <span className="flex min-w-0 flex-1 items-center gap-2">
              <Stethoscope className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
              {value ? (
                <>
                  <span className="tabular shrink-0 rounded-md border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-accent">
                    {value}
                  </span>
                  <span className="min-w-0 truncate text-sm text-text">
                    {currentEntry ? title(currentEntry) : ''}
                  </span>
                </>
              ) : (
                <span className="min-w-0 truncate">{t('visits.diagnosis.icd10Placeholder')}</span>
              )}
            </span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-60" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(560px,calc(100vw-2rem))] p-0">
          <Command shouldFilter={false} loop>
            <CommandInput
              value={q}
              onValueChange={setQ}
              placeholder={t('visits.diagnosis.icd10Search')}
              autoFocus
            />
            <CommandList>
              {search.isPending ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-text-muted">
                  <Spinner size="sm" label={t('common.loading')} />
                  {t('common.loading')}
                </div>
              ) : (
                <>
                  <CommandEmpty>{t('visits.diagnosis.icd10NoResults')}</CommandEmpty>
                  <CommandGroup heading="ICD-10">
                    {items.map((item) => {
                      const active = !!value && item.code.toUpperCase() === value.toUpperCase();
                      return (
                        <CommandItem
                          key={item.code}
                          value={item.code}
                          onSelect={() => select(item)}
                          className="items-start gap-3"
                        >
                          <span className="tabular mt-0.5 w-14 shrink-0 rounded-md border border-line bg-surface px-1.5 py-0.5 text-center text-xs font-semibold text-accent">
                            {item.code}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm text-text">{title(item)}</span>
                            <span className="block truncate text-xs text-text-muted">
                              {locale === 'ru' ? item.uz : item.ru}
                            </span>
                          </span>
                          {active ? (
                            <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                          ) : null}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {value && !disabled ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={t('visits.diagnosis.icd10Clear')}
          onClick={() => onChange(null, null)}
          className="shrink-0 text-text-muted hover:text-danger"
        >
          <X aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}
