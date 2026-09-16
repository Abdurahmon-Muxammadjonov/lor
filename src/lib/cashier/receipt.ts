import { Prisma } from '@prisma/client';
import type { Tx } from '@/lib/prisma';
import type { Locale } from '@/i18n/config';
import { D, toMoneyNumber } from '@/lib/money';
import { dayRangeTz, fmtDateTime, todayKey } from '@/lib/date';
import { formatReceiptNo } from '@/lib/queue-number';
import { parseClinicSettings } from '@/lib/settings/types';
import type { ReceiptLine } from '@/lib/printer/types';
import type { ReceiptViewData } from './types';

/**
 * Kassa cheki (server): Prisma qabulidan `ReceiptData` yigʻish va chek raqamini berish.
 * Chek faqat snapshotdan (TreatmentLine.serviceName/unitPrice/lineTotal) oʻqiydi — narx keyin
 * oʻzgarsa ham eski chek oʻzgarmaydi.
 */

export const receiptVisitInclude = {
  patient: {
    select: { id: true, fullName: true, cardNumber: true, phone: true, birthDate: true, gender: true },
  },
  doctor: { select: { id: true, fullName: true, specialty: true, room: true, color: true } },
  lines: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] },
  payments: { include: { cashier: { select: { id: true, fullName: true } } }, orderBy: { createdAt: 'asc' } },
  clinic: {
    select: { id: true, name: true, phone: true, address: true, city: true, settings: true, roundTo: true },
  },
} satisfies Prisma.VisitInclude;

export type ReceiptVisit = Prisma.VisitGetPayload<{ include: typeof receiptVisitInclude }>;

export interface ReceiptOptions {
  /** Chek raqami (berilmasa — oxirgi toʻlovniki, u ham boʻlmasa "—") */
  receiptNo?: string | null;
  /** Chek sanasi (berilmasa — hozir) */
  dateTime?: Date;
  /** Ushbu chekdagi toʻlov summasi (qaytarishda manfiy) */
  paymentAmount?: number;
  method?: ReceiptViewData['method'];
}

/** APP_URL (yoki NEXTAUTH_URL) — chekdagi QR havolasi uchun */
export function appUrl(): string {
  const raw = process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
  return raw.replace(/\/+$/, '');
}

function num(v: Prisma.Decimal | number | string | null | undefined): number {
  return v === null || v === undefined ? 0 : toMoneyNumber(v.toString());
}

function lineName(line: ReceiptVisit['lines'][number], locale: Locale): string {
  const base = locale === 'ru' && line.serviceNameRu ? line.serviceNameRu : line.serviceName;
  return line.detail?.trim() ? `${base} (${line.detail.trim()})` : base;
}

/** Manzil + shahar (shahar manzilda takrorlanmasa) */
export function clinicAddress(address: string | null | undefined, city: string | null | undefined): string {
  const a = address?.trim() ?? '';
  const c = city?.trim() ?? '';
  if (!a) return c;
  if (!c || a.toLowerCase().includes(c.toLowerCase())) return a;
  return `${a}, ${c}`;
}

export function receiptLinesFor(visit: ReceiptVisit, locale: Locale): ReceiptLine[] {
  return visit.lines.map((l) => ({
    name: lineName(l, locale),
    qty: Number(D(l.quantity.toString()).toFixed(1)),
    unit: l.unit,
    unitPrice: num(l.unitPrice),
    total: num(l.lineTotal),
    side: l.side,
    // "Boshqa" organ chekda maʼnosiz — koʻrsatilmaydi
    organ: l.organ === 'OTHER' ? null : l.organ,
  }));
}

/**
 * Qabul → chek maʼlumoti.
 *  - lines: qator jamlari chegirmadan keyingi (lineTotal)
 *  - subtotal: Σ lineTotal; discount: umumiy (global) chegirma; total: yakuniy (yaxlitlangan) jami
 *  - paid: qabul boʻyicha jami toʻlangan; balance: total − paid (musbat = qarz)
 *  - qrText: APP_URL + /dashboard/visits/<id>
 */
export function receiptDataFor(
  visit: ReceiptVisit,
  locale: Locale,
  cashierName: string,
  opts: ReceiptOptions = {},
): ReceiptViewData {
  const settings = parseClinicSettings(visit.clinic.settings);
  const lines = receiptLinesFor(visit, locale);
  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  const lineDiscount = visit.lines.reduce((s, l) => s + num(l.discountTotal), 0);
  const total = num(visit.totalNet);
  const globalDiscount = Math.max(0, num(visit.discount) - lineDiscount);
  const paid = num(visit.paidAmount);
  const lastPayment = visit.payments.length > 0 ? visit.payments[visit.payments.length - 1] : undefined;
  const receiptNo = opts.receiptNo ?? lastPayment?.receiptNo ?? '—';
  const address = clinicAddress(visit.clinic.address, visit.clinic.city);

  return {
    clinicName: visit.clinic.name,
    phone: visit.clinic.phone,
    address: address || undefined,
    receiptNo,
    patientName: visit.patient.fullName,
    cardNumber: visit.patient.cardNumber,
    doctor: visit.doctor.fullName,
    lines,
    subtotal,
    discount: globalDiscount,
    total,
    paid,
    balance: total - paid,
    cashier: cashierName,
    dateTime: fmtDateTime(opts.dateTime ?? new Date(), locale),
    qrText: `${appUrl()}/dashboard/visits/${visit.id}`,
    footer: settings.printer.receiptFooter,
    locale,
    paymentAmount: opts.paymentAmount,
    method: opts.method,
    visitId: visit.id,
  };
}

/**
 * Keyingi chek raqami: YYYYMMDD-NNNN (klinika + kun boʻyicha ketma-ket).
 * Tranzaksiya ichida chaqiriladi — `pg_advisory_xact_lock` parallel toʻlovlarni ketma-ketlashtiradi.
 * Raqam = max(bugungi toʻlovlar soni, mavjud eng katta raqam) + 1 — har doim unikal.
 */
export async function nextReceiptNo(tx: Tx, clinicId: string, dateKey: string = todayKey()): Promise<string> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`receipt:${clinicId}:${dateKey}`}))`;
  const { start, end } = dayRangeTz(dateKey);
  const prefix = dateKey.replace(/-/g, '');
  const [count, rows] = await Promise.all([
    tx.payment.count({ where: { clinicId, createdAt: { gte: start, lte: end } } }),
    tx.$queryRaw<{ seq: number | null }[]>`
      SELECT MAX(CAST(split_part("receiptNo", '-', 2) AS INTEGER)) AS seq
      FROM "Payment"
      WHERE "clinicId" = ${clinicId}
        AND "receiptNo" LIKE ${`${prefix}-%`}
        AND "receiptNo" ~ '^[0-9]{8}-[0-9]+$'`,
  ]);
  const maxSeq = Number(rows[0]?.seq ?? 0);
  return formatReceiptNo(dateKey, Math.max(count, maxSeq) + 1);
}
