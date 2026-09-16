'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import type { Role } from '@prisma/client';
import { CalendarClock, UserPlus, Users, Wallet } from 'lucide-react';
import { useT } from '@/i18n/client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/shared/page-header';
import { StaffDirectory } from './staff-directory';
import { ScheduleGrid } from './schedule-grid';
import { SalaryTable } from './salary-table';
import { StaffFormDialog } from './staff-form-dialog';

export type StaffTab = 'staff' | 'schedule' | 'salary';

export interface StaffPageProps {
  currentUserId: string;
  role: Role;
  /** staff.write — ADMIN */
  canManage: boolean;
  /** reports.full — ish haqi tabi */
  canSalary: boolean;
  initialTab: StaffTab;
}

/**
 * Xodimlar sahifasi (client): tablar — Xodimlar / Ish jadvali / Ish haqi (ADMIN).
 * Tab URL da saqlanadi (?tab=), yangilashda yoʻqolmaydi.
 */
export function StaffPage({ currentUserId, role, canManage, canSalary, initialTab }: StaffPageProps) {
  const t = useT();
  const router = useRouter();
  const [tab, setTab] = React.useState<StaffTab>(initialTab);
  const [createOpen, setCreateOpen] = React.useState(false);

  const onTabChange = (value: string) => {
    const next: StaffTab = value === 'schedule' || value === 'salary' ? value : 'staff';
    setTab(next);
    router.replace(next === 'staff' ? '/dashboard/doctors' : `/dashboard/doctors?tab=${next}`, { scroll: false });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('staff.title')}
        description={t('staff.description')}
        leading={<Users aria-hidden="true" />}
        actions={
          canManage ? (
            <Button variant="gradient" onClick={() => setCreateOpen(true)}>
              <UserPlus aria-hidden="true" />
              {t('staff.newStaff')}
            </Button>
          ) : null
        }
      />

      <Tabs value={tab} onValueChange={onTabChange}>
        <TabsList aria-label={t('staff.title')} className="w-full justify-start overflow-x-auto scrollbar-none sm:w-auto">
          <TabsTrigger value="staff">
            <Users aria-hidden="true" />
            {t('staff.tabs.staff')}
          </TabsTrigger>
          <TabsTrigger value="schedule">
            <CalendarClock aria-hidden="true" />
            {t('staff.tabs.schedule')}
          </TabsTrigger>
          {canSalary ? (
            <TabsTrigger value="salary">
              <Wallet aria-hidden="true" />
              {t('staff.tabs.salary')}
            </TabsTrigger>
          ) : null}
        </TabsList>

        <TabsContent value="staff" className="mt-5">
          <StaffDirectory
            currentUserId={currentUserId}
            role={role}
            canManage={canManage}
            canSalary={canSalary}
            onCreate={canManage ? () => setCreateOpen(true) : undefined}
          />
        </TabsContent>
        <TabsContent value="schedule" className="mt-5">
          <ScheduleGrid currentUserId={currentUserId} />
        </TabsContent>
        {canSalary ? (
          <TabsContent value="salary" className="mt-5">
            <SalaryTable />
          </TabsContent>
        ) : null}
      </Tabs>

      {canManage ? <StaffFormDialog open={createOpen} onOpenChange={setCreateOpen} user={null} defaultRole="DOCTOR" /> : null}
    </div>
  );
}
