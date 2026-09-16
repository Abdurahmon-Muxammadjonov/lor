import { Prisma, type PayMethod, type Role } from '@prisma/client';
import Decimal from 'decimal.js';
import { prisma, type Tx } from '@/lib/prisma';
import { ApiError } from '@/lib/api/errors';
import { audit } from '@/lib/api/audit';
import { serialize } from '@/lib/api/respond';
import { dbMoney, recalcVisit, type VisitTotalsResult } from '@/lib/visits/recalc';
import type { VisitTotalsDTO } from '@/lib/visits/types';
import { D, toMoneyNumber } from '@/lib/money';
import { dayRangeTz, todayRange } from '@/lib/date';
import type { Locale } from '@/i18n/config';
import { emptyMethodTotals } from './format';
import { nextReceiptNo, receiptDataFor, receiptVisitInclude, type ReceiptVisit } from './receipt';
import type {
  CloseShiftInput,
  CreatePaymentInput,
  ListPaymentsQuery,
  ListShiftsQuery,
  OpenShiftInput,
  RefundBody,
  UnpaidQuery,
} from './schemas';
import type {
  CashierVisitDTO,
  CloseShiftResultDTO,
  CurrentShiftResponse,
  MethodTotals,
  PaymentListItemDTO,
  PaymentListResponse,
  PaymentListSummary,
  PaymentResultDTO,
  ReceiptViewData,
  RefundResultDTO,
  ShiftDetailDTO,
  ShiftDTO,
  ShiftListResponse,
  ShiftPaymentDTO,
  ShiftTotalsDTO,
  UnpaidListResponse,
  UnpaidVisitDTO,
} from './types';

/**
 * Kassa biznes-mantigʻi (faqat server):
 *  - toʻlov faqat OCHIQ smena ichida (kassirning oʻziniki; ADMIN — klinikadagi istalgan ochiq smena)
 *  - summa qoldiqdan oshmaydi (OVERPAY → 400), bekor qilingan qabulga toʻlov yoʻq
 *  - har bir toʻlov/qaytarishdan soʻng `recalcVisit` va audit (PAYMENT / REFUND)
 *  - qaytarish — manfiy Payment qatori (usul asl toʻlovniki, note da asl chek raqami)
 *  - smena yopilganda usullar boʻyicha jamlar snapshot sifatida saqlanadi (SHIFT_CLOSE audit)
 */

export interface CashierActor {
  id: string;
  role: Role;
  fullName: string;
}

export interface CashierCtx {
  clinicId: string;
  actor: CashierActor;
  locale: Locale;
  ip?: string | null;
  userAgent?: string | null;
}

type Db = Tx | typeof prisma;

const isAdmin = (role: Role): boolean => role === 'ADMIN' || role === 'SUPER_ADMIN';

const shiftInclude = {
  cashier: { select: { id: true, fullName: true, role: true } },
} satisfies Prisma.CashShiftInclude;
type ShiftRecord = Prisma.CashShiftGetPayload<{ include: typeof shiftInclude }>;

const paymentCashierSelect = { id: true, fullName: true } satisfies Prisma.UserSelect;

const paymentListInclude = {
  cashier: { select: paymentCashierSelect },
  visit: {
    select: {
      id: true,
      status: true,
      totalNet: true,
      paidAmount: true,
      createdAt: true,
      patient: { select: { id: true, fullName: true, cardNumber: true, phone: true } },
      doctor: { select: { id: true, fullName: true } },
    },
  },
} satisfies Prisma.PaymentInclude;

function auditBase(ctx: CashierCtx) {
  return {
    clinicId: ctx.clinicId,
    userId: ctx.actor.id,
    ip: ctx.ip ?? null,
    userAgent: ctx.userAgent ?? null,
  };
}

function num(v: Prisma.Decimal | Decimal | number | string | null | undefined): number {
  return v === null || v === undefined ? 0 : toMoneyNumber(v.toString());
}

