'use client';

import Link from 'next/link';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';
import { useT } from '@/i18n/client';
import { Button } from '@/components/ui/button';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const t = useT();

  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-bg-base px-4 py-16 text-text">
      <div className="bg-grid bg-grid-fade pointer-events-none absolute inset-0" aria-hidden="true" />
      <div
        className="pointer-events-none absolute left-1/2 top-1/3 h-[380px] w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-danger opacity-10 blur-[120px]"
        aria-hidden="true"
      />
      <div className="glass relative w-full max-w-md p-8 text-center sm:p-10" role="alert">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/10 text-danger">
          <AlertTriangle className="size-8" aria-hidden="true" />
        </div>
        <h1 className="mt-6 font-heading text-2xl font-bold text-text">{t('common.errorPage.title')}</h1>
        <p className="mt-3 text-sm leading-relaxed text-text-muted">{t('common.errorPage.description')}</p>
        {error.digest ? (
          <p className="mt-4 text-xs text-text-muted">
            {t('common.errorPage.code')}: <code className="kbd">{error.digest}</code>
          </p>
        ) : null}
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button variant="gradient" size="lg" onClick={reset}>
            <RotateCcw aria-hidden="true" />
            {t('common.errorPage.retry')}
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/">
              <Home aria-hidden="true" />
              {t('common.goHome')}
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
