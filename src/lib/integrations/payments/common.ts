import type { PayMethod, Prisma } from '@prisma/client';
import { prisma, type Tx } from '@/lib/prisma';
import { audit } from '@/lib/api/audit';
import { D } from '@/lib/money';
import { recalcVisit, dbMoney } from '@/lib/visits/recalc';

/**
 * Onlayn toʻlovlar uchun umumiy server yordamchilari (FAQAT SERVER — prisma).
 * Webhook global (klinikasiz) keladi: qabul (visitId) orqali klinika aniqlanadi.
 */

export interface PayableVisit {
  id: string;
  clinicId: string;
  status: 'OPEN' | 'COMPLETED' | 'CANCELLED';
  totalNet: number;
  paidAmount: number;
  /** totalNet − paidAmount (musbat = qarz) */
  balance: number;
  patientName: string;
}

export async function findPayableVisit(visitId: string, db: Tx | typeof prisma = prisma): Promise<PayableVisit | null> {
  if (!visitId || visitId.length > 64) return null;
  const v = await db.visit.findFirst({
    where: { id: visitId },
    select: { id: true, clinicId: true, status: true, totalNet: true, paidAmount: true, patient: { select: { fullName: true } } },
  });
  if (!v) return null;
  const totalNet = D(v.totalNet.toString());
  const paid = D(v.paidAmount.toString());
  return {
    id: v.id,
    clinicId: v.clinicId,
    status: v.status,
    totalNet: totalNet.toNumber(),
    paidAmount: paid.toNumber(),
    balance: totalNet.minus(paid).toNumber(),
    patientName: v.patient.fullName,
  };
}

/** Onlayn toʻlov "kassiri": klinikaning birinchi faol ADMIN i (boʻlmasa har qanday faol xodim) */
export async function findOnlineCashierId(clinicId: string, db: Tx | typeof prisma = prisma): Promise<string | null> {
  const admin = await db.user.findFirst({
    where: { clinicId, role: 'ADMIN', isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (admin) return admin.id;
  const any = await db.user.findFirst({ where: { clinicId, isActive: true }, orderBy: { createdAt: 'asc' }, select: { id: true } });
  return any?.id ?? null;
}

export interface OnlinePaymentInput {
  visitId: string;
  clinicId: string;
  /** Butun soʻm; manfiy = qaytarish */
  amount: number;
  method: Extract<PayMethod, 'CLICK' | 'PAYME'>;
  note: string;
  /** Provayder tranzaksiya identifikatori (audit uchun) */
  providerTransactionId: string;
  ip?: string | null;
}

export interface OnlinePaymentResult {
  paymentId: string;
  totalNet: number;
  paidAmount: number;
  balance: number;
}

/** Payment yaratish + recalcVisit + audit (bitta tranzaksiyada) */
export async function createOnlinePayment(input: OnlinePaymentInput): Promise<OnlinePaymentResult> {
  return prisma.$transaction(async (tx) => {
    const cashierId = await findOnlineCashierId(input.clinicId, tx);
    if (!cashierId) throw new Error('No active user in clinic to own the payment');
    const payment = await tx.payment.create({
      data: {
        clinicId: input.clinicId,
        visitId: input.visitId,
        amount: dbMoney(input.amount),
        method: input.method,
        cashierId,
        note: input.note,
      },
      select: { id: true },
    });
    const totals = await recalcVisit(tx, input.visitId);
    const after: Prisma.InputJsonValue = {
      paymentId: payment.id,
      visitId: input.visitId,
      amount: input.amount,
      method: input.method,
      provider: input.method.toLowerCase(),
      providerTransactionId: input.providerTransactionId,
      totalNet: totals.totalNet.toNumber(),
      paidAmount: totals.paidAmount.toNumber(),
      balance: totals.balance.toNumber(),
    };
    await audit(
      {
        clinicId: input.clinicId,
        userId: null,
        action: input.amount < 0 ? 'REFUND' : 'PAYMENT',
        entity: 'Payment',
        entityId: payment.id,
        after,
        ip: input.ip ?? null,
        userAgent: `webhook:${input.method.toLowerCase()}`,
      },
      tx,
    );
    return {
      paymentId: payment.id,
      totalNet: totals.totalNet.toNumber(),
      paidAmount: totals.paidAmount.toNumber(),
      balance: totals.balance.toNumber(),
    };
  });
}

/** Provayder tranzaksiya holatini AuditLog da saqlash (append-only; oxirgi yozuv = joriy holat) */
export async function loadProviderState<T>(entity: string, entityId: string): Promise<T | null> {
  const row = await prisma.auditLog.findFirst({
    where: { entity, entityId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { after: true },
  });
  if (!row || row.after === null || typeof row.after !== 'object') return null;
  return row.after as T;
}

export async function saveProviderState(params: {
  entity: string;
  entityId: string;
  clinicId: string | null;
  before: unknown;
  after: unknown;
  action: 'CREATE' | 'UPDATE' | 'PAYMENT' | 'REFUND';
  ip?: string | null;
  userAgent?: string | null;
}): Promise<void> {
  await audit({
    clinicId: params.clinicId,
    userId: null,
    action: params.action,
    entity: params.entity,
    entityId: params.entityId,
    before: params.before ?? undefined,
    after: params.after,
    ip: params.ip ?? null,
    userAgent: params.userAgent ?? null,
  });
}

/** Berilgan entity uchun barcha oxirgi holatlar (GetStatement uchun) */
export async function loadProviderStates<T>(entity: string, opts: { clinicId?: string; createdFrom?: Date; createdTo?: Date } = {}): Promise<T[]> {
  const rows = await prisma.auditLog.findMany({
    where: {
      entity,
      ...(opts.clinicId ? { clinicId: opts.clinicId } : {}),
      ...(opts.createdFrom || opts.createdTo
        ? { createdAt: { ...(opts.createdFrom ? { gte: opts.createdFrom } : {}), ...(opts.createdTo ? { lte: opts.createdTo } : {}) } }
        : {}),
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: { entityId: true, after: true },
  });
  const latest = new Map<string, T>();
  for (const r of rows) {
    if (!r.entityId || r.after === null || typeof r.after !== 'object') continue;
    latest.set(r.entityId, r.after as T);
  }
  return Array.from(latest.values());
}
