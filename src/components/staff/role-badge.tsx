'use client';

import { BriefcaseMedical, ClipboardList, ShieldCheck, Wallet } from 'lucide-react';
import { useT } from '@/i18n/client';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import type { ClinicRole } from '@/lib/staff/types';

const VARIANT: Record<ClinicRole, NonNullable<BadgeProps['variant']>> = {
  ADMIN: 'accent',
  DOCTOR: 'success',
  RECEPTION: 'warning',
  CASHIER: 'secondary',
};

const ICON: Record<ClinicRole, typeof ShieldCheck> = {
  ADMIN: ShieldCheck,
  DOCTOR: BriefcaseMedical,
  RECEPTION: ClipboardList,
  CASHIER: Wallet,
};

export function RoleBadge({ role, className }: { role: ClinicRole; className?: string }) {
  const t = useT();
  const Icon = ICON[role];
  return (
    <Badge variant={VARIANT[role]} className={className}>
      <Icon aria-hidden="true" />
      {t(`common.role.${role}`)}
    </Badge>
  );
}
