import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { getT } from '@/i18n/server';
import { parseSettingsTab } from '@/lib/settings/tabs';
import { SettingsTabs } from '@/components/settings/settings-tabs';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  const t = getT();
  return { title: t('settings.meta.title') };
}

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * /dashboard/settings — klinika sozlamalari (settings.view, faqat ADMIN).
 * Faol tab URL dan olinadi: `?tab=clinic|printer|sms|telegram|queue|roles|audit`.
 * Oʻzgartirish tugmalari `settings.write` boʻlmasa yashiriladi — himoya serverda (withAuth).
 */
export default async function SettingsRoutePage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireUser('settings.view');
  const canWrite = can(user.role, 'settings.write');
  const canAudit = can(user.role, 'audit.view');
  const parsed = parseSettingsTab(searchParams.tab);
  const tab = parsed === 'audit' && !canAudit ? 'clinic' : parsed;

  return <SettingsTabs initialTab={tab} canWrite={canWrite} canAudit={canAudit} clinicName={user.clinicName} role={user.role} />;
}
