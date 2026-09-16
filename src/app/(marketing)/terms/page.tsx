import type { Metadata } from 'next';
import { getT } from '@/i18n/server';
import { TERMS_OF_SERVICE } from '@/data/landing-content';
import { LegalPage } from '@/components/landing/legal-page';

export function generateMetadata(): Metadata {
  const t = getT();
  return {
    title: t('landing.meta.termsTitle'),
    description: t('landing.meta.termsDescription'),
    alternates: { canonical: '/terms' },
    openGraph: { title: t('landing.meta.termsTitle'), description: t('landing.meta.termsDescription'), url: '/terms', type: 'article' },
  };
}

export default function TermsPage() {
  const t = getT();
  return <LegalPage doc={TERMS_OF_SERVICE} related={{ href: '/privacy', label: t('landing.footer.links.privacy') }} />;
}