function dec(v: Prisma.Decimal | number | string | null | undefined): Decimal {
  return D(v === null || v === undefined ? 0 : v.toString());
}

export function totalsToDTO(r: VisitTotalsResult): VisitTotalsDTO {
  return {
    totalGross: r.totalGross.toNumber(),
    discount: r.discount.toNumber(),
    totalNet: r.totalNet.toNumber(),
    paidAmount: r.paidAmount.toNumber(),
    balance: r.balance.toNumber(),
  };
}

// ───────────────────────────── Jamlar ─────────────────────────────

interface AmountRow {
  method: PayMethod;
  amount: Prisma.Decimal | number | string;
}

/** Usullar boʻyicha sof jamlar (toʻlovlar − qaytarishlar), toʻlov/qaytarish soni */
export function summarizeRows(rows: AmountRow[]): PaymentListSummary {
  const byMethod: MethodTotals = emptyMethodTotals();
  let paymentsCount = 0;
  let refundsCount = 0;
  let refundsTotal = new Decimal(0);
  const sums: Record<PayMethod, Decimal> = {
    CASH: new Decimal(0),
    CARD: new Decimal(0),
    TRANSFER: new Decimal(0),
    CLICK: new Decimal(0),
    PAYME: new Decimal(0),
  };
  for (const r of rows) {
    const a = dec(r.amount);
    sums[r.method] = sums[r.method].plus(a);
    if (a.isNegative()) {
      refundsCount += 1;
      refundsTotal = refundsTotal.plus(a.abs());
    } else {
      paymentsCount += 1;
    }
  }
  let total = new Decimal(0);
  for (const m of Object.keys(sums) as PayMethod[]) {
    byMethod[m] = sums[m].toNumber();
    total = total.plus(sums[m]);
  }
  return {
    byMethod,
    total: total.toNumber(),
    paymentsCount,
    refundsCount,
    refundsTotal: refundsTotal.toNumber(),
  };
}

export function totalsFromRows(
  rows: AmountRow[],
  openingCash: Prisma.Decimal | number | string,
): ShiftTotalsDTO {
  const s = summarizeRows(rows);
  return { ...s, expectedCash: dec(openingCash).plus(s.byMethod.CASH).toNumber() };
}

async function shiftTotalsMap(db: Db, shifts: ShiftRecord[]): Promise<Map<string, ShiftTotalsDTO>> {
  const map = new Map<string, ShiftTotalsDTO>();
  if (shifts.length === 0) return map;
  const rows = await db.payment.findMany({
    where: { shiftId: { in: shifts.map((s) => s.id) } },
    select: { shiftId: true, method: true, amount: true },
  });
  const grouped = new Map<string, AmountRow[]>();
  for (const r of rows) {
    if (!r.shiftId) continue;
    const list = grouped.get(r.shiftId) ?? [];
    list.push({ method: r.method, amount: r.amount });
    grouped.set(r.shiftId, list);
  }
  for (const s of shifts) map.set(s.id, totalsFromRows(grouped.get(s.id) ?? [], s.openingCash));
  return map;
}

async function shiftLiveTotals(db: Db, shift: ShiftRecord): Promise<ShiftTotalsDTO> {
  const rows = await db.payment.findMany({
    where: { shiftId: shift.id },
    select: { method: true, amount: true },
  });
  return totalsFromRows(rows, shift.openingCash);
}

export function toShiftDTO(shift: ShiftRecord, totals: ShiftTotalsDTO): ShiftDTO {
  const row = serialize(shift) as unknown as Omit<ShiftDTO, 'totals' | 'difference'>;
  const difference =
    shift.closedAt && shift.closingCash !== null
      ? dec(shift.closingCash).minus(totals.expectedCash).toNumber()
      : null;
  return { ...row, totals, difference };
}

// ───────────────────────────── Smena ─────────────────────────────

interface OpenShiftResolution {
  shift: ShiftRecord | null;
  isMine: boolean;
  canOperate: boolean;
}

