'use client';

import * as React from 'react';
import Link from 'next/link';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { SessionUser } from '@/lib/auth/session';
import type { MeClinicDTO } from '@/lib/dashboard/types';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/client';
import { useUiStore } from '@/stores/use-ui-store';
import { Logo, LogoMark } from '@/components/shared/logo';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { PlanBadge } from './plan-badge';
import { SidebarNav } from './sidebar-nav';
import { UserCard } from './user-card';
import { useClinicInfo, useMe } from './queries';

export const SIDEBAR_WIDTH = 260;
export const SIDEBAR_COLLAPSED_WIDTH = 72;

export interface SidebarProps {
  user: SessionUser;
  clinic: MeClinicDTO;
}

/** Desktop yon panel (≥ lg): 260px ↔ 72px, holat localStorage da (use-ui-store) */
export function Sidebar({ user, clinic: initialClinic }: SidebarProps) {
  const t = useT();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const hydrated = useUiStore((s) => s.hydrated);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const { data: clinic } = useClinicInfo(initialClinic);
  const { data: me } = useMe();

  const c = clinic ?? initialClinic;
  const fullName = me?.user.fullName ?? user.fullName;
  const color = me?.user.color ?? user.color;
  const room = me?.user.room ?? user.room;
  const toggleLabel = collapsed ? t('dashboard.sidebar.expand') : t('dashboard.sidebar.collapse');

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-line bg-popover/80 backdrop-blur-xl lg:flex',
        hydrated && 'transition-[width] duration-300 ease-out',
      )}
      style={{ width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH }}
      data-collapsed={collapsed || undefined}
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#00D4FF]/10 to-transparent" />

      {/* Klinika */}
      <div className={cn('relative flex h-16 shrink-0 items-center border-b border-line', collapsed ? 'justify-center px-2' : 'gap-3 px-4')}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/dashboard" aria-label={c.name} className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <LogoMark size={34} />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={10}>
              <div className="font-medium">{c.name}</div>
              <div className="text-text-muted">{t(`dashboard.sidebar.plan.${c.plan}`)}</div>
            </TooltipContent>
          </Tooltip>
        ) : (
          <>
            <Logo href="/dashboard" withText={false} size="md" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-heading text-sm font-bold leading-tight text-text" title={c.name}>
                {c.name}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5">
                <PlanBadge plan={c.plan} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Navigatsiya */}
      <div className={cn('relative flex-1 overflow-y-auto overflow-x-hidden py-3 scrollbar-thin', collapsed ? 'px-2' : 'px-3')}>
        <SidebarNav role={user.role} kioskKey={c.kioskKey} collapsed={collapsed} layoutScope="desktop" />
      </div>

      {/* Foydalanuvchi + yigʻish */}
      <div className={cn('relative shrink-0 border-t border-line', collapsed ? 'flex flex-col items-center gap-2 px-2 py-3' : 'space-y-2 p-3')}>
        <UserCard fullName={fullName} role={user.role} color={color} room={room} collapsed={collapsed} />
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="size-9" onClick={toggle} aria-label={toggleLabel} aria-expanded={!collapsed}>
                <PanelLeftOpen aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={10}>
              {toggleLabel}
            </TooltipContent>
          </Tooltip>
        ) : (
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-text-muted" onClick={toggle} aria-label={toggleLabel} aria-expanded={!collapsed}>
            <PanelLeftClose aria-hidden="true" />
            {toggleLabel}
          </Button>
        )}
      </div>
    </aside>
  );
}
