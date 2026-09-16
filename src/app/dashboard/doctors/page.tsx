import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { getT } from '@/i18n/server';
import { StaffPage, type StaffTab } from '@/components/staff/staff-page';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = getT();
  return { title: t('staff.meta.title') };
}

const TABS: readonly StaffTab[] = ['staff', 'schedule', 'salary'];

function pickTab(raw: string | string[] | undefined, canSalary: boolean): StaffTab {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const tab = TABS.find((x) => x === v) ?? 'staff';
  return tab === 'salary' && !canSalary ? 'staff' : tab;
}

/** /dashboard/doctors — xodimlar, ish jadvali va ish haqi (server oʻrami) */
export default async function DoctorsPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const user = await requireUser('staff.view');
  const canManage = can(user.role, 'staff.write');
  const canSalary = can(user.role, 'reports.full');
  return (
    <StaffPage
      currentUserId={user.id}
      role={user.role}
      canManage={canManage}
      canSalary={canSalary}
      initialTab={pickTab(searchParams?.tab, canSalary)}
    />
  );
}
