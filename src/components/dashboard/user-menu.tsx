'use client';

import * as React from 'react';
import Link from 'next/link';
import { ChevronDown, LogOut, UserRound } from 'lucide-react';
import type { SessionUser } from '@/lib/auth/session';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UserAvatar } from './user-avatar';
import { logoutToLogin } from './user-card';
import { useMe } from './queries';

/** Topbar foydalanuvchi menyusi: Profil, Chiqish */
export function UserMenu({ user, className }: { user: SessionUser; className?: string }) {
  const t = useT();
  const { data: me } = useMe();
  const fullName = me?.user.fullName ?? user.fullName;
  const color = me?.user.color ?? user.color;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('dashboard.user.menu')}
          className={cn(
            'flex h-9 items-center gap-2 rounded-full border border-line bg-bg-elevated pl-0.5 pr-2 transition-colors hover:border-primary/30',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            className,
          )}
        >
          <UserAvatar name={fullName} color={color} size="sm" />
          <span className="hidden max-w-[140px] truncate text-sm font-medium text-text md:inline">{fullName}</span>
          <ChevronDown className="hidden size-3.5 text-text-muted md:inline" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="normal-case tracking-normal">
          <div className="truncate text-sm font-semibold text-text">{fullName}</div>
          <div className="truncate text-xs font-normal text-text-muted">
            {t(`common.role.${user.role}`)} · {user.clinicName}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/profile">
            <UserRound aria-hidden="true" />
            {t('dashboard.user.profile')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onSelect={logoutToLogin}>
          <LogOut aria-hidden="true" />
          {t('dashboard.user.logout')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
