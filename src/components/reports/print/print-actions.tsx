'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, Printer } from 'lucide-react';
import { useT } from '@/i18n/client';
import { Button } from '@/components/ui/button';

export interface PrintActionsProps {
  backHref: string;
  /** `?auto=1` — sahifa ochilishi bilan chop etish oynasi */
  auto: boolean;
}

/** Chop etish koʻrinishi boshqaruvlari (ekranda koʻrinadi, qogʻozda yoʻq) */
export function PrintActions({ backHref, auto }: PrintActionsProps) {
  const t = useT();
  React.useEffect(() => {
    if (!auto) return;
    const id = window.setTimeout(() => window.print(), 500);
    return () => window.clearTimeout(id);
  }, [auto]);

  return (
    <div className="no-print mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface/80 p-3 text-text">
      <Button asChild variant="outline" size="sm">
        <Link href={backHref}>
          <ArrowLeft aria-hidden="true" />
          {t('reports.print.back')}
        </Link>
      </Button>
      <Button variant="gradient" size="sm" onClick={() => window.print()} autoFocus>
        <Printer aria-hidden="true" />
        {t('common.print')} / PDF
      </Button>
      <p className="text-xs text-text-muted sm:ml-2">{t('reports.print.hint')}</p>
    </div>
  );
}
