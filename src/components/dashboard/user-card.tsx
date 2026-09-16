'use client';

import * as React from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { LogOut, UserRound } from 'lucide-react';
import type { Role } from '@prisma/client';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/client';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { UserAvatar } from './user-avatar';

export interface UserCardProps {
  fullName: string;
  role: Role;
  color?: string | null;
  room?: string | null;
  collapsed?: boolean;
  onNavigate?: () => void;
  className?: string;
}

export function logoutToLogin(): void {
  void signOut({ callbackUrl: '/login' });
}

/** Yon panel pastidagi foydalanuvchi kartasi: avatar, ism, rol, profil havolasi va chiqish */
export function UserCard({ fullName, role, color, room, collapsed = false, onNavigate, className }: UserCardProps) {
  const t = useT();
  const roleLabel = t(`common.role.${role}`);

  if (collapsed) {
    return (
      <div className={cn('flex flex-col items-center gap-1', className)}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/dashboard/profile"
              onClick={onNavigate}
              aria-label={`${fullName} · ${t('dashboard.user.profile')}`}
              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-elevated"
            >
              <UserAvatar name={fullName} color={color} size="sm" online />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={10}>
            <div className="font-medium">{fullName}</div>
            <div className="text-text-muted">{roleLabel}</div>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="size-9" onClick={logoutToLogin} aria-label={t('common.logout')}>
              <LogOut aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={10}>
            {t('common.logout')}
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className={cn('glass flex items-center gap-3 p-2.5', className)}>
      <UserAvatar name={fullName} color={color} size="md" online />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-text" title={fullName}>
          {fullName}
        </div>
        <div className="truncate text-xs text-text-muted">
          {roleLabel}
          {room ? ` · ${t('dashboard.user.room')} ${room}` : ''}
        </div>
      </div>
      <div className="flex shrink-0 items-center">
        <Button asChild variant="ghost" size="icon" className="size-8" aria-label={t('dashboard.user.profile')} title={t('dashboard.user.profile')}>
          <Link href="/dashboard/profile" onClick={onNavigate}>
            <UserRound aria-hidden="true" />
          </Link>
        </Button>
        <Button variant="ghost" size="icon" className="size-8 hover:text-danger" onClick={logoutToLogin} aria-label={t('common.logout')} title={t('common.logout')}>
          <LogOut aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}
