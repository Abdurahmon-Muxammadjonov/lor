'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronsUpDown, ExternalLink, UserPlus, UserRound, X } from 'lucide-react';
import { cn, formatPhone } from '@/lib/utils';
import { useT } from '@/i18n/client';
import { useDebounce } from '@/hooks/use-debounce';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';
import { GenderAvatar } from '@/components/shared/gender-avatar';
import { usePatientSearch } from '@/lib/queue/queries';

export interface PatientLite {
  id: string;
  fullName: string;
  cardNumber: string;
  phone: string;
  gender?: 'MALE' | 'FEMALE' | null;
}

export interface PatientPickerProps {
  value: PatientLite | null;
  onChange: (p: PatientLite | null) => void;
  disabled?: boolean;
  id?: string;
  invalid?: boolean;
  autoOpen?: boolean;
}

const MIN_QUERY = 2;

/** Bemor tanlash (GET /api/patients/search — patients moduli): ism / telefon / karta raqami */
export function PatientPicker({ value, onChange, disabled, id, invalid, autoOpen = false }: PatientPickerProps) {
  const t = useT();
  const [open, setOpen] = React.useState(autoOpen);
  const [query, setQuery] = React.useState('');
  const listId = React.useId();
  const debounced = useDebounce(query, 250);
  const search = usePatientSearch(debounced, open);
  const items = search.data ?? [];
  const tooShort = debounced.trim().length < MIN_QUERY;

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-md border border-line bg-bg-elevated px-3 py-2" id={id}>
        <GenderAvatar gender={value.gender ?? null} name={value.fullName} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-text">{value.fullName}</div>
          <div className="tabular truncate text-xs text-text-muted">
            {value.cardNumber}
            {value.phone ? ` · ${formatPhone(value.phone)}` : ''}
          </div>
        </div>
        <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-xs">
          <Link href={`/dashboard/patients/${value.id}`} target="_blank" rel="noopener" aria-label={t('queue.picker.open')}>
            <ExternalLink aria-hidden="true" />
          </Link>
        </Button>
        {!disabled ? (
          <Button type="button" variant="outline" size="sm" className="h-8 px-2 text-xs" onClick={() => onChange(null)}>
            <X aria-hidden="true" />
            {t('queue.picker.change')}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-haspopup="listbox"
          aria-invalid={invalid || undefined}
          disabled={disabled}
          className={cn(
            'flex h-10 w-full items-center justify-between gap-2 rounded-md border border-line bg-bg-elevated px-3 py-2 text-sm text-text shadow-sm transition-[border-color,box-shadow]',
            'hover:border-[#2B3A57] focus:outline-none focus-visible:border-accent focus-visible:ring-[3px] focus-visible:ring-ring/25',
            'disabled:cursor-not-allowed disabled:opacity-50',
            invalid && 'border-danger',
          )}
        >
          <span className="inline-flex items-center gap-2 text-muted-foreground/75">
            <UserRound className="size-4" aria-hidden="true" />
            {t('queue.picker.placeholder')}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] min-w-[18rem] p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
        <Command shouldFilter={false} loop>
          <CommandInput autoFocus value={query} onValueChange={setQuery} placeholder={t('queue.picker.search')} aria-label={t('common.patient')} />
          <CommandList id={listId}>
            {tooShort ? (
              <div className="px-3 py-6 text-center text-sm text-text-muted">{t('queue.picker.typeToSearch')}</div>
            ) : search.isPending ? (
              <div className="flex items-center justify-center gap-2 px-3 py-6 text-sm text-text-muted">
                <Spinner size="sm" label={t('queue.picker.loading')} />
                {t('queue.picker.loading')}
              </div>
            ) : search.isError ? (
              <div className="px-3 py-6 text-center text-sm text-danger">{t('common.error')}</div>
            ) : (
              <>
                <CommandEmpty>{t('queue.picker.notFound')}</CommandEmpty>
                {items.length > 0 ? (
                  <CommandGroup>
                    {items.map((p) => (
                      <CommandItem
                        key={p.id}
                        value={p.id}
                        onSelect={() => {
                          onChange({ id: p.id, fullName: p.fullName, cardNumber: p.cardNumber, phone: p.phone, gender: p.gender });
                          setOpen(false);
                          setQuery('');
                        }}
                        className="gap-3"
                      >
                        <GenderAvatar gender={p.gender} name={p.fullName} size="xs" />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-sm text-text">{p.fullName}</span>
                          <span className="tabular truncate text-xs text-text-muted">
                            {p.cardNumber} · {formatPhone(p.phone)}
                          </span>
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}
              </>
            )}
          </CommandList>
          <div className="border-t border-line p-1">
            <Link
              href="/dashboard/patients?new=1"
              target="_blank"
              rel="noopener"
              className="flex items-center gap-2 rounded-sm px-2 py-2 text-sm text-accent transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <UserPlus className="size-4" aria-hidden="true" />
              {t('queue.picker.createPatient')}
              <ExternalLink className="ml-auto size-3.5 text-text-muted" aria-hidden="true" />
            </Link>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
