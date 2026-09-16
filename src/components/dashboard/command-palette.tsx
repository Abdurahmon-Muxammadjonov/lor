'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  CornerDownLeft,
  Search,
  Ticket,
  UserPlus,
  UserRound,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { SessionUser } from '@/lib/auth/session';
import { normalizeSearch, formatPhone } from '@/lib/utils';
import { can, type Permission } from '@/lib/permissions';
import { useLocale } from '@/i18n/client';
import { useDebounce } from '@/hooks/use-debounce';
import { useHotkey, formatHotkey } from '@/hooks/use-hotkey';
import { useUiStore } from '@/stores/use-ui-store';
import { navForRole } from '@/lib/dashboard/nav';
import { fmtDate } from '@/lib/date';
import { Kbd } from '@/components/ui/kbd';
import { Spinner } from '@/components/ui/spinner';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { GenderAvatar } from '@/components/shared/gender-avatar';
import { usePatientSearch } from './queries';

interface QuickAction {
  key: string;
  labelKey: string;
  href: string;
  icon: LucideIcon;
  permission: Permission;
}

/** Tezkor amallar — boshqa modullar sahifalariga `?new=1` bilan oʻtadi (patients / queue / cashier) */
const QUICK_ACTIONS: readonly QuickAction[] = [
  {
    key: 'new-patient',
    labelKey: 'dashboard.search.newPatient',
    href: '/dashboard/patients?new=1',
    icon: UserPlus,
    permission: 'patients.write',
  },
  {
    key: 'new-ticket',
    labelKey: 'dashboard.search.newTicket',
    href: '/dashboard/queue?new=1',
    icon: Ticket,
    permission: 'queue.manage',
  },
  {
    key: 'cashier',
    labelKey: 'dashboard.search.cashier',
    href: '/dashboard/cashier',
    icon: Wallet,
    permission: 'payments.view',
  },
] as const;

const SEARCH_HOTKEY = 'mod+k';

