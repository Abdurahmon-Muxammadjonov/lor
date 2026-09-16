'use client';

import dynamic from 'next/dynamic';
import { useT } from '@/i18n/client';
import { DashboardPreviewSkeleton } from './dashboard-preview-skeleton';

/**
 * Ogʻir dashboard namunasi (Recharts) faqat brauzerda, asosiy bundle dan tashqarida yuklanadi.
 */
const DashboardPreview = dynamic(() => import('./dashboard-preview').then((m) => m.DashboardPreview), {
  ssr: false,
  loading: () => <DashboardPreviewSkeletonWithT />,
});

function DashboardPreviewSkeletonWithT() {
  const t = useT();
  return <DashboardPreviewSkeleton label={t('landing.hero.preview.loading')} />;
}

export function DashboardPreviewLoader() {
  return <DashboardPreview />;
}
