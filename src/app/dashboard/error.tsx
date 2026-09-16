'use client';

import * as React from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';
import { useT } from '@/i18n/client';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/shared/empty-state';

/** /dashboard/* sahifalaridagi kutilmagan xato: toast + qayta urinish / bosh sahifa */
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useT();

  React.useEffect(() => {
    toast.error(t('dashboard.error.title'), { id: 'dashboard-error', description: t('dashboard.error.description') });
  }, [error, t]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <EmptyState
        icon={AlertTriangle}
        title={t('dashboard.error.title')}
        description={
          <>
            {t('dashboard.error.description')}
            {error.digest ? (
              <span className="mt-2 block font-mono text-xs text-muted-foreground/80">
                {t('common.errorPage.code')}: {error.digest}
              </span>
            ) : null}
          </>
        }
        action={
          <>
            <Button variant="gradient" onClick={reset}>
              <RotateCcw aria-hidden="true" />
              {t('common.retry')}
            </Button>
            <Button asChild variant="outline">
              <Link href="/dashboard">
                <Home aria-hidden="true" />
                {t('common.goHome')}
              </Link>
            </Button>
          </>
        }
        className="w-full max-w-lg"
      />
    </div>
  );
}
