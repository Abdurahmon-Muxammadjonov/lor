import type { ReactNode } from 'react';
import { ShieldCheck } from 'lucide-react';
import { LangSwitch } from '@/components/shared/lang-switch';
import { Logo } from '@/components/shared/logo';
import { AuthVisual } from '@/components/auth/auth-visual';
import { getT } from '@/i18n/server';

/**
 * Auth sahifalari (login / forgot-password / reset-password) uchun toʻliq ekranli ikki ustunli layout:
 * chapda forma (max-w-md, markazda), oʻngda (faqat lg+) animatsion vizual.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  const t = getT();
  const year = new Date().getFullYear();

  return (
    <div className="relative flex min-h-dvh w-full bg-bg-base">
      {/* ── Chap ustun: forma ── */}
      <div className="relative flex w-full flex-col lg:w-1/2 xl:w-[46%]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,rgba(0,212,255,0.12),transparent_65%)]"
        />
        <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
          <Logo href="/" withText />
          <LangSwitch />
        </header>

        <main className="relative z-10 flex flex-1 items-center justify-center px-6 py-8 sm:px-10">
          <div className="w-full max-w-md">{children}</div>
        </main>

        <footer className="relative z-10 flex flex-wrap items-center justify-between gap-2 px-6 pb-6 text-xs text-text-muted sm:px-10">
          <span>
            © {year} {t('common.appName')}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-[#00FFB2]" aria-hidden="true" />
            {t('auth.login.secure')}
          </span>
        </footer>
      </div>

      {/* ── Oʻng ustun: vizual (faqat lg+) ── */}
      <aside className="relative hidden lg:block lg:w-1/2 xl:w-[54%]" aria-hidden="true">
        <div className="sticky top-0 h-dvh">
          <AuthVisual />
        </div>
      </aside>
    </div>
  );
}
