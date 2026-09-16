'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu } from 'lucide-react';
import type { Role } from '@prisma/client';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/client';
import { useUiStore } from '@/stores/use-ui-store';
import { isNavActive, mobileTabsForRole } from '@/lib/dashboard/nav';

/** Mobil pastki tab bar: 4 ta asosiy boʻlim + "Menyu" (Sheet ochadi) */
export function MobileTabBar({ role }: { role: Role }) {
  const t = useT();
  const pathname = usePathname();
  const setOpen = useUiStore((s) => s.setMobileNavOpen);
  const tabs = React.useMemo(() => mobileTabsForRole(role, 4), [role]);

  return (
    <nav
      aria-label={t('dashboard.sidebar.navLabel')}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-popover/85 backdrop-blur-xl safe-bottom lg:hidden no-print"
    >
      <ul className="grid h-16" style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}>
        {tabs.map((tab) => {
          const active = isNavActive(pathname, tab);
          const Icon = tab.icon;
          return (
            <li key={tab.key} className="min-w-0">
              <Link
                href={tab.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex h-full flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium outline-none transition-colors',
                  'focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                  active ? 'text-accent' : 'text-text-muted hover:text-text',
                )}
              >
                {active ? <span aria-hidden="true" className="absolute inset-x-4 top-0 h-0.5 rounded-b-full bg-gradient-accent shadow-[0_0_10px_rgba(0,212,255,0.6)]" /> : null}
                <Icon className="size-5" aria-hidden="true" />
                <span className="w-full truncate text-center">{t(tab.labelKey)}</span>
              </Link>
            </li>
          );
        })}
        <li className="min-w-0">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t('dashboard.sidebar.openMenu')}
            className="flex h-full w-full flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium text-text-muted outline-none transition-colors hover:text-text focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          >
            <Menu className="size-5" aria-hidden="true" />
            <span className="w-full truncate text-center">{t('dashboard.sidebar.menu')}</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}