/** Ochiq smena: avval foydalanuvchiniki, boʻlmasa klinikadagi istalgan ochiq smena (ADMIN unga toʻlov qila oladi) */
export async function resolveOpenShift(
  db: Db,
  clinicId: string,
  actor: Pick<CashierActor, 'id' | 'role'>,
): Promise<OpenShiftResolution> {
  const own = await db.cashShift.findFirst({
    where: { clinicId, cashierId: actor.id, closedAt: null },
    orderBy: { openedAt: 'desc' },
    include: shiftInclude,
  });
  if (own) return { shift: own, isMine: true, canOperate: true };
  const anyOpen = await db.cashShift.findFirst({
    where: { clinicId, closedAt: null },
    orderBy: { openedAt: 'desc' },
    include: shiftInclude,
  });
  if (anyOpen) return { shift: anyOpen, isMine: false, canOperate: isAdmin(actor.role) };
  return { shift: null, isMine: false, canOperate: false };
}

export async function getCurrentShift(ctx: CashierCtx): Promise<CurrentShiftResponse> {
  const r = await resolveOpenShift(prisma, ctx.clinicId, ctx.actor);
  if (!r.shift) return { shift: null, isMine: false, canOperate: false };
  const totals = await shiftLiveTotals(prisma, r.shift);
  return { shift: toShiftDTO(r.shift, totals), isMine: r.isMine, canOperate: r.canOperate };
}

