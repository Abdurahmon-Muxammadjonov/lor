import { describe, it, expect, vi } from 'vitest';
import { Prisma, type DiscountType } from '@prisma/client';
import Decimal from 'decimal.js';
import type { Tx } from '@/lib/prisma';
import { CalcError } from '@/lib/calc';
import { recalcVisit, computeLineSnapshot, dbMoney, dbQuantity, type LineSnapshotService } from '@/lib/visits/recalc';

const SERVICE: LineSnapshotService = {
  code: 'LOR-001',
  name: 'Burun yuvish',
  nameRu: 'Промывание носа',
  unit: 'seans',
  priceAdultNoMed: new Prisma.Decimal('100000'),
  priceAdultMed: new Prisma.Decimal('120000'),
  priceChildNoMed: new Prisma.Decimal('75000'),
  priceChildMed: new Prisma.Decimal('90000'),
  allowHalf: true,
  medicineOptional: true,
};

const str = (d: Prisma.Decimal | Decimal): string => d.toString();

describe('recalc: dbMoney / dbQuantity', () => {
  it('dbMoney butun Prisma.Decimal beradi', () => {
    const d = dbMoney(180000.4);
    expect(d).toBeInstanceOf(Prisma.Decimal);
    expect(str(d)).toBe('180000');
    expect(str(dbMoney('1 250 000'))).toBe('1250000');
    expect(str(dbMoney(null))).toBe('0');
    expect(str(dbMoney(new Decimal('99.5')))).toBe('100');
  });

  it('dbQuantity 0.5 qadamni saqlaydi', () => {
    expect(str(dbQuantity(1.5))).toBe('1.5');
    expect(str(dbQuantity('2'))).toBe('2');
    expect(dbQuantity(0.5).toFixed(1)).toBe('0.5');
  });
});

