'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { Wallet } from 'lucide-react';
import { useT } from '@/i18n/client';
import { formatPercent, monthKey } from '@/lib/staff/salary';
import type { StaffUserDTO } from '@/lib/staff/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Money } from '@/components/shared/money';
import { EmptyState } from '@/components/shared/empty-state';
import { MonthPicker } from './month-picker';
import { SalaryBreakdown } from './salary-breakdown';
import { StaffAvatar } from './staff-avatar';
import { useDoctorSalary } from './use-staff';

export interface SalaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: StaffUserDTO | null;
}

function Stat({ label, value, accent = false }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-line bg-bg-elevated px-3 py-2.5">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{label}</div>
      <div className={accent ? 'mt-1 font-heading text-lg font-bold text-accent tabular' : 'mt-1 font-heading text-lg font-bold text-text tabular'}>{value}</div>
    </div>
  );
}

/**
 * Bitta shifokor ish haqi oynasi (ADMIN — istalgan shifokor; shifokor — oʻzi): oy tanlash, jamlar, kunlik/xizmat taqsimoti.
 * Maʼlumot: GET /api/users/[id]/salary?month=
 */
export function SalaryDialog({ open, onOpenChange, user }: SalaryDialogProps) {
  const t = useT();
  const [month, setMonth] = React.useState(() => monthKey());
  const query = useDoctorSalary(open && user ? user.id : null, month);

  React.useEffect(() => {
    if (open) setMonth(monthKey());
  }, [open, user?.id]);

  React.useEffect(() => {
    if (query.isError) toast.error(t('staff.salary.loadError'));
  }, [query.isError, t]);

  const item = query.data?.item;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader className="sm:pr-8">
          <div className="flex items-center gap-3">
            {user ? <StaffAvatar name={user.fullName} color={user.color} size="md" /> : null}
            <div className="min-w-0 text-left">
              <DialogTitle className="truncate">{user?.fullName ?? t('staff.card.salary')}</DialogTitle>
              <DialogDescription className="mt-1">
                {user ? (
                  user.salaryType === 'PERCENT' ? (
                    t('staff.salary.percentOf', { p: formatPercent(user.salaryValue) })
                  ) : (
                    <>
                      {t('staff.salary.fixed')} · <Money value={user.salaryValue} />
                    </>
                  )
                ) : (
                  t('staff.salary.title')
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <MonthPicker value={month} onChange={setMonth} id="salary-dialog-month" />
          {user && !user.isActive ? <Badge variant="danger">{t('staff.salary.inactiveDoctor')}</Badge> : null}
        </div>

        {query.isLoading ? (
          <div className="space-y-4" aria-busy="true">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
            <Skeleton className="h-48" />
          </div>
        ) : query.isError ? (
          <EmptyState
            compact
            icon={Wallet}
            title={t('staff.salary.loadError')}
            action={
              <Button variant="outline" size="sm" onClick={() => query.refetch()}>
                {t('common.retry')}
              </Button>
            }
          />
        ) : item ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Stat label={t('staff.salary.visits')} value={item.visits} />
              <Stat label={t('staff.salary.patients')} value={item.patients} />
              <Stat label={t('staff.salary.revenue')} value={<Money value={item.revenue} suffix={null} />} />
              <Stat label={t('staff.salary.calculated')} value={<Money value={item.salary} suffix={null} />} accent />
            </div>
            <SalaryBreakdown item={item} compact />
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
