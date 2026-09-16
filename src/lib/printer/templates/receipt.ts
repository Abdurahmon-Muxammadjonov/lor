import type { PrinterSettings } from '@/lib/settings/types';
import { formatMoney } from '@/lib/money';
import { formatQuantity } from '@/lib/calc';
import { EscPos } from '../escpos';
import { pm, type PrinterDict } from '../messages';
import type { ReceiptData, ReceiptLine } from '../types';

/** Chekdagi pul: "1 250 000" (valyutasiz) */
export function receiptMoney(v: number): string {
  return formatMoney(v, { suffix: '' });
}

function sideText(d: PrinterDict['receipt'], side: string | null | undefined): string {
  if (!side) return '';
  const key = side.toUpperCase();
  return key === 'LEFT' || key === 'RIGHT' || key === 'BOTH' ? d.side[key] : side;
}

function organText(d: PrinterDict['receipt'], organ: string | null | undefined): string {
  if (!organ) return '';
  const key = organ.toUpperCase();
  return key === 'EAR' || key === 'NOSE' || key === 'THROAT' || key === 'LARYNX' || key === 'OTHER'
    ? d.organ[key]
    : organ;
}

/** "quloq, chap" / "ухо, слева" → qator ostidagi kichik izoh (organ, keyin tomon) */
export function lineDetail(d: PrinterDict['receipt'], line: ReceiptLine): string {
  return [organText(d, line.organ), sideText(d, line.side)].filter(Boolean).join(', ');
}

/** "1.5 seans" */
export function qtyText(line: ReceiptLine): string {
  const q = formatQuantity(line.qty);
  return line.unit ? `${q} ${line.unit}` : q;
}

/**
 * Kassa cheki (58/80 mm).
 *
 * 80 mm — 4 ustunli jadval (Xizmat 18 | Miqd. 9 | Narx 9 | Jami 9);
 * 58 mm — har qator: nomi (oʻraladi), [izoh], "miqdor x narx …… jami".
 */
export function buildReceipt(data: ReceiptData, settings: PrinterSettings): Uint8Array {
  const L = pm(data.locale).receipt;
  const p = new EscPos({ paperWidth: settings.paperWidth, codepage: settings.codepage });
  const wide = settings.paperWidth === 80;

  // ── Sarlavha ──
  p.init().align('center');
  p.bold(true).size(1, 2).paragraph(data.clinicName).size(1, 1).bold(false);
  if (data.address?.trim()) p.paragraph(data.address.trim());
  if (data.phone?.trim()) p.line(`${L.phone}: ${data.phone.trim()}`);
  p.feed(1);
  p.bold(true).line(L.title).bold(false);
  p.hr();

  // ── Rekvizitlar ──
  p.align('left');
  p.row(`${L.no}:`, data.receiptNo);
  p.row(`${L.patient}:`, data.patientName);
  p.row(`${L.card}:`, data.cardNumber);
  p.row(`${L.doctor}:`, data.doctor);
  p.hr();

  // ── Qatorlar ──
  if (wide) {
    const widths = { name: 18, qty: 9, price: 9, total: 9 }; // 18+9+9+9 + 3 gap = 48 ("1.5 seans" sigʻadi)
    p.bold(true)
      .table([
        { text: L.colService, width: widths.name },
        { text: L.colQty, width: widths.qty, align: 'right' },
        { text: L.colPrice, width: widths.price, align: 'right' },
        { text: L.colTotal, width: widths.total, align: 'right' },
      ])
      .bold(false);
    for (const line of data.lines) {
      p.table([
        { text: line.name, width: widths.name },
        { text: qtyText(line), width: widths.qty, align: 'right' },
        { text: receiptMoney(line.unitPrice), width: widths.price, align: 'right' },
        { text: receiptMoney(line.total), width: widths.total, align: 'right' },
      ]);
      const detail = lineDetail(L, line);
      if (detail) p.line(`  (${detail})`);
    }
  } else {
    for (const line of data.lines) {
      p.paragraph(line.name);
      const detail = lineDetail(L, line);
      if (detail) p.line(`  (${detail})`);
      p.row(`  ${qtyText(line)} x ${receiptMoney(line.unitPrice)}`, receiptMoney(line.total));
    }
  }
  p.hr();

  // ── Jamlar ──
  p.row(L.subtotal, receiptMoney(data.subtotal));
  if (data.discount > 0) p.row(L.discount, `-${receiptMoney(data.discount)}`);
  p.bold(true).size(1, 2).row(L.total, `${receiptMoney(data.total)} ${L.currency}`).size(1, 1).bold(false);
  p.row(L.paid, receiptMoney(data.paid));
  if (data.balance > 0) p.bold(true).row(L.debt, receiptMoney(data.balance)).bold(false);
  else if (data.balance < 0) p.row(L.overpaid, receiptMoney(-data.balance));
  else p.row(L.balance, receiptMoney(0));
  p.hr();

  // ── Kassir / sana ──
  p.row(`${L.cashier}:`, data.cashier);
  p.row(`${L.date}:`, data.dateTime);

  // ── QR ──
  if (settings.receiptQr && data.qrText?.trim()) {
    p.feed(1).align('center').qr(data.qrText.trim(), wide ? 6 : 5).feed(1);
  }

  // ── Footer ──
  p.align('center');
  const footer = (data.footer || settings.receiptFooter).trim();
  if (footer) p.paragraph(footer);

  p.feed(3);
  if (settings.cut) p.cut(true);
  return p.build();
}
