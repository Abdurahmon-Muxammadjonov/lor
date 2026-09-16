import type { Metadata, Viewport } from 'next';
import { Inter, Manrope } from 'next/font/google';
import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, HTML_LANG, LOCALE_COOKIE, isLocale, type Locale } from '@/i18n/config';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext'],
  variable: '--font-body',
  display: 'swap',
  weight: ['400', '500', '600'],
});

const manrope = Manrope({
  subsets: ['latin', 'latin-ext', 'cyrillic'],
  variable: '--font-heading',
  display: 'swap',
  weight: ['600', '700', '800'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? 'http://localhost:3000'),
  title: { default: 'LOR CRM — quloq-burun-tomoq klinikalari uchun tizim', template: '%s · LOR CRM' },
  description:
    'LOR klinikalari uchun navbat, muolaja kalkulyatori, kassa va hisobotlar bir joyda. Talon printeri, SMS eslatmalar, UZ/RU.',
  applicationName: 'LOR CRM',
  keywords: ['LOR', 'klinika', 'CRM', 'navbat', 'kassa', 'quloq burun tomoq', 'ЛОР клиника CRM'],
  openGraph: { type: 'website', siteName: 'LOR CRM', locale: 'uz_UZ', alternateLocale: ['ru_RU'] },
  icons: { icon: '/icons/icon.svg' },
};

export const viewport: Viewport = {
  themeColor: '#060810',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const c = cookies().get(LOCALE_COOKIE)?.value;
  const locale: Locale = isLocale(c) ? c : DEFAULT_LOCALE;
  return (
    <html lang={HTML_LANG[locale]} className={`${inter.variable} ${manrope.variable} dark`} suppressHydrationWarning>
      <body className="min-h-dvh bg-bg-base font-sans text-text antialiased">
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  );
}
