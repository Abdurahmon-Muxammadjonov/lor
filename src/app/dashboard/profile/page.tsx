import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { getT } from '@/i18n/server';
import { ProfilePage } from '@/components/dashboard/profile/profile-page';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = getT();
  return { title: t('dashboard.meta.profile') };
}

/** /dashboard/profile — shaxsiy maʼlumotlar va parol (har qanday kirgan foydalanuvchi) */
export default async function DashboardProfilePage() {
  const user = await requireUser();
  return <ProfilePage user={user} />;
}
