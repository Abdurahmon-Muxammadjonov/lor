import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// DATABASE_URL berilmagan boʻlsa — lokal .env dan olishga urinamiz (faqat DB kalitlari)
if (!process.env.DATABASE_URL) {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = /^\s*(DATABASE_URL|DIRECT_URL)\s*=\s*"?([^"]*)"?\s*$/.exec(line);
      if (m && m[1] && m[2] && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

import { getServerSession } from 'next-auth';
import type { Role } from '@prisma/client';
import { mockSession } from '../helpers/session';
import { makeRequest, readData, readError } from '../helpers/request';
import { GET as paymentsGET, POST as paymentsPOST } from '@/app/api/payments/route';
import { POST as refundPOST } from '@/app/api/payments/[id]/refund/route';
import { GET as receiptGET } from '@/app/api/payments/[id]/receipt/route';
import { GET as unpaidGET } from '@/app/api/payments/unpaid/route';
import { GET as cashierVisitGET } from '@/app/api/payments/visit/[visitId]/route';
import { GET as currentShiftGET } from '@/app/api/shifts/current/route';
import { POST as openShiftPOST } from '@/app/api/shifts/open/route';
import { POST as closeShiftPOST } from '@/app/api/shifts/[id]/close/route';
import { GET as shiftsGET } from '@/app/api/shifts/route';
import { GET as shiftGET } from '@/app/api/shifts/[id]/route';
import type {
  CashierVisitDTO,
  CloseShiftResultDTO,
  CurrentShiftResponse,
  PaymentListResponse,
  PaymentResultDTO,
  ReceiptViewData,
  RefundResultDTO,
  ShiftDetailDTO,
  ShiftDTO,
  ShiftListResponse,
  UnpaidListResponse,
} from '@/lib/cashier/types';

const HAS_DB = !!process.env.DATABASE_URL;
const dbDescribe = HAS_DB ? describe : describe.skip;

const MARKER = 'ZZTEST-CASHIER';
const TEST_LOGIN = 'zztest_cashier';

interface TestUser {
  id: string;
  login: string;
  role: Role;
  fullName: string;
  clinicId: string;
}

type PrismaModule = typeof import('@/lib/prisma');
let db: PrismaModule['prisma'];
type RecalcModule = typeof import('@/lib/visits/recalc');
let recalc: RecalcModule;

const clinics = { demo: { id: '', slug: 'demo' }, lorPlus: { id: '', slug: 'lor-plus' } };
const users: Record<string, TestUser> = {};
let testCashier: TestUser;
let visitId = '';
let otherClinicVisitId = '';
let visitTotal = 0;
let shiftId = '';
let firstPaymentId = '';

function actAs(u: TestUser) {
  vi.mocked(getServerSession).mockResolvedValue(
    mockSession({
      id: u.id,
      login: u.login,
      role: u.role,
      fullName: u.fullName,
      clinicId: u.clinicId,
      clinicName: u.clinicId === clinics.demo.id ? 'Shifo LOR' : 'LOR Plus',
      clinicSlug: u.clinicId === clinics.demo.id ? 'demo' : 'lor-plus',
    }),
  );
}

const ctx = (id: string) => ({ params: { id } });

async function createTestVisit(
  clinicId: string,
  doctorId: string,
  cardNumber: string,
  quantity: number,
): Promise<{ id: string; totalNet: number }> {
  const patient = await db.patient.create({
    data: {
      clinicId,
      cardNumber,
      fullName: `${MARKER} Bemor ${cardNumber}`,
      birthDate: new Date('1990-01-01T00:00:00.000Z'),
      gender: 'MALE',
      phone: `+9989970${cardNumber.slice(-5)}`,
    },
  });
  const service = await db.service.findFirst({
    where: { clinicId, isActive: true, allowHalf: true },
    orderBy: { priceAdultMed: 'desc' },
  });
  expect(service, 'faol xizmat').toBeTruthy();
  if (!service) throw new Error('service');
  const snapshot = recalc.computeLineSnapshot(service, {
    patientType: 'ADULT',
    withMedicine: true,
    quantity,
    discountType: 'NONE',
    discountValue: 0,
  });
  const visit = await db.visit.create({
    data: {
      clinicId,
      patientId: patient.id,
      doctorId,
      status: 'OPEN',
      lines: { create: { serviceId: service.id, ...snapshot, order: 0 } },
    },
  });
  const totals = await db.$transaction((tx) => recalc.recalcVisit(tx, visit.id));
  return { id: visit.id, totalNet: totals.totalNet.toNumber() };
}

async function cleanup() {
  const user = await db.user.findUnique({ where: { login: TEST_LOGIN }, select: { id: true } });
  const patients = await db.patient.findMany({
    where: { fullName: { contains: MARKER } },
    select: { id: true },
  });
  const patientIds = patients.map((p) => p.id);
  const visits = await db.visit.findMany({ where: { patientId: { in: patientIds } }, select: { id: true } });
  const visitIds = visits.map((v) => v.id);
  const payments = await db.payment.findMany({ where: { visitId: { in: visitIds } }, select: { id: true } });
  const paymentIds = payments.map((p) => p.id);
  const shifts = user
    ? await db.cashShift.findMany({ where: { cashierId: user.id }, select: { id: true } })
    : [];
  const shiftIds = shifts.map((s) => s.id);

  await db.auditLog.deleteMany({
    where: {
      OR: [
        ...(user ? [{ userId: user.id }] : []),
        { entity: 'Payment', entityId: { in: paymentIds } },
        { entity: 'CashShift', entityId: { in: shiftIds } },
      ],
    },
  });
  await db.payment.deleteMany({
    where: { OR: [{ visitId: { in: visitIds } }, { shiftId: { in: shiftIds } }] },
  });
  if (user) await db.cashShift.deleteMany({ where: { cashierId: user.id } });
  await db.visit.deleteMany({ where: { id: { in: visitIds } } });
  await db.patient.deleteMany({ where: { id: { in: patientIds } } });
  if (user) await db.user.delete({ where: { id: user.id } });
}

dbDescribe('cashier API (DB)', () => {
  beforeAll(async () => {
    db = (await import('@/lib/prisma')).prisma;
    recalc = await import('@/lib/visits/recalc');
    const rows = await db.clinic.findMany({
      where: { slug: { in: ['demo', 'lor-plus'] } },
      select: { id: true, slug: true },
    });
    for (const c of rows) {
      if (c.slug === 'demo') clinics.demo = c;
      if (c.slug === 'lor-plus') clinics.lorPlus = c;
    }
    expect(clinics.demo.id).toBeTruthy();
    expect(clinics.lorPlus.id).toBeTruthy();
    const us = await db.user.findMany({
      where: { login: { in: ['admin', 'doctor', 'cashier', 'doctor4'] } },
      select: { id: true, login: true, role: true, fullName: true, clinicId: true },
    });
    for (const u of us) users[u.login] = u;
    for (const l of ['admin', 'doctor', 'cashier', 'doctor4'])
      expect(users[l], `seed user ${l}`).toBeTruthy();

    await cleanup();

    testCashier = await db.user.create({
      data: {
        clinicId: clinics.demo.id,
        login: TEST_LOGIN,
        password: 'x',
        fullName: `${MARKER} Kassir`,
        role: 'CASHIER',
      },
      select: { id: true, login: true, role: true, fullName: true, clinicId: true },
    });

    const v = await createTestVisit(clinics.demo.id, users.doctor!.id, `${MARKER}-00001`, 2);
    visitId = v.id;
    visitTotal = v.totalNet;
    expect(visitTotal).toBeGreaterThan(100_000);

    const other = await createTestVisit(clinics.lorPlus.id, users.doctor4!.id, `${MARKER}-00002`, 1);
    otherClinicVisitId = other.id;
  });

  afterAll(async () => {
    if (!db) return;
    await cleanup();
    await db.$disconnect();
  });

  it('POST /api/payments smenasiz → 409 NO_OPEN_SHIFT', async () => {
    actAs(testCashier);
    const res = await paymentsPOST(
      makeRequest('POST', '/api/payments', { visitId, amount: 100_000, method: 'CASH' }),
    );
    const err = await readError(res);
    expect(err.status).toBe(409);
    expect(err.code).toBe('NO_OPEN_SHIFT');
  });

  it('DOCTOR → 403 (payments.write yoʻq)', async () => {
    actAs(users.doctor!);
    const res = await paymentsPOST(
      makeRequest('POST', '/api/payments', { visitId, amount: 100_000, method: 'CASH' }),
    );
    expect((await readError(res)).status).toBe(403);
  });

  it('GET /api/shifts/current — kassirning oʻz smenasi yoʻq', async () => {
    actAs(testCashier);
    const data = await readData<CurrentShiftResponse>(
      await currentShiftGET(makeRequest('GET', '/api/shifts/current')),
    );
    expect(data.isMine).toBe(false);
    expect(data.canOperate).toBe(false);
    if (data.shift) expect(data.shift.cashierId).not.toBe(testCashier.id);
  });

  it('POST /api/shifts/open → smena; ikkinchi marta → 409', async () => {
    actAs(testCashier);
    const res = await openShiftPOST(makeRequest('POST', '/api/shifts/open', { openingCash: 50_000 }));
    expect(res.status).toBe(201);
    const shift = await readData<ShiftDTO>(res);
    shiftId = shift.id;
    expect(shift.cashierId).toBe(testCashier.id);
    expect(shift.openingCash).toBe(50_000);
    expect(shift.closedAt).toBeNull();
    expect(shift.totals.expectedCash).toBe(50_000);

    const again = await openShiftPOST(makeRequest('POST', '/api/shifts/open', { openingCash: 0 }));
    const err = await readError(again);
    expect(err.status).toBe(409);
    expect((err.details as { code?: string }).code).toBe('SHIFT_ALREADY_OPEN');

    const cur = await readData<CurrentShiftResponse>(
      await currentShiftGET(makeRequest('GET', '/api/shifts/current')),
    );
    expect(cur.shift?.id).toBe(shiftId);
    expect(cur.isMine).toBe(true);
    expect(cur.canOperate).toBe(true);
  });

  it('toʻlanmagan roʻyxatda test qabul bor (scope=all&q=marker)', async () => {
    actAs(testCashier);
    const data = await readData<UnpaidListResponse>(
      await unpaidGET(makeRequest('GET', `/api/payments/unpaid?scope=all&q=${encodeURIComponent(MARKER)}`)),
    );
    const row = data.items.find((v) => v.id === visitId);
    expect(row).toBeTruthy();
    expect(row?.balance).toBe(visitTotal);
    expect(row?.paidAmount).toBe(0);
    expect(row?.linesCount).toBe(1);
    // boshqa klinika qabuli koʻrinmaydi
    expect(data.items.find((v) => v.id === otherClinicVisitId)).toBeUndefined();
  });

  it('POST /api/payments 100 000 naqd → paidAmount 100 000, qoldiq kamayadi, chek raqami', async () => {
    actAs(testCashier);
    const res = await paymentsPOST(
      makeRequest('POST', '/api/payments', { visitId, amount: 100_000, method: 'CASH', note: 'Avans' }),
    );
    expect(res.status).toBe(201);
    const data = await readData<PaymentResultDTO>(res);
    firstPaymentId = data.payment.id;
    expect(data.payment.amount).toBe(100_000);
    expect(data.payment.method).toBe('CASH');
    expect(data.payment.shiftId).toBe(shiftId);
    expect(data.payment.cashierId).toBe(testCashier.id);
    expect(data.payment.receiptNo).toMatch(/^\d{8}-\d{4}$/);
    expect(data.totals.paidAmount).toBe(100_000);
    expect(data.totals.balance).toBe(visitTotal - 100_000);
    expect(data.receipt.receiptNo).toBe(data.payment.receiptNo);
    expect(data.receipt.lines).toHaveLength(1);
    expect(data.receipt.total).toBe(visitTotal);
    expect(data.receipt.paid).toBe(100_000);
    expect(data.receipt.balance).toBe(visitTotal - 100_000);
    expect(data.receipt.paymentAmount).toBe(100_000);
    expect(data.receipt.qrText).toContain(`/dashboard/visits/${visitId}`);
    expect(data.receipt.cashier).toBe(testCashier.fullName);

    const row = await db.visit.findUniqueOrThrow({ where: { id: visitId } });
    expect(Number(row.paidAmount.toString())).toBe(100_000);

    const audit = await db.auditLog.findFirst({
      where: { entity: 'Payment', entityId: data.payment.id, action: 'PAYMENT' },
    });
    expect(audit).toBeTruthy();
  });

  it('chek raqamlari ketma-ket va unikal (bir kunda)', async () => {
    const p = await db.payment.findUniqueOrThrow({ where: { id: firstPaymentId } });
    const dup = await db.payment.count({ where: { clinicId: clinics.demo.id, receiptNo: p.receiptNo } });
    expect(dup).toBe(1);
  });

  it('ortiqcha toʻlov → 400 OVERPAY', async () => {
    actAs(testCashier);
    const res = await paymentsPOST(
      makeRequest('POST', '/api/payments', { visitId, amount: visitTotal - 100_000 + 1_000, method: 'CARD' }),
    );
    const err = await readError(res);
    expect(err.status).toBe(400);
    expect(err.code).toBe('VALIDATION');
    expect((err.details as { code?: string; balance?: number }).code).toBe('OVERPAY');
    expect((err.details as { balance?: number }).balance).toBe(visitTotal - 100_000);
  });

  it('boshqa klinika qabuli → 404', async () => {
    actAs(testCashier);
    const res = await paymentsPOST(
      makeRequest('POST', '/api/payments', { visitId: otherClinicVisitId, amount: 10_000, method: 'CASH' }),
    );
    expect((await readError(res)).status).toBe(404);
    const vres = await cashierVisitGET(makeRequest('GET', `/api/payments/visit/${otherClinicVisitId}`), {
      params: { visitId: otherClinicVisitId },
    });
    expect((await readError(vres)).status).toBe(404);
  });

  it('GET /api/payments?visitId= va /api/payments/[id]/receipt', async () => {
    actAs(testCashier);
    const list = await readData<PaymentListResponse>(
      await paymentsGET(makeRequest('GET', `/api/payments?visitId=${visitId}`)),
    );
    expect(list.items.map((p) => p.id)).toContain(firstPaymentId);
    const item = list.items.find((p) => p.id === firstPaymentId);
    expect(item?.visit.patient.fullName).toContain(MARKER);
    expect(item?.cashier.id).toBe(testCashier.id);
    expect(list.summary.byMethod.CASH).toBe(100_000);
    expect(list.summary.paymentsCount).toBe(1);

    const receipt = await readData<ReceiptViewData>(
      await receiptGET(makeRequest('GET', `/api/payments/${firstPaymentId}/receipt`), ctx(firstPaymentId)),
    );
    expect(receipt.lines).toHaveLength(1);
    expect(receipt.paid).toBe(100_000);
    expect(receipt.receiptNo).toBe(item?.receiptNo);

    const visit = await readData<CashierVisitDTO>(
      await cashierVisitGET(makeRequest('GET', `/api/payments/visit/${visitId}`), { params: { visitId } }),
    );
    expect(visit.totals.balance).toBe(visitTotal - 100_000);
    expect(visit.payments).toHaveLength(1);
    expect(visit.lines).toHaveLength(1);
  });

  it('qaytarish 40 000 → paidAmount 60 000; ortiqcha qaytarish → 400', async () => {
    actAs(testCashier);
    const res = await refundPOST(
      makeRequest('POST', `/api/payments/${firstPaymentId}/refund`, {
        amount: 40_000,
        note: 'Muolaja bajarilmadi',
      }),
      ctx(firstPaymentId),
    );
    expect(res.status).toBe(201);
    const data = await readData<RefundResultDTO>(res);
    expect(data.refund.amount).toBe(-40_000);
    expect(data.refund.method).toBe('CASH');
    expect(data.refund.note).toContain('Muolaja bajarilmadi');
    expect(data.totals.paidAmount).toBe(60_000);
    expect(data.receipt.paymentAmount).toBe(-40_000);
    expect(data.original.id).toBe(firstPaymentId);

    const row = await db.visit.findUniqueOrThrow({ where: { id: visitId } });
    expect(Number(row.paidAmount.toString())).toBe(60_000);

    const too = await refundPOST(
      makeRequest('POST', `/api/payments/${firstPaymentId}/refund`, { amount: 70_000, note: 'x' }),
      ctx(firstPaymentId),
    );
    const err = await readError(too);
    expect(err.status).toBe(400);
    expect((err.details as { code?: string }).code).toBe('REFUND_EXCEEDS');

    const audit = await db.auditLog.findFirst({
      where: { entity: 'Payment', entityId: data.refund.id, action: 'REFUND' },
    });
    expect(audit).toBeTruthy();
  });

  it('DOCTOR qaytara olmaydi → 403', async () => {
    actAs(users.doctor!);
    const res = await refundPOST(
      makeRequest('POST', `/api/payments/${firstPaymentId}/refund`, { amount: 1_000, note: 'x' }),
      ctx(firstPaymentId),
    );
    expect((await readError(res)).status).toBe(403);
  });

  it('qolgan qarzni karta bilan toʻlash → qabul toʻliq toʻlangan, roʻyxatdan chiqadi', async () => {
    actAs(testCashier);
    const rest = visitTotal - 60_000;
    const res = await paymentsPOST(
      makeRequest('POST', '/api/payments', { visitId, amount: rest, method: 'CARD' }),
    );
    const data = await readData<PaymentResultDTO>(res);
    expect(data.totals.balance).toBe(0);
    expect(data.totals.paidAmount).toBe(visitTotal);

    const unpaid = await readData<UnpaidListResponse>(
      await unpaidGET(makeRequest('GET', `/api/payments/unpaid?scope=all&q=${encodeURIComponent(MARKER)}`)),
    );
    expect(unpaid.items.find((v) => v.id === visitId)).toBeUndefined();

    const nothing = await paymentsPOST(
      makeRequest('POST', '/api/payments', { visitId, amount: 1_000, method: 'CASH' }),
    );
    const err = await readError(nothing);
    expect(err.status).toBe(400);
    expect((err.details as { code?: string }).code).toBe('NOTHING_TO_PAY');
  });

  it('smenani yopish: usullar boʻyicha jamlar, kutilayotgan naqd va farq', async () => {
    actAs(testCashier);
    const cur = await readData<CurrentShiftResponse>(
      await currentShiftGET(makeRequest('GET', '/api/shifts/current')),
    );
    expect(cur.shift?.totals.byMethod.CASH).toBe(60_000);
    expect(cur.shift?.totals.byMethod.CARD).toBe(visitTotal - 60_000);
    expect(cur.shift?.totals.refundsCount).toBe(1);
    expect(cur.shift?.totals.refundsTotal).toBe(40_000);
    expect(cur.shift?.totals.paymentsCount).toBe(2);
    expect(cur.shift?.totals.expectedCash).toBe(110_000);

    // DOCTOR yopa olmaydi (shifts.manage yoʻq)
    actAs(users.doctor!);
    const forbidden = await closeShiftPOST(
      makeRequest('POST', `/api/shifts/${shiftId}/close`, { closingCash: 110_000 }),
      ctx(shiftId),
    );
    expect((await readError(forbidden)).status).toBe(403);

    actAs(testCashier);
    const res = await closeShiftPOST(
      makeRequest('POST', `/api/shifts/${shiftId}/close`, { closingCash: 105_000, note: 'Test yopish' }),
      ctx(shiftId),
    );
    const data = await readData<CloseShiftResultDTO>(res);
    expect(data.expectedCash).toBe(110_000);
    expect(data.difference).toBe(-5_000);
    expect(data.shift.closedAt).toBeTruthy();
    expect(data.shift.closingCash).toBe(105_000);
    expect(data.shift.totalCash).toBe(60_000);
    expect(data.shift.totalCard).toBe(visitTotal - 60_000);
    expect(data.shift.totalTransfer).toBe(0);
    expect(data.shift.difference).toBe(-5_000);
    expect(data.shift.note).toBe('Test yopish');

    const again = await closeShiftPOST(
      makeRequest('POST', `/api/shifts/${shiftId}/close`, { closingCash: 0 }),
      ctx(shiftId),
    );
    expect((await readError(again)).code).toBe('SHIFT_CLOSED');

    const detail = await readData<ShiftDetailDTO>(
      await shiftGET(makeRequest('GET', `/api/shifts/${shiftId}`), ctx(shiftId)),
    );
    expect(detail.payments).toHaveLength(3);
    expect(detail.totals.total).toBe(visitTotal);

    const list = await readData<ShiftListResponse>(
      await shiftsGET(makeRequest('GET', '/api/shifts?page=1&pageSize=50')),
    );
    expect(list.items.map((s) => s.id)).toContain(shiftId);

    const audit = await db.auditLog.findFirst({
      where: { entity: 'CashShift', entityId: shiftId, action: 'SHIFT_CLOSE' },
    });
    expect(audit).toBeTruthy();

    // Yopilgan smenadan soʻng toʻlov yana 409
    const v2 = await createTestVisit(clinics.demo.id, users.doctor!.id, `${MARKER}-00003`, 1);
    const blocked = await paymentsPOST(
      makeRequest('POST', '/api/payments', { visitId: v2.id, amount: 1_000, method: 'CASH' }),
    );
    expect((await readError(blocked)).code).toBe('NO_OPEN_SHIFT');
  });

  it('boshqa klinika (lor-plus) smenani koʻra olmaydi → 404', async () => {
    const admin2 = await db.user.findUniqueOrThrow({
      where: { login: 'admin2' },
      select: { id: true, login: true, role: true, fullName: true, clinicId: true },
    });
    actAs(admin2);
    const res = await shiftGET(makeRequest('GET', `/api/shifts/${shiftId}`), ctx(shiftId));
    expect((await readError(res)).status).toBe(404);
  });
});
