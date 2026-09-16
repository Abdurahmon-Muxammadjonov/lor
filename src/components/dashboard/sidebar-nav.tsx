'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
import type { Role } from '@prisma/client';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/client';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { isNavActive, navForRole, SECONDARY_NAV, type NavItem } from '@/lib/dashboard/nav';

export interface SidebarNavProps {
  role: Role;
  /** Kiosk / TV havolalari uchun (ADMIN / RECEPTION), aks holda null — boʻlim koʻrsatilmaydi */
  kioskKey: string | null;
  collapsed?: boolean;
  /** Havola bosilganda (mobil menyuni yopish uchun) */
  onNavigate?: () => void;
  /** framer-motion layoutId prefiksi (desktop va mobil bir-biriga xalaqit bermasin) */
  layoutScope: string;
  className?: string;
}

interface NavLinkProps {
  href: string;
  label: string;
  icon: NavItem['icon'];
  active: boolean;
  collapsed: boolean;
  external?: boolean;
  hint?: string;
  onNavigate?: () => void;
  layoutScope: string;
  reduced: boolean;
}

function NavLink({ href, label, icon: Icon, active, collapsed, external, hint, onNavigate, layoutScope, reduced }: NavLinkProps) {
  const inner = (
    <>
      {active ? (
        <motion.span
          layoutId={`${layoutScope}-active-bar`}
          aria-hidden="true"
          className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-gradient-to-b from-[#00D4FF] to-[#7C5CFF] shadow-[0_0_12px_rgba(0,212,255,0.6)]"
          transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 500, damping: 40 }}
        />
      ) : null}
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-lg border transition-colors',
          active
            ? 'border-primary/25 bg-primary/10 text-accent shadow-[0_0_18px_rgba(0,212,255,0.18)]'
            : 'border-transparent text-text-muted group-hover:border-border/70 group-hover:bg-surface group-hover:text-text',
        )}
      >
        <Icon className="size-[18px]" aria-hidden="true" />
      </span>
      {collapsed ? null : (
        <span className={cn('min-w-0 flex-1 truncate text-sm font-medium', active ? 'text-text' : 'text-text-muted group-hover:text-text')}>
          {label}
        </span>
      )}
      {external && !collapsed ? <ExternalLink className="size-3.5 shrink-0 text-muted-foreground/70" aria-hidden="true" /> : null}
    </>
  );

  const classes = cn(
    'group relative flex w-full items-center gap-3 rounded-lg py-1.5 pl-2 pr-2 outline-none transition-colors',
    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-elevated',
    active ? 'bg-primary/5' : 'hover:bg-card/60',
    collapsed && 'justify-center pl-2',
  );

  const link = external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={classes} aria-label={collapsed ? label : undefined} onClick={onNavigate}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={classes} aria-current={active ? 'page' : undefined} aria-label={collapsed ? label : undefined} onClick={onNavigate}>
      {inner}
    </Link>
  );

  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10} className="font-medium">
        {label}
        {hint ? <span className="ml-1 text-text-muted">· {hint}</span> : null}
      </TooltipContent>
    </Tooltip>
  );
}

/** Asosiy + qoʻshimcha (kiosk/TV) navigatsiya roʻyxati — desktop yon panel va mobil sheet uchun umumiy */
export function SidebarNav({ role, kioskKey, collapsed = false, onNavigate, layoutScope, className }: SidebarNavProps) {
  const t = useT();
  const pathname = usePathname();
  const reduced = useReducedMotion();
  const items = React.useMemo(() => navForRole(role), [role]);

  return (
    <nav aria-label={t('dashboard.sidebar.navLabel')} className={cn('flex flex-col gap-1', className)}>
      {!collapsed ? (
        <div className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">{t('dashboard.sidebar.main')}</div>
      ) : (
        <div aria-hidden="true" className="mx-auto my-2 h-px w-6 bg-line" />
      )}
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => (
          <li key={item.key}>
            <NavLink
              href={item.href}
              label={t(item.labelKey)}
              icon={item.icon}
              active={isNavActive(pathname, item)}
              collapsed={collapsed}
              onNavigate={onNavigate}
              layoutScope={layoutScope}
              reduced={reduced}
            />
          </li>
        ))}
      </ul>

      {kioskKey ? (
        <>
          {!collapsed ? (
            <div className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">{t('dashboard.sidebar.secondary')}</div>
          ) : (
            <div aria-hidden="true" className="mx-auto my-2 h-px w-6 bg-line" />
          )}
          <ul className="flex flex-col gap-0.5">
            {SECONDARY_NAV.map((s) => (
              <li key={s.key}>
                <NavLink
                  href={`${s.path}?key=${encodeURIComponent(kioskKey)}`}
                  label={t(s.labelKey)}
                  icon={s.icon}
                  active={false}
                  collapsed={collapsed}
                  external
                  hint={t('dashboard.sidebar.opensNewTab')}
                  onNavigate={onNavigate}
                  layoutScope={layoutScope}
                  reduced={reduced}
                />
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </nav>
  );
}
