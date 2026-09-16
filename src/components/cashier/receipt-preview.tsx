'use client';

import * as React from 'react';
import { toDataURL } from 'qrcode';
import { useReactToPrint } from 'react-to-print';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/client';
import type { PaperWidth } from '@/lib/settings/types';
import { pm } from '@/lib/printer/messages';
import { lineDetail, qtyText, receiptMoney } from '@/lib/printer/templates/receipt';
import type { ReceiptViewData } from '@/lib/cashier/types';

export interface ReceiptPreviewProps {
  receipt: ReceiptViewData;
  /** 58 yoki 80 mm (printer sozlamasi) */
  paperWidth?: PaperWidth;
  /** QR kodni koʻrsatish (settings.receiptQr) */
  showQr?: boolean;
  className?: string;
  /** QR rasmi tayyor boʻlganda (yoki QR kerak boʻlmasa darhol) — avtomatik chop etish uchun */
  onReady?: () => void;
  /** Chekni ekranda kattaroq koʻrsatish (dialog) */
  zoom?: boolean;
}

/** Chek qogʻozining chop etiladigan kengligi (mm) */
export function paperContentWidthMm(paperWidth: PaperWidth): number {
  return paperWidth === 80 ? 72 : 48;
}

/** react-to-print sahifa uslubi: qogʻoz kengligi va kichik hoshiya */
export function receiptPageStyle(paperWidth: PaperWidth): string {
  return `@page { size: ${paperWidth}mm auto; margin: 3mm; } html, body { margin: 0; background: #fff; }`;
}

/**
 * HTML kassa cheki (58/80 mm). Termal shablon (`buildReceipt`) bilan bir xil lugʻat va tartib:
 * sarlavha → rekvizitlar → qatorlar → jamlar → ushbu toʻlov → kassir/sana → QR → footer.
 * `ref` chop etiladigan qogʻoz elementiga ishora qiladi (react-to-print `contentRef`).
 */