export async function openShift(ctx: CashierCtx, input: OpenShiftInput): Promise<ShiftDTO> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`shift:${ctx.clinicId}:${ctx.actor.id}`}))`;
    const existing = await tx.cashShift.findFirst({
      where: { clinicId: ctx.clinicId, cashierId: ctx.actor.id, closedAt: null },
      select: { id: true },
    });
    if (existing)
      throw new ApiError(409, 'CONFLICT', 'Sizda allaqachon ochiq smena bor', {
        code: 'SHIFT_ALREADY_OPEN',
        shiftId: existing.id,
      });

    const shift = await tx.cashShift.create({
      data: { clinicId: ctx.clinicId, cashierId: ctx.actor.id, openingCash: dbMoney(input.openingCash) },
      include: shiftInclude,
    });
    await audit(
      {
        ...auditBase(ctx),
        action: 'SHIFT_OPEN',
        entity: 'CashShift',
        entityId: shift.id,
        after: { openingCash: input.openingCash, openedAt: shift.openedAt, cashierId: ctx.actor.id },
      },
      tx,
    );
    return toShiftDTO(shift, totalsFromRows([], shift.openingCash));
  });
}

export async function closeShift(
  ctx: CashierCtx,
  shiftId: string,
  input: CloseShiftInput,
): Promise<CloseShiftResultDTO> {
  return prisma.$transaction(async (tx) => {
    const shift = await tx.cashShift.findFirst({
      where: { id: shiftId, clinicId: ctx.clinicId },
      include: shiftInclude,
    });
    if (!shift) throw ApiError.notFound('Smena topilmadi');
    if (shift.closedAt) throw new ApiError(409, 'SHIFT_CLOSED', 'Smena allaqachon yopilgan');
    if (shift.cashierId !== ctx.actor.id && !isAdmin(ctx.actor.role)) {
      throw ApiError.forbidden('Smenani faqat uning egasi yoki administrator yopa oladi');
    }

    const totals = await shiftLiveTotals(tx, shift);
    const closingCash = D(input.closingCash);
    const difference = closingCash.minus(totals.expectedCash);
    const closedAt = new Date();

    const updated = await tx.cashShift.update({
      where: { id: shift.id },
      data: {
        closedAt,
        closingCash: dbMoney(closingCash),
        totalCash: dbMoney(totals.byMethod.CASH),
        totalCard: dbMoney(totals.byMethod.CARD),
        totalTransfer: dbMoney(totals.byMethod.TRANSFER),
        totalClick: dbMoney(totals.byMethod.CLICK),
        totalPayme: dbMoney(totals.byMethod.PAYME),
        note: input.note ?? null,
      },
      include: shiftInclude,
    });

    await audit(
      {
        ...auditBase(ctx),
        action: 'SHIFT_CLOSE',
        entity: 'CashShift',
        entityId: shift.id,
        before: { openingCash: num(shift.openingCash), openedAt: shift.openedAt },
        after: {
          closedAt,
          closingCash: closingCash.toNumber(),
          expectedCash: totals.expectedCash,
          difference: difference.toNumber(),
          byMethod: totals.byMethod,
          total: totals.total,
          paymentsCount: totals.paymentsCount,
          refundsCount: totals.refundsCount,
          refundsTotal: totals.refundsTotal,
          note: input.note ?? null,
        },
      },
      tx,
    );

    return {
      shift: toShiftDTO(updated, totals),
      expectedCash: totals.expectedCash,
      difference: difference.toNumber(),
    };
  });
}

export async function listShifts(clinicId: string, q: ListShiftsQuery): Promise<ShiftListResponse> {
  const where: Prisma.CashShiftWhereInput = { clinicId };
  const [total, rows] = await Promise.all([
    prisma.cashShift.count({ where }),
    prisma.cashShift.findMany({
      where,
      include: shiftInclude,
      orderBy: [{ openedAt: 'desc' }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);
  const totals = await shiftTotalsMap(prisma, rows);
  return {
    items: rows.map((s) => toShiftDTO(s, totals.get(s.id) ?? totalsFromRows([], s.openingCash))),
    total,
    page: q.page,
    pageSize: q.pageSize,
  };
}

export async function getShift(clinicId: string, shiftId: string): Promise<ShiftDetailDTO | null> {
  const shift = await prisma.cashShift.findFirst({ where: { id: shiftId, clinicId }, include: shiftInclude });
  if (!shift) return null;
  const payments = await prisma.payment.findMany({
    where: { shiftId: shift.id },
    include: {
      cashier: { select: paymentCashierSelect },
      visit: {
        select: {
          id: true,
          status: true,
          patient: { select: { id: true, fullName: true, cardNumber: true } },
        },
      },
    },
    orderBy: { createdAt: 'asc' },
  });
  const totals = totalsFromRows(payments, shift.openingCash);
  return { ...toShiftDTO(shift, totals), payments: serialize(payments) as unknown as ShiftPaymentDTO[] };
}

// ───────────────────────────── Toʻlovlar ─────────────────────────────

function requireOpenShift(r: OpenShiftResolution): ShiftRecord {
  if (!r.shift || !r.canOperate) {
    throw new ApiError(409, 'NO_OPEN_SHIFT', 'Toʻlov qabul qilish uchun avval smena oching', {
      hasOtherOpen: !!r.shift,
      otherCashier: r.shift?.cashier.fullName ?? null,
    });
  }
  return r.shift;
}

async function paidSum(tx: Tx, visitId: string): Promise<Decimal> {
  const agg = await tx.payment.aggregate({ where: { visitId }, _sum: { amount: true } });
  return dec(agg._sum.amount);
}

export async function createPayment(ctx: CashierCtx, input: CreatePaymentInput): Promise<PaymentResultDTO> {
  return prisma.$transaction(async (tx) => {
    const visit = await tx.visit.findFirst({
      where: { id: input.visitId, clinicId: ctx.clinicId },
      select: { id: true, status: true, totalNet: true, paidAmount: true },
    });
    if (!visit) throw ApiError.notFound('Qabul topilmadi');
    if (visit.status === 'CANCELLED') {
      throw new ApiError(409, 'VISIT_CLOSED', 'Bekor qilingan qabul uchun toʻlov qabul qilinmaydi', {
        reason: 'CANCELLED',
      });
    }

    const shift = requireOpenShift(await resolveOpenShift(tx, ctx.clinicId, ctx.actor));

    const paid = await paidSum(tx, visit.id);
    const balance = dec(visit.totalNet).minus(paid);
    const amount = D(input.amount);
    if (balance.lte(0)) {
      throw ApiError.validation(
        { code: 'NOTHING_TO_PAY', balance: balance.toNumber(), amount: input.amount },
        'Bu qabul boʻyicha qarz yoʻq',
      );
    }
    if (amount.gt(balance)) {
      throw ApiError.validation(
        { code: 'OVERPAY', balance: balance.toNumber(), amount: input.amount },
        'Summa qoldiqdan katta',
      );
    }

    const receiptNo = await nextReceiptNo(tx, ctx.clinicId);
    const payment = await tx.payment.create({
      data: {
        clinicId: ctx.clinicId,
        visitId: visit.id,
        shiftId: shift.id,
        amount: dbMoney(amount),
        method: input.method,
        cashierId: ctx.actor.id,
        receiptNo,
        note: input.note ?? null,
      },
      include: { cashier: { select: paymentCashierSelect } },
    });

    const totals = await recalcVisit(tx, visit.id);

    await audit(
      {
        ...auditBase(ctx),
        action: 'PAYMENT',
        entity: 'Payment',
        entityId: payment.id,
        after: {
          visitId: visit.id,
          amount: amount.toNumber(),
          method: input.method,
          receiptNo,
          shiftId: shift.id,
          note: input.note ?? null,
          balanceBefore: balance.toNumber(),
          balanceAfter: totals.balance.toNumber(),
        },
      },
      tx,
    );

    const full = await tx.visit.findUniqueOrThrow({ where: { id: visit.id }, include: receiptVisitInclude });
    const receipt = receiptDataFor(full, ctx.locale, ctx.actor.fullName, {
      receiptNo,
      dateTime: payment.createdAt,
      paymentAmount: amount.toNumber(),
      method: input.method,
    });

    return {
      payment: serialize(payment) as unknown as PaymentResultDTO['payment'],
      totals: totalsToDTO(totals),
      receipt,
      visit: { id: full.id, status: full.status },
    };
  });
}

export async function refundPayment(
  ctx: CashierCtx,
  paymentId: string,
  input: RefundBody,
): Promise<RefundResultDTO> {
  return prisma.$transaction(async (tx) => {
    const original = await tx.payment.findFirst({
      where: { id: paymentId, clinicId: ctx.clinicId },
      include: { visit: { select: { id: true, status: true } } },
    });
    if (!original) throw ApiError.notFound('Toʻlov topilmadi');
    if (dec(original.amount).lte(0)) {
      throw ApiError.validation(
        { code: 'REFUND_EXCEEDS', max: 0, amount: input.amount },
        'Qaytarish yozuvini qaytarib boʻlmaydi',
      );
    }

    const shift = requireOpenShift(await resolveOpenShift(tx, ctx.clinicId, ctx.actor));

    const paid = await paidSum(tx, original.visitId);
    const amount = D(input.amount);
    const maxRefund = Decimal.min(dec(original.amount), paid);
    if (maxRefund.lte(0) || amount.gt(maxRefund)) {
      throw ApiError.validation(
        { code: 'REFUND_EXCEEDS', max: Decimal.max(maxRefund, 0).toNumber(), amount: input.amount },
        'Qaytarish summasi toʻlovdan katta',
      );
    }

    const receiptNo = await nextReceiptNo(tx, ctx.clinicId);
    const refund = await tx.payment.create({
      data: {
        clinicId: ctx.clinicId,
        visitId: original.visitId,
        shiftId: shift.id,
        amount: dbMoney(amount.neg()),
        method: original.method,
        cashierId: ctx.actor.id,
        receiptNo,
        note: `#${original.receiptNo ?? original.id} ${input.note}`.trim(),
      },
      include: { cashier: { select: paymentCashierSelect } },
    });

    const totals = await recalcVisit(tx, original.visitId);

    await audit(
      {
        ...auditBase(ctx),
        action: 'REFUND',
        entity: 'Payment',
        entityId: refund.id,
        before: {
          paymentId: original.id,
          receiptNo: original.receiptNo,
          amount: num(original.amount),
          method: original.method,
        },
        after: {
          visitId: original.visitId,
          amount: amount.neg().toNumber(),
          receiptNo,
          shiftId: shift.id,
          note: input.note,
          balanceAfter: totals.balance.toNumber(),
        },
      },
      tx,
    );

    const full = await tx.visit.findUniqueOrThrow({
      where: { id: original.visitId },
      include: receiptVisitInclude,
    });
    const receipt = receiptDataFor(full, ctx.locale, ctx.actor.fullName, {
      receiptNo,
      dateTime: refund.createdAt,
      paymentAmount: amount.neg().toNumber(),
      method: original.method,
    });

    return {
      refund: serialize(refund) as unknown as RefundResultDTO['refund'],
      totals: totalsToDTO(totals),
      receipt,
      original: { id: original.id, receiptNo: original.receiptNo, amount: num(original.amount) },
    };
  });
}

