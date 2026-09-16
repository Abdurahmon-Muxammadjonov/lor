import type { Metadata } from 'next';
import { getLocale, getT } from '@/i18n/server';
import { SITE, PRICING_TIERS } from '@/data/landing-content';
import { JsonLd } from '@/components/landing/json-ld';
import { Hero } from '@/components/landing/hero';
import { TrustMarquee } from '@/components/landing/trust-marquee';
import { ProblemSolution } from '@/components/landing/problem-solution';
import { BentoFeatures } from '@/components/landing/bento-features';
import { DemoSection } from '@/components/landing/demo-section';
import { PrinterSection } from '@/components/landing/printer-section';
import { Pricing } from '@/components/landing/pricing';
import { StatsBand } from '@/components/landing/stats-band';
import { Faq } from '@/components/landing/faq';
import { CtaSection } from '@/components/landing/cta-section';

export function generateMetadata(): Metadata {
  const t = getT();
  const locale = getLocale();
  const title = t('landing.meta.title');
  const description = t('landing.meta.description');
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: '/' },
    openGraph: {
      type: 'website',
      url: '/',
      siteName: SITE.name,
      title,
      description,
      locale: locale === 'ru' ? 'ru_RU' : 'uz_UZ',
      alternateLocale: locale === 'ru' ? ['uz_UZ'] : ['ru_RU'],
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

/** Landing — server-rendered; interaktiv boʻlaklar client komponentlarda */
export default function LandingPage() {
  const t = getT();
  const locale = getLocale();
  const start = PRICING_TIERS[0];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE.name,
    url: SITE.url,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    inLanguage: locale === 'ru' ? 'ru' : 'uz-Latn',
    description: t('landing.meta.description'),
    offers: {
      '@type': 'Offer',
      price: start ? String(start.monthly) : '490000',
      priceCurrency: 'UZS',
      availability: 'https://schema.org/InStock',
    },
    provider: {
      '@type': 'Organization',
      name: SITE.name,
      url: SITE.url,
      email: SITE.email,
      telephone: SITE.phone,
      sameAs: [SITE.telegramUrl, SITE.instagramUrl, SITE.youtubeUrl, SITE.facebookUrl],
    },
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <Hero />
      <TrustMarquee />
      <ProblemSolution />
      <BentoFeatures />
      <DemoSection />
      <PrinterSection />
      <Pricing />
      <StatsBand />
      <Faq />
      <CtaSection />
    </>
  );
}