describe('recalc: computeLineSnapshot', () => {
  it('kattalar, dori bilan, 1.5 → 180 000 (barcha snapshot maydonlar)', () => {
    const s = computeLineSnapshot(SERVICE, {
      patientType: 'ADULT',
      withMedicine: true,
      quantity: 1.5,
      discountType: 'NONE',
      discountValue: 0,
    });
    expect(s.serviceCode).toBe('LOR-001');
    expect(s.serviceName).toBe('Burun yuvish');
    expect(s.serviceNameRu).toBe('Промывание носа');
    expect(s.unit).toBe('seans');
    expect(s.patientType).toBe('ADULT');
    expect(s.withMedicine).toBe(true);
    expect(str(s.quantity)).toBe('1.5');
    expect(str(s.unitPrice)).toBe('120000');
    expect(str(s.grossTotal)).toBe('180000');
    expect(s.discountType).toBe('NONE');
    expect(str(s.discountValue)).toBe('0');
    expect(str(s.discountTotal)).toBe('0');
    expect(str(s.lineTotal)).toBe('180000');
    for (const v of [s.quantity, s.unitPrice, s.grossTotal, s.discountValue, s.discountTotal, s.lineTotal]) {
      expect(v).toBeInstanceOf(Prisma.Decimal);
    }
  });

  it('bola, dori bilan → 90 000', () => {
    const s = computeLineSnapshot(SERVICE, {
      patientType: 'CHILD',
      withMedicine: true,
      quantity: 1,
      discountType: 'NONE',
      discountValue: 0,
    });
    expect(s.patientType).toBe('CHILD');
    expect(str(s.unitPrice)).toBe('90000');
    expect(str(s.lineTotal)).toBe('90000');
  });

  it('bola, dorisiz, 2 → 150 000', () => {
    const s = computeLineSnapshot(SERVICE, {
      patientType: 'CHILD',
      withMedicine: false,
      quantity: 2,
      discountType: 'NONE',
      discountValue: 0,
    });
    expect(s.withMedicine).toBe(false);
    expect(str(s.unitPrice)).toBe('75000');
    expect(str(s.grossTotal)).toBe('150000');
  });

  it('kattalar, dorisiz, 0.5 → 50 000', () => {
    const s = computeLineSnapshot(SERVICE, {
      patientType: 'ADULT',
      withMedicine: false,
      quantity: 0.5,
      discountType: 'NONE',
      discountValue: 0,
    });
    expect(str(s.unitPrice)).toBe('100000');
    expect(str(s.quantity)).toBe('0.5');
    expect(str(s.grossTotal)).toBe('50000');
  });

  it('medicineOptional=false → withMedicine majburan true, dori bilan narx', () => {
    const s = computeLineSnapshot(
      { ...SERVICE, medicineOptional: false },
      { patientType: 'ADULT', withMedicine: false, quantity: 1, discountType: 'NONE', discountValue: 0 },
    );
    expect(s.withMedicine).toBe(true);
    expect(str(s.unitPrice)).toBe('120000');
  });

  it('PERCENT 10 chegirma snapshoti: value 10, total 18 000, line 162 000', () => {
    const s = computeLineSnapshot(SERVICE, {
      patientType: 'ADULT',
      withMedicine: true,
      quantity: 1.5,
      discountType: 'PERCENT',
      discountValue: 10,
    });
    expect(s.discountType).toBe('PERCENT');
    expect(str(s.discountValue)).toBe('10');
    expect(str(s.discountTotal)).toBe('18000');
    expect(str(s.lineTotal)).toBe('162000');
  });

  it('FIXED 25 000 chegirma snapshoti', () => {
    const s = computeLineSnapshot(SERVICE, {
      patientType: 'ADULT',
      withMedicine: true,
      quantity: 1.5,
      discountType: 'FIXED',
      discountValue: '25 000',
    });
    expect(s.discountType).toBe('FIXED');
    expect(str(s.discountValue)).toBe('25000');
    expect(str(s.discountTotal)).toBe('25000');
    expect(str(s.lineTotal)).toBe('155000');
  });

  it('FIXED chegirma xom summadan oshsa discountTotal = gross, lineTotal = 0', () => {
    const s = computeLineSnapshot(SERVICE, {
      patientType: 'ADULT',
      withMedicine: true,
      quantity: 1,
      discountType: 'FIXED',
      discountValue: 500000,
    });
    expect(str(s.discountValue)).toBe('500000');
    expect(str(s.discountTotal)).toBe('120000');
    expect(str(s.lineTotal)).toBe('0');
  });

  it('NONE boʻlsa discountValue 0 ga keltiriladi', () => {
    const s = computeLineSnapshot(SERVICE, {
      patientType: 'ADULT',
      withMedicine: true,
      quantity: 1,
      discountType: 'NONE',
      discountValue: 50,
    });
    expect(str(s.discountValue)).toBe('0');
    expect(str(s.discountTotal)).toBe('0');
  });

  it('allowHalf=false + 0.5 → HALF_NOT_ALLOWED', () => {
    expect(() =>
      computeLineSnapshot(
        { ...SERVICE, allowHalf: false },
        { patientType: 'ADULT', withMedicine: true, quantity: 0.5, discountType: 'NONE', discountValue: 0 },
      ),
    ).toThrowError(expect.objectContaining({ name: 'CalcError', code: 'HALF_NOT_ALLOWED' }));
  });

  it('1.3 → INVALID_QUANTITY; PERCENT 120 → INVALID_DISCOUNT', () => {
    expect(() =>
      computeLineSnapshot(SERVICE, { patientType: 'ADULT', withMedicine: true, quantity: 1.3, discountType: 'NONE', discountValue: 0 }),
    ).toThrow(CalcError);
    expect(() =>
      computeLineSnapshot(SERVICE, {
        patientType: 'ADULT',
        withMedicine: true,
        quantity: 1,
        discountType: 'PERCENT',
        discountValue: 120,
      }),
    ).toThrowError(expect.objectContaining({ code: 'INVALID_DISCOUNT' }));
  });

  it('narxlar number/string shaklida ham ishlaydi', () => {
    const s = computeLineSnapshot(
      { ...SERVICE, priceAdultMed: '120 000', priceAdultNoMed: 100000 },
      { patientType: 'ADULT', withMedicine: true, quantity: 2, discountType: 'NONE', discountValue: 0 },
    );
    expect(str(s.grossTotal)).toBe('240000');
  });

  it('natija prisma.treatmentLine.create data ga toʻgʻridan-toʻgʻri mos', () => {
    const s = computeLineSnapshot(SERVICE, {
      patientType: 'ADULT',
      withMedicine: true,
      quantity: 1,
      discountType: 'NONE',
      discountValue: 0,
    });
    const data: Prisma.TreatmentLineUncheckedCreateInput = { visitId: 'v1', serviceId: 's1', ...s };
    expect(data.serviceCode).toBe('LOR-001');
    expect(Object.keys(s).sort()).toEqual(
      [
        'serviceCode',
        'serviceName',
        'serviceNameRu',
        'unit',
        'patientType',
        'withMedicine',
        'quantity',
        'unitPrice',
        'grossTotal',
        'discountType',
        'discountValue',
        'discountTotal',
        'lineTotal',
      ].sort(),
    );
  });
});