export async function listPayments(clinicId: string, q: ListPaymentsQuery): Promise<PaymentListResponse> {
  const where: Prisma.PaymentWhereInput = { clinicId };
  if (q.date) {
    const { start, end } = dayRangeTz(q.date);
    where.createdAt = { gte: start, lte: end };
  }
  if (q.visitId) where.visitId = q.visitId;
  if (q.method) where.method = q.method;
  if (q.refunds === '1') where.amount = { lt: 0 };

  const [total, rows, sumRows] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      include: paymentListInclude,
      orderBy: [{ createdAt: 'desc' }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
    prisma.payment.findMany({ where, select: { method: true, amount: true } }),
  ]);

  return {
    items: serialize(rows) as unknown as PaymentListItemDTO[],
    total,
    page: q.page,
    pageSize: q.pageSize,
    summary: summarizeRows(sumRows),
  };
}

export async function getPaymentReceipt(ctx: CashierCtx, paymentId: string): Promise<ReceiptViewData | null> {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, clinicId: ctx.clinicId },
    include: { cashier: { select: paymentCashierSelect }, visit: { include: receiptVisitInclude } },
  });
  if (!payment) return null;
  return receiptDataFor(payment.visit, ctx.locale, payment.cashier.fullName, {
    receiptNo: payment.receiptNo,
    dateTime: payment.createdAt,
    paymentAmount: num(payment.amount),
    method: payment.method,
  });
}

