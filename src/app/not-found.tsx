import Link from 'next/link';
import { ArrowLeft, Home } from 'lucide-react';
import { getT } from '@/i18n/server';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  const t = getT();
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-bg-base px-4 py-16 text-text">
      <div className="bg-grid bg-grid-fade pointer-events-none absolute inset-0" aria-hidden="true" />
      <div
        className="pointer-events-none absolute left-1/2 top-1/3 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-accent opacity-20 blur-[120px]"
        aria-hidden="true"
      />
      <div className="glass relative w-full max-w-md p-8 text-center sm:p-10">
        <p className="text-gradient font-heading text-7xl font-extrabold leading-none tracking-tighter sm:text-8xl">404</p>
        <h1 className="mt-6 font-heading text-2xl font-bold text-text">{t('common.notFound.title')}</h1>
        <p className="mt-3 text-sm leading-relaxed text-text-muted">{t('common.notFound.description')}</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild variant="gradient" size="lg">
            <Link href="/">
              <Home aria-hidden="true" />
              {t('common.notFound.back')}
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/dashboard">
              <ArrowLeft aria-hidden="true" />
              {t('common.nav.dashboard')}
            </Link>
          </Button>
        </div>
        <p className="mt-8 text-xs text-text-muted">
          {t('common.appName')} · {t('common.tagline')}
        </p>
      </div>
    </main>
  );
}