/** ⌘K buyruqlar paneli: bemorlar (GET /api/patients/search), tezkor amallar, sahifalar */
export function CommandPalette({ user }: { user: SessionUser }) {
  const { t, locale } = useLocale();
  const router = useRouter();
  const open = useUiStore((s) => s.commandOpen);
  const setOpen = useUiStore((s) => s.setCommandOpen);
  const toggle = useUiStore((s) => s.toggleCommand);
  const [query, setQuery] = React.useState('');
  const debounced = useDebounce(query.trim(), 250);
  const searching = debounced.length >= 2;
  const { data: patients, isFetching, isError } = usePatientSearch(debounced, open);

  useHotkey(SEARCH_HOTKEY, toggle);
  useHotkey('/', () => setOpen(true));

  React.useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const go = React.useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router, setOpen],
  );

  const norm = normalizeSearch(query);
  const pages = React.useMemo(() => {
    const items = navForRole(user.role).map((n) => ({
      key: n.key,
      href: n.href,
      label: t(n.labelKey),
      icon: n.icon,
      shortcut: n.shortcut,
    }));
    items.push({
      key: 'profile',
      href: '/dashboard/profile',
      label: t('common.nav.profile'),
      icon: UserRound,
      shortcut: undefined,
    });
    return norm ? items.filter((i) => normalizeSearch(i.label).includes(norm)) : items;
  }, [user.role, t, norm]);

  const actions = React.useMemo(() => {
    const allowed = QUICK_ACTIONS.filter((a) => can(user.role, a.permission)).map((a) => ({
      ...a,
      label: t(a.labelKey),
    }));
    return norm ? allowed.filter((a) => normalizeSearch(a.label).includes(norm)) : allowed;
  }, [user.role, t, norm]);

  const patientItems = patients ?? [];
  const showPatientsGroup = searching || patientItems.length > 0;
  const nothing = pages.length === 0 && actions.length === 0 && patientItems.length === 0 && !isFetching;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent
        hideClose
        className="top-[12%] max-w-xl translate-y-0 overflow-hidden p-0 shadow-glow-lg sm:top-[18%]"
      >
        <DialogTitle className="sr-only">{t('dashboard.search.title')}</DialogTitle>
        <DialogDescription className="sr-only">{t('dashboard.search.description')}</DialogDescription>
        {/* shouldFilter=false: bemorlar serverdan keladi, sahifalar/amallar qoʻlda filtrlanadi */}
        <Command
          shouldFilter={false}
          loop
          className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.18em] [&_[cmdk-group-heading]]:text-text-muted [&_[cmdk-group]]:px-1 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-2.5"
        >
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder={t('dashboard.search.placeholder')}
            aria-label={t('dashboard.search.button')}
          />
          <CommandList className="max-h-[min(60vh,420px)]">
            {nothing ? (
              <CommandEmpty>
                {searching ? t('dashboard.search.noPatients') : t('common.noResults')}
              </CommandEmpty>
            ) : null}

            {showPatientsGroup ? (
              <CommandGroup heading={t('dashboard.search.patients')}>
                {!searching && query.trim().length > 0 ? (
                  <div className="px-2 py-2 text-xs text-text-muted">{t('dashboard.search.typeMore')}</div>
                ) : null}
                {searching && isFetching && patientItems.length === 0 ? (
                  <div className="flex items-center gap-2 px-2 py-2 text-xs text-text-muted">
                    <Spinner size="xs" />
                    {t('dashboard.search.searching')}
                  </div>
                ) : null}
                {searching && isError ? (
                  <div className="px-2 py-2 text-xs text-danger">{t('dashboard.search.error')}</div>
                ) : null}
                {searching && !isFetching && !isError && patientItems.length === 0 ? (
                  <div className="px-2 py-2 text-xs text-text-muted">{t('dashboard.search.noPatients')}</div>
                ) : null}
                {patientItems.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={`patient-${p.id}`}
                    onSelect={() => go(`/dashboard/patients/${p.id}`)}
                    className="gap-3"
                  >
                    <GenderAvatar gender={p.gender} name={p.fullName} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-text">{p.fullName}</span>
                      <span className="block truncate text-xs text-text-muted">
                        {t('dashboard.search.card')} {p.cardNumber} · {formatPhone(p.phone)} ·{' '}
                        {fmtDate(p.birthDate, locale)}
                      </span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {actions.length > 0 ? (
              <>
                {showPatientsGroup ? <CommandSeparator /> : null}
                <CommandGroup heading={t('dashboard.search.actions')}>
                  {actions.map((a) => {
                    const Icon = a.icon;
                    return (
                      <CommandItem key={a.key} value={`action-${a.key}`} onSelect={() => go(a.href)}>
                        <Icon aria-hidden="true" />
                        <span className="flex-1">{a.label}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            ) : null}

            {pages.length > 0 ? (
              <>
                {actions.length > 0 || showPatientsGroup ? <CommandSeparator /> : null}
                <CommandGroup heading={t('dashboard.search.pages')}>
                  {pages.map((p) => {
                    const Icon = p.icon;
                    return (
                      <CommandItem key={p.key} value={`page-${p.key}`} onSelect={() => go(p.href)}>
                        <Icon aria-hidden="true" />
                        <span className="flex-1">{p.label}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </>
            ) : null}
          </CommandList>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line px-3 py-2 text-[11px] text-text-muted">
            <span className="inline-flex items-center gap-1">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> {t('dashboard.search.navigate')}
            </span>
            <span className="inline-flex items-center gap-1">
              <Kbd>
                <CornerDownLeft className="size-3" aria-hidden="true" />
              </Kbd>{' '}
              {t('dashboard.search.select')}
            </span>
            <span className="inline-flex items-center gap-1">
              <Kbd>Esc</Kbd> {t('dashboard.search.close')}
            </span>
            <span className="ml-auto hidden text-muted-foreground/70 sm:inline">
              {t('dashboard.search.hint')}
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

/** Topbar qidiruv tugmasi — ⌘K yorligʻi bilan */
export function SearchButton({ className }: { className?: string }) {
  const { t } = useLocale();
  const setOpen = useUiStore((s) => s.setCommandOpen);
  const [hotkey, setHotkey] = React.useState('⌘K');
  React.useEffect(() => {
    setHotkey(formatHotkey(SEARCH_HOTKEY));
  }, []);
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={t('dashboard.search.button')}
      aria-keyshortcuts="Meta+K Control+K"
      className={
        className ??
        'group inline-flex h-9 items-center gap-2 rounded-full border border-line bg-bg-elevated px-3 text-sm text-text-muted transition-colors hover:border-primary/30 hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
      }
    >
      <Search className="size-4" aria-hidden="true" />
      <span className="hidden sm:inline">{t('dashboard.search.button')}</span>
      <Kbd className="hidden sm:inline-flex">{hotkey}</Kbd>
    </button>
  );
}
