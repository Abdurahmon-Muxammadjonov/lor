'use client';

import * as React from 'react';
import { ArrowLeft, Printer, X } from 'lucide-react';
import { useT } from '@/i18n/client';
import type { PaperWidth } from '@/lib/settings/types';
import type { ReceiptViewData } from '@/lib/cashier/types';
import { ReceiptPreview } from './receipt-preview';

export interface PrintReceiptClientProps {
  receipt: ReceiptViewData;
  paperWidth: PaperWidth;
  showQr: boolean;
  /** Sahifa oʻzi (yuqori darajadagi oyna boʻlsa) yuklangach `window.print()` chaqiradi */
  autoPrint: boolean;
  hasPayments: boolean;
}

const BTN =
  'inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 [&_svg]:size-4';

/**
 * /print/receipt/[visitId] — oq fonli chop etish sahifasi.
 * Yuqori darajadagi oynada avtomatik chop etadi; iframe ichida (printer kutubxonasining BROWSER zaxirasi,
 * bemor kartasidagi chop etish) tashqi sahifa `contentWindow.print()` ni chaqiradi — ikki marta chiqmasligi uchun
 * bu yerda chop etilmaydi.
 */
export function PrintReceiptClient({
  receipt,
  paperWidth,
  showQr,
  autoPrint,
  hasPayments,
}: PrintReceiptClientProps) {
  const t = useT();
  const [ready, setReady] = React.useState(false);
  const [embedded, setEmbedded] = React.useState(false);
  const printed = React.useRef(false);

  React.useEffect(() => {
    setEmbedded(window.self !== window.top);
  }, []);

  React.useEffect(() => {
    if (!autoPrint || !ready || printed.current) return;
    if (window.self !== window.top) return;
    printed.current = true;
    const id = window.setTimeout(() => window.print(), 300);
    return () => window.clearTimeout(id);
  }, [autoPrint, ready]);

  return (
    <div className="min-h-dvh bg-white text-black">
      <style>{`@media print { @page { size: ${paperWidth}mm auto; margin: 3mm; } }`}</style>
      {embedded ? null : (
        <header className="no-print sticky top-0 z-10 border-b border-neutral-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2 px-4 py-2">
            <div className="min-w-0 text-sm text-neutral-700">
              <span className="font-semibold text-neutral-900">{t('cashier.receipt.title')}</span>
              <span className="tabular ml-2 font-mono text-neutral-500">{receipt.receiptNo}</span>
              {!hasPayments ? (
                <span className="ml-2 text-neutral-500">· {t('cashier.receipt.noPayments')}</span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <a
                href="/dashboard/cashier"
                className={`${BTN} border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-100 focus-visible:ring-neutral-400`}
              >
                <ArrowLeft aria-hidden="true" />
                {t('cashier.receipt.backToCashier')}
              </a>
              <button
                type="button"
                onClick={() => window.print()}
                className={`${BTN} border-neutral-900 bg-neutral-900 text-white hover:bg-neutral-700 focus-visible:ring-neutral-500`}
              >
                <Printer aria-hidden="true" />
                {t('cashier.receipt.print')}
              </button>
              <button
                type="button"
                onClick={() => window.close()}
                className={`${BTN} border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-100 focus-visible:ring-neutral-400`}
              >
                <X aria-hidden="true" />
                {t('cashier.receipt.closeWindow')}
              </button>
            </div>
          </div>
        </header>
      )}
      <main className="flex justify-center px-4 py-6 print:p-0">
        <ReceiptPreview
          receipt={receipt}
          paperWidth={paperWidth}
          showQr={showQr}
          onReady={() => setReady(true)}
          className="shadow-[0_8px_30px_-12px_rgba(0,0,0,0.35)] print:shadow-none"
        />
      </main>
    </div>
  );
}
