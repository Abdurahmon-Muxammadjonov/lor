import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { PRIVACY_POLICY } from '@/data/landing-content';
import { LegalPage } from '@/components/landing/legal-page';

export function generateMetadata(): Metadata {
  const t = getT();
  return {
    title: t('landing.meta.privacyTitle'),
    description: t('landing.meta.privacyDescription'),
    alternates: { canonical: '/privacy' },
    openGraph: { title: t('landing.meta.privacyTitle'), description: t('landing.meta.privacyDescription'), url: '/privacy', type: 'article' },
  };
}

export default function PrivacyPage() {
  const t = getT();
  return <LegalPage doc={PRIVACY_POLICY} related={{ href: '/terms', label: t('landing.footer.links.terms') }} />;
}