// ───────────────────────────── recalcVisit (soxta tx) ─────────────────────────────

interface FakeLine {
  grossTotal: Prisma.Decimal;
  discountTotal: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
}

interface FakeVisit {
  id: string;
  globalDiscountType: DiscountType;
  globalDiscountValue: Prisma.Decimal;
  clinic: { roundTo: number };
}

function makeFakeTx(opts: {
  visit: FakeVisit;
  lines: FakeLine[];
  payments: Array<{ amount: Prisma.Decimal }>;
}) {
  const visitFindUniqueOrThrow = vi.fn(async (_args: { where: { id: string }; select: unknown }) => opts.visit);
  const lineFindMany = vi.fn(async (_args: { where: { visitId: string }; select: unknown }) => opts.lines);
  const paymentFindMany = vi.fn(async (_args: { where: { visitId: string }; select: unknown }) => opts.payments);
  const visitUpdate = vi.fn(async (args: { where: { id: string }; data: Record<string, Prisma.Decimal> }) => ({
    ...opts.visit,
    ...args.data,
  }));
  const tx = {
    visit: { findUniqueOrThrow: visitFindUniqueOrThrow, update: visitUpdate },
    treatmentLine: { findMany: lineFindMany },
    payment: { findMany: paymentFindMany },
  } as unknown as Tx;
  return { tx, visitFindUniqueOrThrow, lineFindMany, paymentFindMany, visitUpdate };
}

const line = (gross: number, discount: number): FakeLine => ({
  grossTotal: new Prisma.Decimal(gross),
  discountTotal: new Prisma.Decimal(discount),
  lineTotal: new Prisma.Decimal(gross - discount),
});

const pay = (amount: number) => ({ amount: new Prisma.Decimal(amount) });

const visit = (over: Partial<FakeVisit> = {}): FakeVisit => ({
  id: 'visit_1',
  globalDiscountType: 'NONE',
  globalDiscountValue: new Prisma.Decimal(0),
  clinic: { roundTo: 100 },
  ...over,
});

type VisitUpdateMock = ReturnType<typeof makeFakeTx>['visitUpdate'];

/** update() ga uzatilgan data ni string koʻrinishda olish */
function updatedData(fn: VisitUpdateMock): Record<string, string> {
  const call = fn.mock.calls[0]?.[0];
  if (!call) throw new Error('visit.update chaqirilmagan');
  return Object.fromEntries(Object.entries(call.data).map(([k, v]) => [k, v.toString()]));
}

