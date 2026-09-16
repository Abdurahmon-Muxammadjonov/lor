'use client';

import * as React from 'react';
import { Check, Minus, ShieldCheck } from 'lucide-react';
import type { Role } from '@prisma/client';
import { useT } from '@/i18n/client';
import { cn } from '@/lib/utils';
import { CLINIC_ROLES, PERMISSIONS, can, type Permission } from '@/lib/permissions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FormCard } from './form-field';

export interface RolesMatrixProps {
  /** Joriy foydalanuvchi roli — ustuni ajratib koʻrsatiladi */
  currentRole?: Role;
}

interface PermissionGroup {
  group: string;
  permissions: Permission[];
}

const PERMISSION_KEYS = Object.keys(PERMISSIONS) as Permission[];

/** Ruxsatlarni prefiks boʻyicha guruhlash (PERMISSIONS tartibi saqlanadi) */
function groupPermissions(keys: readonly Permission[]): PermissionGroup[] {
  const groups: PermissionGroup[] = [];
  for (const key of keys) {
    const group = key.split('.')[0] ?? key;
    const last = groups[groups.length - 1];
    if (last && last.group === group) last.permissions.push(key);
    else groups.push({ group, permissions: [key] });
  }
  return groups;
}

/** Rollar × ruxsatlar matritsasi — faqat oʻqish (manba: src/lib/permissions.ts) */
export function RolesMatrix({ currentRole }: RolesMatrixProps) {
  const t = useT();
  const groups = React.useMemo(() => groupPermissions(PERMISSION_KEYS), []);

  return (
    <FormCard
      title={t('settings.roles.title')}
      description={t('settings.roles.description')}
      contentClassName="p-0 sm:p-0"
    >
      <div className="overflow-x-auto scrollbar-thin">
        <Table className="min-w-[38rem]">
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 bg-surface">{t('settings.roles.permission')}</TableHead>
              {CLINIC_ROLES.map((role) => (
                <TableHead
                  key={role}
                  className={cn('text-center', role === currentRole && 'text-accent')}
                  scope="col"
                >
                  {t(`common.role.${role}`)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map(({ group, permissions }) => (
              <React.Fragment key={group}>
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={CLINIC_ROLES.length + 1}
                    className="bg-bg-elevated/60 text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted"
                  >
                    {t(`settings.roles.groups.${group}`)}
                  </TableCell>
                </TableRow>
                {permissions.map((key) => (
                  <TableRow key={key}>
                    <TableCell className="sticky left-0 z-10 bg-surface">
                      <span className="block text-sm text-text">{t(`settings.roles.labels.${key}`)}</span>
                      <code className="block font-mono text-[11px] text-text-muted">{key}</code>
                    </TableCell>
                    {CLINIC_ROLES.map((role) => {
                      const allowed = can(role, key);
                      return (
                        <TableCell key={role} className={cn('text-center', role === currentRole && 'bg-primary/5')}>
                          {allowed ? (
                            <Check className="mx-auto size-4 text-[#00FFB2]" aria-hidden="true" />
                          ) : (
                            <Minus className="mx-auto size-4 text-text-muted" aria-hidden="true" />
                          )}
                          <span className="sr-only">
                            {t(`common.role.${role}`)}: {allowed ? t('settings.roles.allowed') : t('settings.roles.denied')}
                          </span>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="flex items-center gap-2 px-5 py-4 text-xs text-text-muted sm:px-6">
        <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
        {t('settings.roles.superAdminNote')}
      </p>
    </FormCard>
  );
}
