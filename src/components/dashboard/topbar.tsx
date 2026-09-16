'use client';

import * as React from 'react';
import { Menu } from 'lucide-react';
import type { SessionUser } from '@/lib/auth/session';
import { useLocale } from '@/i18n/client';
import { useUiStore } from '@/stores/use-ui-store';
import { Button } from '@/components/ui/button';
import { LangSwitch } from '@/components/shared/lang-switch';
import { Logo } from '@/components/shared/logo';
import { Breadcrumbs } from './breadcrumbs';
import { SearchButton } from './command-palette';
import { QueueBadge } from './queue-badge';
import { TodayPopover } from './today-popover';
import { UserMenu } from './user-menu';

/** Yuqori panel: mobil menyu, breadcrumb, qidiruv (⌘K), navbat belgisi, "Bugun", til, foydalanuvchi */
export function Topbar({ user }: { user: SessionUser }) {
  const { t, locale } = useLocale();
  const setMobileOpen = useUiStore((s) => s.setMobileNavOpen);

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-popover/70 backdrop-blur-xl no-print">
      <div className="mx-auto flex h-16 w-full max-w-[1440px] items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-8">
        <Button variant="ghost" size="icon" className="size-9 shrink-0 lg:hidden" onClick={() => setMobileOpen(true)} aria-label={t('common.openMenu')}>
          <Menu aria-hidden="true" />
        </Button>
        <div className="lg:hidden">
          <Logo withText={false} size="sm" href="/dashboard" />
        </div>
        <div className="min-w-0 flex-1">
          <Breadcrumbs locale={locale} />
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <SearchButton />
          <QueueBadge />
          <TodayPopover />
          <div className="hidden md:block">
            <LangSwitch variant="menu" />
          </div>
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
