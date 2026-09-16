import { Prisma } from '@prisma/client';
import type Decimal from 'decimal.js';
import type { Tx } from '@/lib/prisma';
import { calcLine, calcVisit, type DiscountType, type PatientType } from '@/lib/calc';
import { D, sumMoney, toMoneyString, type MoneyInput } from '@/lib/money';

/**
 * Qabul jamlarini serverda qayta hisoblash.
 *
 * Har bir TreatmentLine yaratilganda/oʻzgarganda/oʻchirilganda va har bir Payment dan soʻng
 * `recalcVisit(tx, visitId)` chaqiriladi — Visit.totalGross/discount/totalNet/paidAmount
 * hech qachon clientdan kelmaydi, faqat shu yerda yoziladi.
 *
 * Formulalar (src/lib/calc.ts bilan bir xil):
 *   totalGross = Σ line.grossTotal
 *   discount   = Σ line.discountTotal + umumiy chegirma (Visit.globalDiscountType/Value)
 *   totalNet   = roundToStep(Σ line.lineTotal − umumiy chegirma, clinic.roundTo)
 *   paidAmount = Σ payment.amount (manfiy = qaytarish)
 *   balance    = totalNet − paidAmount (musbat = qarz, manfiy = ortiqcha)
 */

export interface VisitTotalsResult {
  totalGross: Decimal;
  discount: Decimal;
  totalNet: Decimal;
  paidAmount: Decimal;
  balance: Decimal;
}

/** Butun soʻm → Prisma.Decimal (DB ga yozish uchun) */
export function dbMoney(v: MoneyInput | null | undefined): Prisma.Decimal {
  return new Prisma.Decimal(toMoneyString(v ?? 0));
}

/** Miqdor (0.5 qadam) → Prisma.Decimal(6,1) */
export function dbQuantity(q: MoneyInput): Prisma.Decimal {
  return new Prisma.Decimal(D(q).toFixed(1));
}

/** Prisma.Decimal / number / string → decimal.js Decimal (arifmetika uchun) */
function dec(v: MoneyInput | null | undefined): Decimal {
  return D(v === null || v === undefined ? 0 : v.toString());
}

export async function recalcVisit(tx: Tx, visitId: string): Promise<VisitTotalsResult> {
  const visit = await tx.visit.findUniqueOrThrow({
    where: { id: visitId },
    select: {
      id: true,
      globalDiscountType: true,
      globalDiscountValue: true,
      clinic: { select: { roundTo: true } },
    },
  });

  const lines = await tx.treatmentLine.findMany({
    where: { visitId },
    select: { grossTotal: true, discountTotal: true, lineTotal: true },
  });

  const payments = await tx.payment.findMany({
    where: { visitId },
    select: { amount: true },
  });

  const totalGross = sumMoney(lines.map((l) => dec(l.grossTotal)));
  const lineDiscount = sumMoney(lines.map((l) => dec(l.discountTotal)));
  const nets = lines.map((l) => dec(l.lineTotal));
  const paid = payments.map((p) => dec(p.amount));

  const totals = calcVisit(
    nets,
    { type: visit.globalDiscountType, value: dec(visit.globalDiscountValue) },
    paid,
    visit.clinic.roundTo,
  );

  const discount = lineDiscount.plus(totals.globalDiscount);
  const totalNet = totals.total;
  const paidAmount = totals.paid;
  const balance = totals.balance;

  await tx.visit.update({
    where: { id: visitId },
    data: {
      totalGross: dbMoney(totalGross),
      discount: dbMoney(discount),
      totalNet: dbMoney(totalNet),
      paidAmount: dbMoney(paidAmount),
    },
  });

  return { totalGross, discount, totalNet, paidAmount, balance };
}

// ───────────────────────────── Qator snapshoti ─────────────────────────────

/** Snapshot uchun xizmat maydonlari (Service modelidan yoki DTO dan) */
export interface LineSnapshotService {
  code: string;
  name: string;
  nameRu: string;
  unit: string;
  priceAdultNoMed: MoneyInput;
  priceAdultMed: MoneyInput;
  priceChildNoMed: MoneyInput;
  priceChildMed: MoneyInput;
  allowHalf: boolean;
  medicineOptional: boolean;
}

/** Clientdan keladigan qator parametrlari (narx YOʻQ — narx serverda olinadi) */
export interface LineSnapshotInput {
  patientType: PatientType;
  withMedicine: boolean;
  quantity: number | string | Decimal;
  discountType: DiscountType;
  discountValue: number | string | Decimal;
}

/**
 * `prisma.treatmentLine.create({ data: { visitId, serviceId, ...snapshot, side, organ, ... } })`
 * uchun tayyor maydonlar. Barcha pul qiymatlari Prisma.Decimal (butun soʻm).
 */
export interface LineSnapshotData {
  serviceCode: string;
  serviceName: string;
  serviceNameRu: string;
  unit: string;
  patientType: PatientType;
  withMedicine: boolean;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  grossTotal: Prisma.Decimal;
  discountType: DiscountType;
  discountValue: Prisma.Decimal;
  discountTotal: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
}

/**
 * Xizmat narxidan qator snapshotini hisoblaydi (calcLine). Xato boʻlsa CalcError otadi
 * (INVALID_QUANTITY | HALF_NOT_ALLOWED | INVALID_DISCOUNT | NEGATIVE_PRICE) — API 400 qaytaradi.
 *
 * `medicineOptional=false` boʻlsa `withMedicine` majburan `true` (narx ham "dori bilan").
 */
export function computeLineSnapshot(service: LineSnapshotService, input: LineSnapshotInput): LineSnapshotData {
  const withMedicine = service.medicineOptional ? input.withMedicine : true;
  const discountType: DiscountType = input.discountType;

  const r = calcLine(
    {
      patientType: input.patientType,
      withMedicine,
      quantity: input.quantity,
      discountType,
      discountValue: input.discountValue,
    },
    {
      priceAdultNoMed: dec(service.priceAdultNoMed),
      priceAdultMed: dec(service.priceAdultMed),
      priceChildNoMed: dec(service.priceChildNoMed),
      priceChildMed: dec(service.priceChildMed),
      allowHalf: service.allowHalf,
      medicineOptional: service.medicineOptional,
    },
  );

  // Chegirma qiymati: NONE → 0; PERCENT → foiz (0..100); FIXED → soʻm
  const discountValue = discountType === 'NONE' ? new Prisma.Decimal(0) : new Prisma.Decimal(D(input.discountValue).toFixed(2));

  return {
    serviceCode: service.code,
    serviceName: service.name,
    serviceNameRu: service.nameRu,
    unit: service.unit,
    patientType: input.patientType,
    withMedicine,
    quantity: dbQuantity(r.quantity),
    unitPrice: dbMoney(r.unitPrice),
    grossTotal: dbMoney(r.gross),
    discountType,
    discountValue,
    discountTotal: dbMoney(r.discount),
    lineTotal: dbMoney(r.net),
  };
}
