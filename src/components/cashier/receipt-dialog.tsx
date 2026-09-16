'use client';

import * as React from 'react';
import Link from 'next/link';
import { ExternalLink, Printer, ReceiptText } from 'lucide-react';
import { useT } from '@/i18n/client';
import { usePrinter } from '@/lib/printer/use-printer-settings';
import { isRawTransport } from '@/lib/printer/print';
import type { ReceiptViewData } from '@/lib/cashier/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ReceiptPreview, useReceiptPrint } from './receipt-preview';

export interface ReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  receipt: ReceiptViewData | null;
  /** Ochilganda termal printerga avtomatik yuborish (settings.autoPrintReceipt boʻlsa) */
  autoPrint?: boolean;
  /** Toʻlovdan soʻng — "Yana toʻlov" tugmasi */
  onNewPayment?: () => void;
}

/**
 * Chek oynasi: HTML chek koʻrinishi, [Chop etish] (brauzer, react-to-print), [Printerga yuborish] (ESC/POS),
 * qabulga havola. `autoPrint` va sozlamada `autoPrintReceipt=true` boʻlsa ochilishda bir marta printerga yuboradi.
 */
export function ReceiptDialog({
  open,
  onOpenChange,
  receipt,
  autoPrint = false,
  onNewPayment,
}: ReceiptDialogProps) {
  const t = useT();
  const printer = usePrinter();
  const { settings } = printer;
  const { paperRef, print } = useReceiptPrint({
    paperWidth: settings.paperWidth,
    documentTitle: receipt ? `${t('cashier.meta.receipt')} ${receipt.receiptNo}` : undefined,
  });
  const [ready, setReady] = React.useState(false);
  const printedFor = React.useRef<string | null>(null);

  const fallbackUrl = receipt?.visitId ? `/print/receipt/${encodeURIComponent(receipt.visitId)}` : '';
  const raw = isRawTransport(settings.transport);

  React.useEffect(() => {
    if (!open) {
      printedFor.current = null;
      setReady(false);
    }
  }, [open]);

  // Avtomatik chop etish: dialog ochiq, chek tayyor, sozlama yoqilgan, hali yuborilmagan
  React.useEffect(() => {
    if (!open || !autoPrint || !receipt || !ready || printer.isLoading) return;
    if (!settings.autoPrintReceipt) return;
    const key = `${receipt.receiptNo}:${receipt.dateTime}`;
    if (printedFor.current === key) return;
    printedFor.current = key;
    void printer.printReceipt(receipt, fallbackUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autoPrint, receipt, ready, printer.isLoading, settings.autoPrintReceipt]);

  const sendToPrinter = () => {
    if (!receipt) return;
    void printer.printReceipt(receipt, fallbackUrl);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ReceiptText className="size-5 text-accent" aria-hidden="true" />
            {t('cashier.receipt.title')}
          </DialogTitle>
          <DialogDescription>
            {receipt
              ? `${t('cashier.payments.receiptNo')} ${receipt.receiptNo} · ${receipt.dateTime}`
              : t('cashier.receipt.preview')}
          </DialogDescription>
        </DialogHeader>

        <div className="scrollbar-thin max-h-[55vh] overflow-auto rounded-xl border border-line bg-[#0A0E1A] p-4 sm:p-6">
          {receipt ? (
            <div className="receipt-stage mx-auto w-fit">
              <ReceiptPreview
                ref={paperRef}
                receipt={receipt}
                paperWidth={settings.paperWidth}
                showQr={settings.receiptQr}
                onReady={() => setReady(true)}
                zoom
                className="shadow-[0_10px_40px_-10px_rgba(0,0,0,0.9)]"
              />
            </div>
          ) : null}
        </div>

        <DialogFooter className="sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row">
            {receipt?.visitId ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={`/dashboard/visits/${encodeURIComponent(receipt.visitId)}`}>
                  <ExternalLink aria-hidden="true" />
                  {t('cashier.receipt.openVisit')}
                </Link>
              </Button>
            ) : null}
            {onNewPayment ? (
              <Button type="button" variant="ghost" size="sm" onClick={onNewPayment}>
                {t('cashier.receipt.newPayment')}
              </Button>
            ) : null}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('cashier.receipt.close')}
            </Button>
            {raw ? (
              <Button
                type="button"
                variant="secondary"
                onClick={sendToPrinter}
                loading={printer.isPrinting}
                disabled={!receipt}
              >
                <Printer aria-hidden="true" />
                {t('cashier.receipt.printThermal')}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="gradient"
              className="glow"
              onClick={() => print()}
              disabled={!receipt}
            >
              <Printer aria-hidden="true" />
              {t('cashier.receipt.print')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