/** Chop etish sahifasi uchun: qabul (chek relatsiyalari bilan), klinika boʻyicha */
export async function loadReceiptVisit(clinicId: string, visitId: string): Promise<ReceiptVisit | null> {
  return prisma.visit.findFirst({ where: { id: visitId, clinicId }, include: receiptVisitInclude });
}

/** Butun qabul boʻyicha chek (oxirgi toʻlov raqami/kassiri bilan) */
export function visitReceipt(visit: ReceiptVisit, locale: Locale): ReceiptViewData {
  const last = visit.payments.length > 0 ? visit.payments[visit.payments.length - 1] : undefined;
  return receiptDataFor(visit, locale, last?.cashier.fullName ?? '—', {
    receiptNo: last?.receiptNo ?? null,
    dateTime: last?.createdAt ?? new Date(),
    paymentAmount: last ? num(last.amount) : undefined,
    method: last?.method,
  });
}

// ───────────────────────────── Toʻlanmagan qabullar ─────────────────────────────

function unpaidSearch(q: string | undefined): Prisma.VisitWhereInput {
  const s = q?.trim();
  if (!s) return {};
  const digits = s.replace(/\D/g, '');
  const or: Prisma.PatientWhereInput[] = [
    { fullName: { contains: s, mode: 'insensitive' } },
    { cardNumber: { contains: s, mode: 'insensitive' } },
  ];
  if (digits.length >= 4) or.push({ phone: { contains: digits } });
  return { patient: { OR: or } };
}

