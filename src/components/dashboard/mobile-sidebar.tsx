'use client';

import * as React from 'react';
import type { SessionUser } from '@/lib/auth/session';
import type { MeClinicDTO } from '@/lib/dashboard/types';
import { useT } from '@/i18n/client';
import { useUiStore } from '@/stores/use-ui-store';
import { Logo } from '@/components/shared/logo';
import { LangSwitch } from '@/components/shared/lang-switch';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { PlanBadge } from './plan-badge';
import { SidebarNav } from './sidebar-nav';
import { UserCard } from './user-card';
import { useClinicInfo, useMe } from './queries';

export interface MobileSidebarProps {
  user: SessionUser;
  clinic: MeClinicDTO;
}

/** Mobil (< lg) yon menyu — Sheet ichida toʻliq navigatsiya */
export function MobileSidebar({ user, clinic: initialClinic }: MobileSidebarProps) {
  const t = useT();
  const open = useUiStore((s) => s.mobileNavOpen);
  const setOpen = useUiStore((s) => s.setMobileNavOpen);
  const { data: clinic } = useClinicInfo(initialClinic);
  const { data: me } = useMe();
  const c = clinic ?? initialClinic;
  const close = React.useCallback(() => setOpen(false), [setOpen]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="left" className="flex w-[300px] max-w-[85vw] flex-col gap-0 p-0 lg:hidden">
        <SheetHeader className="border-b border-line px-4 py-4 text-left">
          <div className="flex items-center gap-3">
            <Logo withText={false} size="md" />
            <div className="min-w-0 flex-1">
              <SheetTitle className="truncate text-base">{c.name}</SheetTitle>
              <div className="mt-0.5">
                <PlanBadge plan={c.plan} />
              </div>
            </div>
          </div>
          <SheetDescription className="sr-only">{t('dashboard.sidebar.navLabel')}</SheetDescription>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-3 py-3 scrollbar-thin">
          <SidebarNav role={user.role} kioskKey={c.kioskKey} onNavigate={close} layoutScope="mobile" />
        </div>
        <div className="space-y-3 border-t border-line p-3 safe-bottom">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-medium text-text-muted">{t('common.language')}</span>
            <LangSwitch size="sm" />
          </div>
          <UserCard
            fullName={me?.user.fullName ?? user.fullName}
            role={user.role}
            color={me?.user.color ?? user.color}
            room={me?.user.room ?? user.room}
            onNavigate={close}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