describe('recalc: recalcVisit (soxta tx)', () => {
  it('qatorlar + toʻlovlar → jamlar toʻgʻri va Visit yangilanadi', async () => {
    const f = makeFakeTx({
      visit: visit(),
      lines: [line(180_000, 18_000), line(60_000, 0), line(7_500, 2_500)],
      payments: [pay(100_000), pay(50_000)],
    });

    const r = await recalcVisit(f.tx, 'visit_1');

    expect(str(r.totalGross)).toBe('247500');
    expect(str(r.discount)).toBe('20500');
    expect(str(r.totalNet)).toBe('227000');
    expect(str(r.paidAmount)).toBe('150000');
    expect(str(r.balance)).toBe('77000');

    expect(f.visitFindUniqueOrThrow).toHaveBeenCalledTimes(1);
    expect(f.visitFindUniqueOrThrow.mock.calls[0]?.[0]).toMatchObject({ where: { id: 'visit_1' } });
    expect(f.lineFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { visitId: 'visit_1' } }));
    expect(f.paymentFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { visitId: 'visit_1' } }));

    expect(f.visitUpdate).toHaveBeenCalledTimes(1);
    const call = f.visitUpdate.mock.calls[0]?.[0];
    expect(call?.where).toEqual({ id: 'visit_1' });
    expect(updatedData(f.visitUpdate)).toEqual({
      totalGross: '247500',
      discount: '20500',
      totalNet: '227000',
      paidAmount: '150000',
    });
    for (const v of Object.values(call?.data ?? {})) expect(v).toBeInstanceOf(Prisma.Decimal);
  });

  it('umumiy chegirma PERCENT 10 → Visit.discount = qator chegirmalari + umumiy', async () => {
    const f = makeFakeTx({
      visit: visit({ globalDiscountType: 'PERCENT', globalDiscountValue: new Prisma.Decimal('10') }),
      lines: [line(180_000, 18_000), line(60_000, 0)], // net 222 000
      payments: [],
    });
    const r = await recalcVisit(f.tx, 'visit_1');
    expect(str(r.totalGross)).toBe('240000');
    // qator chegirmasi 18 000 + umumiy 22 200 = 40 200
    expect(str(r.discount)).toBe('40200');
    expect(str(r.totalNet)).toBe('199800');
    expect(str(r.paidAmount)).toBe('0');
    expect(str(r.balance)).toBe('199800');
    expect(updatedData(f.visitUpdate)).toEqual({
      totalGross: '240000',
      discount: '40200',
      totalNet: '199800',
      paidAmount: '0',
    });
  });

  it('umumiy chegirma FIXED 25 000 + yaxlitlash @100', async () => {
    const f = makeFakeTx({
      visit: visit({ globalDiscountType: 'FIXED', globalDiscountValue: new Prisma.Decimal('25000') }),
      lines: [line(187_350, 0)], // 187 350 − 25 000 = 162 350 → 162 400
      payments: [],
    });
    const r = await recalcVisit(f.tx, 'visit_1');
    expect(str(r.discount)).toBe('25000');
    expect(str(r.totalNet)).toBe('162400');
    expect(updatedData(f.visitUpdate).totalNet).toBe('162400');
  });

  it('clinic.roundTo = 1 → yaxlitlanmaydi; roundTo = 1000', async () => {
    const a = makeFakeTx({ visit: visit({ clinic: { roundTo: 1 } }), lines: [line(162_349, 0)], payments: [] });
    expect(str((await recalcVisit(a.tx, 'visit_1')).totalNet)).toBe('162349');

    const b = makeFakeTx({ visit: visit({ clinic: { roundTo: 1000 } }), lines: [line(162_500, 0)], payments: [] });
    expect(str((await recalcVisit(b.tx, 'visit_1')).totalNet)).toBe('163000');
  });

  it('qatorlar yoʻq → hamma jam 0', async () => {
    const f = makeFakeTx({ visit: visit(), lines: [], payments: [] });
    const r = await recalcVisit(f.tx, 'visit_1');
    expect(str(r.totalGross)).toBe('0');
    expect(str(r.discount)).toBe('0');
    expect(str(r.totalNet)).toBe('0');
    expect(str(r.paidAmount)).toBe('0');
    expect(str(r.balance)).toBe('0');
    expect(updatedData(f.visitUpdate)).toEqual({ totalGross: '0', discount: '0', totalNet: '0', paidAmount: '0' });
  });

  it('ortiqcha toʻlov → manfiy balance; qaytarish (manfiy toʻlov) hisobga olinadi', async () => {
    const f = makeFakeTx({
      visit: visit(),
      lines: [line(180_000, 0)],
      payments: [pay(200_000), pay(-10_000)],
    });
    const r = await recalcVisit(f.tx, 'visit_1');
    expect(str(r.paidAmount)).toBe('190000');
    expect(str(r.balance)).toBe('-10000');
    expect(updatedData(f.visitUpdate).paidAmount).toBe('190000');
  });

  it('umumiy chegirma subtotal dan oshmaydi', async () => {
    const f = makeFakeTx({
      visit: visit({ globalDiscountType: 'FIXED', globalDiscountValue: new Prisma.Decimal('999999') }),
      lines: [line(120_000, 20_000)], // net 100 000
      payments: [],
    });
    const r = await recalcVisit(f.tx, 'visit_1');
    expect(str(r.discount)).toBe('120000'); // 20 000 + 100 000
    expect(str(r.totalNet)).toBe('0');
  });

  it('DB Decimal kasr koʻrinishida kelsa ham ("120000.00") toʻgʻri', async () => {
    const f = makeFakeTx({
      visit: visit({ globalDiscountValue: new Prisma.Decimal('0.00') }),
      lines: [
        {
          grossTotal: new Prisma.Decimal('120000.00'),
          discountTotal: new Prisma.Decimal('0.00'),
          lineTotal: new Prisma.Decimal('120000.00'),
        },
      ],
      payments: [{ amount: new Prisma.Decimal('50000.00') }],
    });
    const r = await recalcVisit(f.tx, 'visit_1');
    expect(str(r.totalNet)).toBe('120000');
    expect(str(r.balance)).toBe('70000');
    expect(updatedData(f.visitUpdate).totalNet).toBe('120000');
  });

  it('umumiy chegirma PERCENT > 100 → CalcError, update chaqirilmaydi', async () => {
    const f = makeFakeTx({
      visit: visit({ globalDiscountType: 'PERCENT', globalDiscountValue: new Prisma.Decimal('150') }),
      lines: [line(100_000, 0)],
      payments: [],
    });
    await expect(recalcVisit(f.tx, 'visit_1')).rejects.toThrowError(expect.objectContaining({ code: 'INVALID_DISCOUNT' }));
    expect(f.visitUpdate).not.toHaveBeenCalled();
  });

  it('qabul topilmasa findUniqueOrThrow xatosi oʻtkaziladi', async () => {
    const f = makeFakeTx({ visit: visit(), lines: [], payments: [] });
    f.visitFindUniqueOrThrow.mockRejectedValueOnce(new Error('No Visit found'));
    await expect(recalcVisit(f.tx, 'missing')).rejects.toThrow('No Visit found');
    expect(f.visitUpdate).not.toHaveBeenCalled();
  });

  it('qaytarilgan jamlar update ga yozilgan qiymatlar bilan bir xil (yaxlitlangan)', async () => {
    const f = makeFakeTx({
      visit: visit({ globalDiscountType: 'PERCENT', globalDiscountValue: new Prisma.Decimal('7') }),
      lines: [line(123_456, 0), line(7_891, 391)],
      payments: [pay(20_000)],
    });
    const r = await recalcVisit(f.tx, 'visit_1');
    const d = updatedData(f.visitUpdate);
    expect(d.totalGross).toBe(str(r.totalGross));
    expect(d.discount).toBe(str(r.discount));
    expect(d.totalNet).toBe(str(r.totalNet));
    expect(d.paidAmount).toBe(str(r.paidAmount));
    expect(r.totalNet.mod(100).isZero()).toBe(true);
    expect(str(r.balance)).toBe(r.totalNet.minus(r.paidAmount).toString());
  });
});