export async function listUnpaid(clinicId: string, q: UnpaidQuery): Promise<UnpaidListResponse> {
  const where: Prisma.VisitWhereInput = {
    clinicId,
    status: { not: 'CANCELLED' },
    totalNet: { gt: prisma.visit.fields.paidAmount },
    ...unpaidSearch(q.q),
  };
  if (q.scope === 'today') {
    const { start, end } = todayRange();
    where.createdAt = { gte: start, lte: end };
  }

  const [total, rows] = await Promise.all([
    prisma.visit.count({ where }),
    prisma.visit.findMany({
      where,
      select: {
        id: true,
        status: true,
        createdAt: true,
        completedAt: true,
        totalGross: true,
        discount: true,
        totalNet: true,
        paidAmount: true,
        patient: { select: { id: true, fullName: true, cardNumber: true, phone: true, gender: true } },
        doctor: { select: { id: true, fullName: true, color: true, room: true } },
        _count: { select: { lines: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: q.limit,
    }),
  ]);

  const items: UnpaidVisitDTO[] = rows.map((v) => {
    const totalNet = num(v.totalNet);
    const paidAmount = num(v.paidAmount);
    return {
      id: v.id,
      status: v.status,
      createdAt: v.createdAt.toISOString(),
      completedAt: v.completedAt ? v.completedAt.toISOString() : null,
      totalGross: num(v.totalGross),
      discount: num(v.discount),
      totalNet,
      paidAmount,
      balance: totalNet - paidAmount,
      linesCount: v._count.lines,
      patient: v.patient,
      doctor: v.doctor,
    };
  });

  return { items, total, scope: q.scope };
}

/** Toʻlov oynasi uchun qabul xulosasi (qatorlar, toʻlovlar, jamlar) */
export async function getCashierVisit(clinicId: string, visitId: string): Promise<CashierVisitDTO | null> {
  const v = await prisma.visit.findFirst({
    where: { id: visitId, clinicId },
    select: {
      id: true,
      status: true,
      createdAt: true,
      completedAt: true,
      globalDiscountType: true,
      globalDiscountValue: true,
      totalGross: true,
      discount: true,
      totalNet: true,
      paidAmount: true,
      patient: {
        select: { id: true, fullName: true, cardNumber: true, phone: true, birthDate: true, gender: true },
      },
      doctor: { select: { id: true, fullName: true, specialty: true, room: true, color: true } },
      lines: {
        select: {
          id: true,
          serviceName: true,
          serviceNameRu: true,
          unit: true,
          quantity: true,
          unitPrice: true,
          grossTotal: true,
          discountTotal: true,
          lineTotal: true,
          side: true,
          organ: true,
          detail: true,
          patientType: true,
          withMedicine: true,
          order: true,
        },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      },
      payments: { include: { cashier: { select: paymentCashierSelect } }, orderBy: { createdAt: 'asc' } },
    },
  });
  if (!v) return null;
  const totalNet = toMoneyNumber(v.totalNet.toString());
  const paidAmount = toMoneyNumber(v.paidAmount.toString());
  const s = serialize(v) as unknown as Omit<CashierVisitDTO, 'totals'> & {
    totalGross: number;
    discount: number;
    totalNet: number;
    paidAmount: number;
  };
  return {
    id: s.id,
    status: s.status,
    createdAt: s.createdAt,
    completedAt: s.completedAt,
    globalDiscountType: s.globalDiscountType,
    globalDiscountValue: s.globalDiscountValue,
    patient: s.patient,
    doctor: s.doctor,
    lines: s.lines,
    payments: s.payments,
    totals: {
      totalGross: s.totalGross,
      discount: s.discount,
      totalNet,
      paidAmount,
      balance: totalNet - paidAmount,
    },
  };
}
