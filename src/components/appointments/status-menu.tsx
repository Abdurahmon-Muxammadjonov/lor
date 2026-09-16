'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Check,
  CheckCircle2,
  ExternalLink,
  Pencil,
  RotateCcw,
  Stethoscope,
  Trash2,
  UserCheck,
  UserX,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { useT } from '@/i18n/client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { STATUS_TRANSITIONS } from '@/lib/appointments/availability';
import type { AppointmentStatusCode } from '@/lib/appointments/schemas';
import type { AppointmentDTO } from '@/lib/appointments/types';
import { STATUS_COLOR } from './constants';
import { useCalendar } from './calendar-context';

const ACTION_META: Record<AppointmentStatusCode, { key: string; icon: LucideIcon; destructive?: boolean }> = {
  CONFIRMED: { key: 'appointments.actions.confirm', icon: Check },
  ARRIVED: { key: 'appointments.actions.arrived', icon: UserCheck },
  DONE: { key: 'appointments.actions.done', icon: CheckCircle2 },
  CANCELLED: { key: 'appointments.actions.cancel', icon: XCircle, destructive: true },
  NO_SHOW: { key: 'appointments.actions.noShow', icon: UserX },
  SCHEDULED: { key: 'appointments.actions.restore', icon: RotateCcw },
};

export interface AppointmentMenuProps {
  appointment: AppointmentDTO;
  children: React.ReactNode;
  /** Menyu ochilganda/yopilganda (karta hover holati uchun) */
  onOpenChange?: (open: boolean) => void;
  align?: 'start' | 'end';
}

/**
 * Yozilish amallari menyusi: holat oʻtishlari, tahrirlash, bemor/qabul havolalari, oʻchirish.
 * `children` — trigger (tugma). Ruxsat boʻlmasa faqat koʻrish havolalari.
 */
export function AppointmentMenu({
  appointment: a,
  children,
  onOpenChange,
  align = 'end',
}: AppointmentMenuProps) {
  const t = useT();
  const { canWrite, onOpen, onStatus, onDelete, pendingIds } = useCalendar();
  const status = a.status as AppointmentStatusCode;
  const transitions = canWrite ? STATUS_TRANSITIONS[status] : [];
  const busy = pendingIds.has(a.id);
  const canDelete = canWrite && status === 'SCHEDULED' && !a.visit;

  return (
    <DropdownMenu onOpenChange={onOpenChange} modal={false}>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56" onCloseAutoFocus={(e) => e.preventDefault()}>
        <DropdownMenuLabel className="truncate normal-case tracking-normal text-text">
          {a.patient.fullName}
        </DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => onOpen(a)}>
          <Pencil />
          {canWrite ? t('appointments.actions.edit') : t('appointments.card.open')}
        </DropdownMenuItem>
        {transitions.length > 0 ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>{t('appointments.actions.changeStatus')}</DropdownMenuLabel>
            {transitions.map((to) => {
              const meta = ACTION_META[to];
              const Icon = meta.icon;
              return (
                <DropdownMenuItem
                  key={to}
                  disabled={busy}
                  destructive={meta.destructive}
                  onSelect={() => onStatus(a, to)}
                >
                  <Icon style={meta.destructive ? undefined : { color: STATUS_COLOR[to] }} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span>{t(meta.key)}</span>
                    {to === 'ARRIVED' ? (
                      <span className="text-[11px] leading-tight text-text-muted">
                        {t('appointments.actions.arrivedHint')}
                      </span>
                    ) : null}
                  </span>
                </DropdownMenuItem>
              );
            })}
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={`/dashboard/patients/${a.patientId}`}>
            <ExternalLink />
            {t('appointments.dialog.openPatient')}
          </Link>
        </DropdownMenuItem>
        {a.visit ? (
          <DropdownMenuItem asChild>
            <Link href={`/dashboard/visits/${a.visit.id}`}>
              <Stethoscope />
              {t('appointments.dialog.openVisit')}
            </Link>
          </DropdownMenuItem>
        ) : null}
        {canDelete ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive disabled={busy} onSelect={() => onDelete(a)}>
              <Trash2 />
              {t('appointments.actions.delete')}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
