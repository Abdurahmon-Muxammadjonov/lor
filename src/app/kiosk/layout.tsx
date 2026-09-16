import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Kiosk',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#060810',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

/** Kiosk qobigʻi: dashboard chromesiz, butun ekran, matn tanlash/zoom oʻchirilgan (sensorli ekran) */
export default function KioskLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-dvh w-full select-none overflow-hidden bg-bg-base text-text [touch-action:manipulation]" data-cursor="none">
      {children}
    </div>
  );
}
