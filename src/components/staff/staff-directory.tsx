'use client';

import * as React from 'react';
import type { Role } from '@prisma/client';
import { toast } from 'sonner';
import { UserPlus, Users, UsersRound } from 'lucide-react';
import { useT } from '@/i18n/client';
import { ApiClientError } from '@/lib/api/client';
import { CLINIC_ROLE_VALUES, type ClinicRole, type StaffUserDTO } from '@/lib/staff/types';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { SearchInput } from '@/components/shared/search-input';
import { PasswordDialog } from './password-dialog';
import { SalaryDialog } from './salary-dialog';
import { StaffCard } from './staff-card';
import { StaffFormDialog } from './staff-form-dialog';
import { useDeactivateStaff, useStaffList, useUpdateStaff } from './use-staff';

export interface StaffDirectoryProps {
  currentUserId: string;
  role: Role;
  canManage: boolean;
  canSalary: boolean;
  /** "Yangi xodim" (boʻsh holatda) */
  onCreate?: () => void;
}

type RoleFilter = 'ALL' | ClinicRole;

function isClinicRole(v: string): v is ClinicRole {
  return (CLINIC_ROLE_VALUES as readonly string[]).includes(v);
}

function CardsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-hidden="true">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="card-surface space-y-4 p-5">
          <div className="flex items-start gap-4">
            <Skeleton className="size-14 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex gap-1">
            {Array.from({ length: 7 }).map((_, j) => (
              <Skeleton key={j} className="h-6 w-8" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Xodimlar kartalari: rol filtri, qidiruv, nofaollarni koʻrsatish; tahrirlash / parol / nofaol qilish / ish haqi.
 */
export function StaffDirectory({ currentUserId, role, canManage, canSalary, onCreate }: StaffDirectoryProps) {
  const t = useT();
  const [roleFilter, setRoleFilter] = React.useState<RoleFilter>('ALL');
  const [search, setSearch] = React.useState('');
  const [showInactive, setShowInactive] = React.useState(false);

  const params = React.useMemo(
    () => ({
      role: roleFilter === 'ALL' ? undefined : roleFilter,
      active: showInactive ? undefined : ('1' as const),
      search: search.trim() || undefined,
    }),
    [roleFilter, showInactive, search],
  );
  const list = useStaffList(params);
  const items = list.data?.items ?? [];
  const hasFilters = roleFilter !== 'ALL' || search.trim() !== '' || showInactive;

  React.useEffect(() => {
    if (list.isError) toast.error(t('staff.toasts.loadError'));
  }, [list.isError, t]);

  // Dialoglar
  const [editUser, setEditUser] = React.useState<StaffUserDTO | null>(null);
  const [passwordUser, setPasswordUser] = React.useState<StaffUserDTO | null>(null);
  const [salaryUser, setSalaryUser] = React.useState<StaffUserDTO | null>(null);
  const [toggleUser, setToggleUser] = React.useState<{ user: StaffUserDTO; action: 'deactivate' | 'activate' } | null>(null);

  const deactivate = useDeactivateStaff();
  const update = useUpdateStaff();

  const errorMessage = (err: unknown) => (err instanceof ApiClientError ? t(err.message) : t('common.error'));

  const confirmToggle = async () => {
    if (!toggleUser) return;
    const { user, action } = toggleUser;
    try {
      if (action === 'deactivate') {
        await deactivate.mutateAsync(user.id);
        toast.success(t('staff.toasts.deactivated'));
      } else {
        await update.mutateAsync({ id: user.id, body: { isActive: true } });
        toast.success(t('staff.toasts.activated'));
      }
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="space-y-4">
      {/* Filtrlar */}
      <div className="glass flex flex-col gap-3 p-3 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={t('staff.filters.search')}
          loading={list.isFetching && !list.isLoading}
          className="sm:w-72"
          aria-label={t('common.search')}
        />
        <div className="flex items-center gap-2">
          <Label htmlFor="staff-role-filter" className="sr-only">
            {t('staff.filters.role')}
          </Label>
          <Select value={roleFilter} onValueChange={(v) => setRoleFilter(isClinicRole(v) ? v : 'ALL')}>
            <SelectTrigger id="staff-role-filter" className="w-full sm:w-48" aria-label={t('staff.filters.role')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t('staff.filters.all')}</SelectItem>
              {CLINIC_ROLE_VALUES.map((r) => (
                <SelectItem key={r} value={r}>
                  {t(`common.role.${r}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 sm:ml-auto">
          <Switch id="staff-show-inactive" checked={showInactive} onCheckedChange={setShowInactive} />
          <Label htmlFor="staff-show-inactive" className="text-sm font-normal text-text-muted">
            {t('staff.filters.showInactive')}
          </Label>
        </div>
        {list.data ? (
          <p className="text-xs text-text-muted sm:basis-full sm:pl-1" aria-live="polite">
            {t('staff.count', { n: items.length })}
          </p>
        ) : null}
      </div>

      {/* Roʻyxat */}
      {list.isLoading ? (
        <CardsSkeleton />
      ) : list.isError ? (
        <EmptyState
          icon={Users}
          title={t('staff.toasts.loadError')}
          action={
            <Button variant="outline" onClick={() => list.refetch()}>
              {t('common.retry')}
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title={hasFilters ? t('staff.empty.title') : t('staff.empty.noStaff')}
          description={hasFilters ? t('staff.empty.description') : t('staff.empty.noStaffDescription')}
          action={
            hasFilters ? (
              <Button
                variant="outline"
                onClick={() => {
                  setRoleFilter('ALL');
                  setSearch('');
                  setShowInactive(false);
                }}
              >
                {t('common.clear')}
              </Button>
            ) : onCreate ? (
              <Button variant="gradient" onClick={onCreate}>
                <UserPlus aria-hidden="true" />
                {t('staff.newStaff')}
              </Button>
            ) : null
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label={t('staff.title')}>
          {items.map((u, i) => {
            const isSelf = u.id === currentUserId;
            return (
              <li key={u.id} className="flex">
                <StaffCard
                  user={u}
                  index={i}
                  isSelf={isSelf}
                  canManage={canManage}
                  canViewSalary={canSalary || (isSelf && role === 'DOCTOR')}
                  onEdit={setEditUser}
                  onPassword={setPasswordUser}
                  onSalary={setSalaryUser}
                  onDeactivate={(user) => setToggleUser({ user, action: 'deactivate' })}
                  onActivate={(user) => setToggleUser({ user, action: 'activate' })}
                />
              </li>
            );
          })}
        </ul>
      )}

      {canManage ? (
        <>
          <StaffFormDialog open={editUser !== null} onOpenChange={(o) => (o ? undefined : setEditUser(null))} user={editUser} />
          <PasswordDialog open={passwordUser !== null} onOpenChange={(o) => (o ? undefined : setPasswordUser(null))} user={passwordUser} />
          <ConfirmDialog
            open={toggleUser !== null}
            onOpenChange={(o) => (o ? undefined : setToggleUser(null))}
            title={toggleUser?.action === 'activate' ? t('staff.activate.title') : t('staff.deactivate.title')}
            description={
              toggleUser?.action === 'activate'
                ? t('staff.activate.description', { name: toggleUser.user.fullName })
                : t('staff.deactivate.description', { name: toggleUser?.user.fullName ?? '' })
            }
            confirmText={toggleUser?.action === 'activate' ? t('staff.activate.confirm') : t('staff.deactivate.confirm')}
            destructive={toggleUser?.action !== 'activate'}
            onConfirm={confirmToggle}
          />
        </>
      ) : null}
      <SalaryDialog open={salaryUser !== null} onOpenChange={(o) => (o ? undefined : setSalaryUser(null))} user={salaryUser} />
    </div>
  );
}