export const ReceiptPreview = React.forwardRef<HTMLDivElement, ReceiptPreviewProps>(
  ({ receipt, paperWidth = 58, showQr = true, className, onReady, zoom = false }, ref) => {
    const t = useT();
    const L = pm(receipt.locale).receipt;
    const [qr, setQr] = React.useState<string | null>(null);
    const wantQr = showQr && !!receipt.qrText?.trim();
    const onReadyRef = React.useRef(onReady);
    onReadyRef.current = onReady;

    React.useEffect(() => {
      let cancelled = false;
      if (!wantQr) {
        setQr(null);
        onReadyRef.current?.();
        return;
      }
      toDataURL(receipt.qrText ?? '', {
        margin: 0,
        width: 220,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#ffffff' },
      })
        .then((url) => {
          if (cancelled) return;
          setQr(url);
          onReadyRef.current?.();
        })
        .catch(() => {
          if (cancelled) return;
          setQr(null);
          onReadyRef.current?.();
        });
      return () => {
        cancelled = true;
      };
    }, [wantQr, receipt.qrText]);

    const wide = paperWidth === 80;
    const isRefund = (receipt.paymentAmount ?? 0) < 0;
    const money = (v: number) => receiptMoney(v);

    return (
      <div
        ref={ref}
        data-receipt-no={receipt.receiptNo}
        className={cn(
          'receipt-paper mx-auto box-content bg-white px-[3mm] py-[4mm] font-sans text-black antialiased',
          wide ? 'text-[12px] leading-[1.35]' : 'text-[11px] leading-[1.35]',
          zoom && 'sm:text-[13px]',
          className,
        )}
        style={{ width: `${paperContentWidthMm(paperWidth)}mm` }}
      >
        {/* Sarlavha */}
        <div className="text-center">
          <div className="font-heading text-[1.35em] font-bold leading-tight">{receipt.clinicName}</div>
          {receipt.address ? <div className="mt-0.5 opacity-80">{receipt.address}</div> : null}
          {receipt.phone ? (
            <div className="opacity-80">
              {L.phone}: {receipt.phone}
            </div>
          ) : null}
          <div className="mt-2 font-bold tracking-wide">{L.title}</div>
        </div>

        <Hr />

        {/* Rekvizitlar */}
        <Row label={`${L.no}:`} value={<span className="font-mono">{receipt.receiptNo}</span>} />
        <Row label={`${L.patient}:`} value={receipt.patientName} />
        <Row label={`${L.card}:`} value={<span className="font-mono">{receipt.cardNumber}</span>} />
        <Row label={`${L.doctor}:`} value={receipt.doctor} />

        <Hr />

        {/* Qatorlar */}
        {receipt.lines.length === 0 ? (
          <div className="py-1 text-center opacity-70">{t('cashier.pay.noLines')}</div>
        ) : (
          <ul className="space-y-1">
            {receipt.lines.map((line, i) => {
              const detail = lineDetail(L, line);
              return (
                <li key={i} className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="break-words font-medium">{line.name}</div>
                    {detail ? <div className="text-[0.9em] opacity-70">({detail})</div> : null}
                    <div className="tabular text-[0.9em] opacity-70">
                      {qtyText(line)} × {money(line.unitPrice)}
                    </div>
                  </div>
                  <div className="tabular whitespace-nowrap font-medium">{money(line.total)}</div>
                </li>
              );
            })}
          </ul>
        )}

        <Hr />

        {/* Jamlar */}
        <Row label={L.subtotal} value={money(receipt.subtotal)} />
        {receipt.discount > 0 ? <Row label={L.discount} value={`-${money(receipt.discount)}`} /> : null}
        <div className="my-1 flex items-baseline justify-between gap-2 font-heading text-[1.25em] font-bold">
          <span>{L.total}</span>
          <span className="tabular whitespace-nowrap">
            {money(receipt.total)} {L.currency}
          </span>
        </div>
        <Row label={L.paid} value={money(receipt.paid)} />
        {receipt.balance > 0 ? (
          <Row label={L.debt} value={money(receipt.balance)} strong />
        ) : receipt.balance < 0 ? (
          <Row label={L.overpaid} value={money(-receipt.balance)} />
        ) : (
          <Row label={L.balance} value={money(0)} />
        )}

        {receipt.paymentAmount !== undefined ? (
          <>
            <Hr />
            {isRefund ? (
              <div className="text-center font-bold tracking-widest">{t('cashier.receipt.refundMark')}</div>
            ) : null}
            <Row
              label={`${t('cashier.receipt.thisPayment')}${receipt.method ? ` (${t(`common.payMethod.${receipt.method}`)})` : ''}`}
              value={`${isRefund ? '-' : ''}${money(Math.abs(receipt.paymentAmount))}`}
              strong
            />
          </>
        ) : null}

        <Hr />

        <Row label={`${L.cashier}:`} value={receipt.cashier} />
        <Row label={`${L.date}:`} value={<span className="tabular">{receipt.dateTime}</span>} />

        {/* QR */}
        {wantQr ? (
          <div className="mt-3 flex flex-col items-center gap-1">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qr}
                alt={t('cashier.receipt.qrHint')}
                width={wide ? 120 : 96}
                height={wide ? 120 : 96}
                className="block"
              />
            ) : (
              <div
                aria-hidden="true"
                className="bg-neutral-200"
                style={{ width: wide ? 120 : 96, height: wide ? 120 : 96 }}
              />
            )}
            <div className="text-[0.85em] opacity-70">{t('cashier.receipt.qrHint')}</div>
          </div>
        ) : null}

        {/* Footer */}
        {receipt.footer?.trim() ? (
          <div className="mt-3 text-center opacity-90">{receipt.footer.trim()}</div>
        ) : null}
      </div>
    );
  },
);
ReceiptPreview.displayName = 'ReceiptPreview';

function Hr() {
  return <div aria-hidden="true" className="my-1.5 border-t border-dashed border-black/60" />;
}

function Row({
  label,
  value,
  strong = false,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-2', strong && 'font-bold')}>
      <span className="min-w-0 break-words">{label}</span>
      <span className="tabular whitespace-nowrap text-right">{value}</span>
    </div>
  );
}

export interface UseReceiptPrintOptions {
  paperWidth: PaperWidth;
  documentTitle?: string;
  onAfterPrint?: () => void;
}

/** react-to-print oʻrami: `const { paperRef, print } = useReceiptPrint({ paperWidth })` → `<ReceiptPreview ref={paperRef} />` */
export function useReceiptPrint({ paperWidth, documentTitle, onAfterPrint }: UseReceiptPrintOptions) {
  const paperRef = React.useRef<HTMLDivElement>(null);
  const print = useReactToPrint({
    contentRef: paperRef,
    documentTitle,
    pageStyle: receiptPageStyle(paperWidth),
    onAfterPrint,
  });
  return { paperRef, print };
}
