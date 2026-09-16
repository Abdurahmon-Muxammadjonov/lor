import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth/session';
import { can } from '@/lib/permissions';
import { getT } from '@/i18n/server';
import { ServicesPage } from '@/components/services/services-page';

export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  const t = getT();
  return { title: t('services.meta.title') };
}

/**
 * /dashboard/services — xizmatlar va 4 xil narx. Koʻrish: services.view (barcha rollar);
 * tahrirlash tugmalari faqat services.write (ADMIN) uchun — himoya serverda (API withAuth).
 */
export default async function ServicesRoutePage() {
  const user = await requireUser('services.view');
  const canEdit = can(user.role, 'services.write');
  return <ServicesPage canEdit={canEdit} canExport={canEdit} />;
}
