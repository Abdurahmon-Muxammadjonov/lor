'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import type { SessionUser } from '@/lib/auth/session';
import type { MeClinicDTO } from '@/lib/dashboard/types';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/client';
import { useUiStore } from '@/stores/use-ui-store';
import { CommandPalette } from './command-palette';
import { MobileSidebar } from './mobile-sidebar';
import { MobileTabBar } from './mobile-tab-bar';
import { Sidebar, SIDEBAR_COLLAPSED_WIDTH, SIDEBAR_WIDTH } from './sidebar';
import { Topbar } from './topbar';

export interface DashboardShellProps {
  user: SessionUser;
  clinic: MeClinicDTO;
  children: React.ReactNode;
}

/** `?denied=1` → "Ruxsat yoʻq" toast va parametrni URL dan olib tashlash */
function DeniedNotice() {
  const t = useT();
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const denied = params.get('denied');
  React.useEffect(() => {
    if (denied !== '1') return;
    toast.error(t('common.denied.title'), { description: t('common.denied.description'), id: 'denied' });
    const next = new URLSearchParams(params.toString());
    next.delete('denied');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [denied, params, pathname, router, t]);
  return null;
}

/**
 * Dashboard qobigʻi: desktop yon panel (yigʻiladigan) + yuqori panel + kontent; mobilda Sheet menyu + pastki tab bar.
 * Yon panel holati localStorage dan gidratsiyadan keyin oʻqiladi (SSR bilan bir xil boshlangʻich render).
 */
export function DashboardShell({ user, clinic, children }: DashboardShellProps) {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const hydrated = useUiStore((s) => s.hydrated);
  const setHydrated = useUiStore((s) => s.setHydrated);

  React.useEffect(() => {
    let cancelled = false;
    const done = () => {
      if (!cancelled) setHydrated(true);
    };
    try {
      const r = useUiStore.persist.rehydrate();
      if (r && typeof (r as Promise<void>).then === 'function') (r as Promise<void>).then(done, done);
      else done();
    } catch {
      done();
    }
    return () => {
      cancelled = true;
    };
  }, [setHydrated]);

  return (
    <div className="relative isolate min-h-dvh bg-bg-base text-text">
      {/* Fon: nozik toʻr + yuqori chapdagi yorugʻlik */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 bg-grid bg-grid-fade opacity-50" />
      <div aria-hidden="true" className="pointer-events-none fixed -left-40 -top-40 -z-10 size-[520px] rounded-full bg-accent opacity-[0.06] blur-[140px]" />
      <div aria-hidden="true" className="pointer-events-none fixed -bottom-48 right-0 -z-10 size-[480px] rounded-full bg-accent-2 opacity-[0.06] blur-[140px]" />

      <Sidebar user={user} clinic={clinic} />
      <MobileSidebar user={user} clinic={clinic} />

      <div
        className={cn('flex min-h-dvh flex-col lg:pl-[var(--sidebar-w)]', hydrated && 'transition-[padding] duration-300 ease-out')}
        style={{ ['--sidebar-w' as string]: `${collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH}px` }}
        data-sidebar={collapsed ? 'collapsed' : 'expanded'}
      >
        <Topbar user={user} />
        <main id="main" className="mx-auto w-full max-w-[1440px] flex-1 px-4 pb-24 pt-5 sm:px-6 sm:pt-6 lg:px-8 lg:pb-10">
          {children}
        </main>
      </div>

      <MobileTabBar role={user.role} />
      <CommandPalette user={user} />
      <React.Suspense fallback={null}>
        <DeniedNotice />
      </React.Suspense>
    </div>
  );
}
