import type { ReactNode } from 'react';
import { NoiseOverlay } from '@/components/effects/noise-overlay';
import { CustomCursor } from '@/components/effects/custom-cursor';
import { Navbar } from '@/components/landing/navbar';
import { Footer } from '@/components/landing/footer';
import { getT } from '@/i18n/server';
import './marketing.css';

/**
 * Marketing (landing, privacy, terms) sahifalari uchun umumiy qobiq:
 * Navbar + <main> + Footer, ustidan shovqin qatlami va desktopda maxsus kursor.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  const t = getT();
  return (
    <div className="relative flex min-h-dvh flex-col bg-bg-base text-text">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-bg-base"
      >
        {t('landing.nav.skip')}
      </a>
      <Navbar />
      <main id="main" className="relative flex-1 overflow-x-clip">
        {children}
      </main>
      <Footer />
      <NoiseOverlay />
      <CustomCursor />
    </div>
  );
}
