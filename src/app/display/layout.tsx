import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Tablo',
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: '#060810',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
};

/** TV tablo qobigʻi: dashboard chromesiz, butun ekran */
export default function DisplayLayout({ children }: { children: ReactNode }) {
  return (
    <div className="h-dvh w-full select-none overflow-hidden bg-bg-base text-text" data-cursor="none">
      {children}
    </div>
  );
}
