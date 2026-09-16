'use client';

import * as React from 'react';
import { Printer, X } from 'lucide-react';
import { useT } from '@/i18n/client';
import { Button } from '@/components/ui/button';

/**
 * /print/ticket/[id] uchun: sahifa toʻgʻridan-toʻgʻri (yuqori darajada) ochilganda `window.print()` ni
 * avtomatik chaqiradi. Iframe ichida (printer kutubxonasining BROWSER zaxirasi) chaqirmaydi —
 * u yerda `contentWindow.print()` ni transportning oʻzi bajaradi (ikki marta dialog chiqmasin).
 */
export function AutoPrint({ enabled = true }: { enabled?: boolean }) {
  const t = useT();
  const [isTop, setIsTop] = React.useState(false);
  const fired = React.useRef(false);

  React.useEffect(() => {
    const top = window.self === window.top;
    setIsTop(top);
    if (!enabled || !top || fired.current) return;
    fired.current = true;
    const id = window.setTimeout(() => window.print(), 250);
    return () => window.clearTimeout(id);
  }, [enabled]);

  if (!isTop) return null;
  return (
    <div className="no-print fixed inset-x-0 bottom-0 flex items-center justify-center gap-2 border-t border-line bg-popover/95 p-3 backdrop-blur">
      <Button type="button" onClick={() => window.print()} aria-label={t('queue.print.printButton')}>
        <Printer aria-hidden="true" />
        {t('queue.print.printButton')}
      </Button>
      <Button type="button" variant="outline" onClick={() => window.close()} aria-label={t('queue.print.close')}>
        <X aria-hidden="true" />
        {t('queue.print.close')}
      </Button>
    </div>
  );
}
