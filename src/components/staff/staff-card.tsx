'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { AtSign, Clock3, DoorOpen, KeyRound, MoreHorizontal, Pencil, UserCheck, UserX, Wallet } from 'lucide-react';
import { useLocale } from '@/i18n/client';
import { fmtSmartDate } from '@/lib/date';
import { cn } from '@/lib/utils';
import { formatPercent } from '@/lib/staff/salary';
import { weeklyHours } from '@/lib/staff/schedule';
import { safeHex } from '@/lib/staff/color';
import type { StaffUserDTO } from '@/lib/staff/types';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Money } from '@/components/shared/money';
import { PhoneLink } from '@/components/shared/phone-link';
import { RoleBadge } from './role-badge';
import { ScheduleChips } from './schedule-chips';
import { StaffAvatar } from './staff-avatar';

export interface StaffCardProps {
  user: StaffUserDTO;
  isSelf: boolean;
  canManage: boolean;
  /** Ish haqi tugmasi (ADMIN — har qanday shifokor; shifokor — oʻzi) */
  canViewSalary: boolean;
  index?: number;
  onEdit: (u: StaffUserDTO) => void;
  onPassword: (u: StaffUserDTO) => void;
  onDeactivate: (u: StaffUserDTO) => void;
  onActivate: (u: StaffUserDTO) => void;
  onSalary: (u: StaffUserDTO) => void;
}

export function StaffCard({
  user,
  isSelf,
  canManage,
  canViewSalary,
  index = 0,
  onEdit,
  onPassword,
  onDeactivate,
  onActivate,
  onSalary,
}: StaffCardProps) {
  const { t, locale } = useLocale();
  const reduced = useReducedMotion();
  const hex = safeHex(user.color);
  const hours = weeklyHours(user.schedule);
  const isDoctor = user.role === 'DOCTOR';

  return (
    <motion.article
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.04, ease: 'easeOut' }}
      className={cn(
        'glass group relative flex flex-col gap-4 p-5 transition-[box-shadow,transform] duration-300 hover:-translate-y-0.5',
        !user.isActive && 'opacity-75',
      )}
      aria-label={user.fullName}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px opacity-80"
        style={{ background: `linear-gradient(90deg, ${hex}, transparent 70%)` }}
      />

      <header className="flex items-start gap-4">
        <StaffAvatar name={user.fullName} color={hex} size="lg" dimmed={!user.isActive} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="truncate font-heading text-base font-bold leading-tight text-text">{user.fullName}</h3>
            {isSelf ? (
              <Badge variant="outline" className="text-[10px]">
                {t('staff.card.you')}
              </Badge>
            ) : null}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <RoleBadge role={user.role} />
            {user.isActive ? (
              <Badge variant="success" dot className="text-[10px]">
                {t('staff.card.active')}
              </Badge>
            ) : (
              <Badge variant="danger" dot className="text-[10px]">
                {t('staff.card.inactive')}
              </Badge>
            )}
          </div>
          {user.specialty ? <p className="mt-1.5 truncate text-sm text-text-muted">{user.specialty}</p> : null}
        </div>

        {canManage ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8 shrink-0 -mr-1 -mt-1" aria-label={`${t('staff.card.actions')}: ${user.fullName}`}>
                <MoreHorizontal aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onEdit(user)}>
                <Pencil aria-hidden="true" />
                {t('staff.card.edit')}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onPassword(user)}>
                <KeyRound aria-hidden="true" />
                {t('staff.card.password')}
              </DropdownMenuItem>
              {isDoctor ? (
                <DropdownMenuItem onSelect={() => onSalary(user)}>
                  <Wallet aria-hidden="true" />
                  {t('staff.card.salary')}
                </DropdownMenuItem>
              ) : null}
              {isSelf ? null : (
                <>
                  <DropdownMenuSeparator />
                  {user.isActive ? (
                    <DropdownMenuItem destructive onSelect={() => onDeactivate(user)}>
                      <UserX aria-hidden="true" />
                      {t('staff.card.deactivate')}
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onSelect={() => onActivate(user)}>
                      <UserCheck aria-hidden="true" />
                      {t('staff.card.activate')}
                    </DropdownMenuItem>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </header>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <dt className="sr-only">{t('staff.card.room')}</dt>
          <DoorOpen className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
          <dd className="truncate text-text">{user.room ?? '—'}</dd>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <dt className="sr-only">{t('staff.card.phone')}</dt>
          <dd className="min-w-0 truncate">
            <PhoneLink phone={user.phone} withIcon className="text-sm" />
          </dd>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <dt className="sr-only">{t('staff.card.login')}</dt>
          <AtSign className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
          <dd className="truncate font-mono text-xs text-text-muted">{user.login}</dd>
        </div>
        <div className="flex items-center gap-2 min-w-0">
          <dt className="sr-only">{t('staff.card.lastLogin')}</dt>
          <Clock3 className="size-4 shrink-0 text-text-muted" aria-hidden="true" />
          <dd className="truncate text-xs text-text-muted">{user.lastLoginAt ? fmtSmartDate(user.lastLoginAt, locale) : t('staff.card.never')}</dd>
        </div>
      </dl>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-xs text-text-muted">
          <span>{t('staff.card.schedule')}</span>
          <span className="tabular">{t('staff.card.weekHours', { h: hours })}</span>
        </div>
        <ScheduleChips schedule={user.schedule} color={hex} />
      </div>

      {canManage || isSelf ? (
        <footer className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3 text-xs">
          <span className="text-text-muted">
            {user.salaryType === 'PERCENT' ? (
              t('staff.card.percentOf', { p: formatPercent(user.salaryValue) })
            ) : (
              <>
                <Money value={user.salaryValue} className="text-text" /> · {t('staff.card.fixedSalary')}
              </>
            )}
          </span>
          {isDoctor && canViewSalary ? (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onSalary(user)}>
              <Wallet aria-hidden="true" />
              {isSelf ? t('staff.card.mySalary') : t('staff.card.salary')}
            </Button>
          ) : null}
        </footer>
      ) : null}
    </motion.article>
  );
}
