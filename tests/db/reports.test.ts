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
import { loadWorkbook } from '../helpers/excel';
import { GET as summaryGET } from '@/app/api/reports/summary/route';
import { GET as revenueGET } from '@/app/api/reports/revenue/route';
import { GET as doctorsGET } from '@/app/api/reports/doctors/route';
import { GET as servicesGET } from '@/app/api/reports/services/route';
import { GET as patientTypesGET } from '@/app/api/reports/patient-types/route';
import { GET as medicineGET } from '@/app/api/reports/medicine/route';
import { GET as shiftsGET } from '@/app/api/reports/shifts/route';
import { GET as debtorsGET } from '@/app/api/reports/debtors/route';
import { POST as remindPOST } from '@/app/api/reports/debtors/remind/route';
import { GET as exportGET } from '@/app/api/reports/export/route';
import { dayRangeTz, todayKey } from '@/lib/date';
import { addDaysKey, buildPeriods } from '@/lib/reports/period';
import type {
  DebtReminderResultDTO,
  DebtorsReportDTO,
  DoctorsReportDTO,
  MedicineReportDTO,
  PatientTypesReportDTO,
  RevenueReportDTO,
  ServicesReportDTO,
  ShiftsReportDTO,
  SummaryDTO,
} from '@/lib/reports/types';

const HAS_DB = !!process.env.DATABASE_URL;
const dbDescribe = HAS_DB ? describe : describe.skip;

const MARKER = `zztest-reports-${Date.now()}`;

interface TestUser {
  id: string;
  login: string;
  role: Role;
  fullName: string;
  clinicId: string;
}

type PrismaModule = typeof import('@/lib/prisma');
let db: PrismaModule['prisma'];

const clinics = { demo: { id: '', name: '' }, lorPlus: { id: '', name: '' } };
const users: Record<string, TestUser> = {};
const created = { patientId: null as string | null, visitId: null as string | null, smsIds: [] as string[] };

const TO = todayKey();
const FROM = addDaysKey(TO, -29);
const RANGE_QS = `from=${FROM}&to=${TO}`;
const start = dayRangeTz(FROM).start;
const end = dayRangeTz(TO).end;

function actAs(login: string) {
  const u = users[login];
  if (!u) throw new Error(`Test user ${login} topilmadi`);
  const isDemo = u.clinicId === clinics.demo.id;
  vi.mocked(getServerSession).mockResolvedValue(
    mockSession({
      id: u.id,
      login: u.login,
      role: u.role,
      fullName: u.fullName,
      clinicId: u.clinicId,
      clinicName: isDemo ? clinics.demo.name : clinics.lorPlus.name,
      clinicSlug: isDemo ? 'demo' : 'lor-plus',
    }),
  );
}

const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(String(v)));

async function paymentsSum(clinicId: string, doctorId?: string): Promise<number> {
  const agg = await db.payment.aggregate({
    where: { clinicId, createdAt: { gte: start, lte: end }, ...(doctorId ? { visit: { doctorId } } : {}) },
    _sum: { amount: true },
  });
  return num(agg._sum.amount);
}

async function visitsCount(clinicId: string, doctorId?: string): Promise<number> {
  return db.visit.count({ where: { clinicId, createdAt: { gte: start, lte: end }, status: { not: 'CANCELLED' }, ...(doctorId ? { doctorId } : {}) } });
}

dbDescribe('reports API (DB)', () => {
  beforeAll(async () => {
    const mod = await import('@/lib/prisma');
    db = mod.prisma;
    const rows = await db.clinic.findMany({ where: { slug: { in: ['demo', 'lor-plus'] } }, select: { id: true, slug: true, name: true } });
    for (const c of rows) {
      if (c.slug === 'demo') clinics.demo = { id: c.id, name: c.name };
      if (c.slug === 'lor-plus') clinics.lorPlus = { id: c.id, name: c.name };
    }
    expect(clinics.demo.id, 'demo klinika seedlangan boʻlishi kerak').not.toBe('');
    expect(clinics.lorPlus.id, 'lor-plus klinika seedlangan boʻlishi kerak').not.toBe('');

    const us = await db.user.findMany({
      where: { login: { in: ['admin', 'doctor', 'cashier', 'reception', 'admin2'] } },
      select: { id: true, login: true, role: true, fullName: true, clinicId: true },
    });
    for (const u of us) users[u.login] = u;
    for (const login of ['admin', 'doctor', 'cashier', 'reception', 'admin2']) {
      expect(users[login], `${login} seedlangan boʻlishi kerak`).toBeDefined();
    }
  });

  afterAll(async () => {
    if (!db) return;
    if (created.smsIds.length > 0) {
      await db.auditLog.deleteMany({ where: { entity: 'SmsLog', entityId: { in: created.smsIds } } });
      await db.smsLog.deleteMany({ where: { id: { in: created.smsIds } } });
    }
    if (created.visitId) await db.visit.deleteMany({ where: { id: created.visitId } });
    if (created.patientId) {
      await db.smsLog.deleteMany({ where: { patientId: created.patientId } });
      await db.patient.deleteMany({ where: { id: created.patientId } });
    }
    await db.$disconnect();
  });

  it('summary: tushum / qabullar prisma yigʻindilariga teng, oldingi davr va deltalar bor', async () => {
    actAs('admin');
    const s = await readData<SummaryDTO>(await summaryGET(makeRequest('GET', `/api/reports/summary?${RANGE_QS}`)));
    const clinicId = clinics.demo.id;
    expect(s.range).toEqual({ from: FROM, to: TO });
    expect(s.revenue).toBe(await paymentsSum(clinicId));
    expect(s.visits).toBe(await visitsCount(clinicId));
    expect(s.avgCheck).toBe(s.visits > 0 ? Math.round(s.revenue / s.visits) : 0);
    expect(s.previousRange.to < s.range.from).toBe(true);
    expect(Number.isInteger(s.debt)).toBe(true);
    const methodsTotal = s.byMethod.reduce((sum, m) => sum + m.amount, 0);
    expect(methodsTotal).toBe(s.revenue);
    expect(s.byMethod.map((m) => m.method)).toEqual(['CASH', 'CARD', 'TRANSFER', 'CLICK', 'PAYME']);
    // Yakunlangan qabullar boʻyicha qarz
    const debtRows = await db.visit.findMany({
      where: { clinicId, createdAt: { gte: start, lte: end }, status: 'COMPLETED' },
      select: { totalNet: true, paidAmount: true },
    });
    const expectedDebt = debtRows.reduce((sum, v) => sum + Math.max(0, num(v.totalNet) - num(v.paidAmount)), 0);
    expect(s.debt).toBe(expectedDebt);
  });

  it('revenue (oxirgi 30 kun): davrlar yigʻindisi = prisma toʻlovlar yigʻindisi; kun/hafta/oy bir xil jami', async () => {
    actAs('admin');
    const clinicId = clinics.demo.id;
    const expectedRevenue = await paymentsSum(clinicId);
    const expectedVisits = await visitsCount(clinicId);
    expect(expectedRevenue).toBeGreaterThan(0);

    for (const groupBy of ['day', 'week', 'month'] as const) {
      const r = await readData<RevenueReportDTO>(await revenueGET(makeRequest('GET', `/api/reports/revenue?${RANGE_QS}&groupBy=${groupBy}`)));
      expect(r.groupBy).toBe(groupBy);
      expect(r.periods.map((p) => p.period)).toEqual(buildPeriods(FROM, TO, groupBy).map((p) => p.period));
      const sum = r.periods.reduce((s, p) => s + p.revenue, 0);
      const visits = r.periods.reduce((s, p) => s + p.visits, 0);
      expect(sum).toBe(expectedRevenue);
      expect(visits).toBe(expectedVisits);
      expect(r.totals.revenue).toBe(expectedRevenue);
      expect(r.totals.visits).toBe(expectedVisits);
      for (const p of r.periods) {
        expect(p.byMethod.reduce((s, m) => s + m.amount, 0)).toBe(p.revenue);
        expect(p.avgCheck).toBe(p.visits > 0 ? Math.round(p.revenue / p.visits) : 0);
        expect(p.start >= FROM && p.end <= TO).toBe(true);
      }
    }

    // Bitta kun: kun chegaralari Asia/Tashkent boʻyicha
    const day = await readData<RevenueReportDTO>(await revenueGET(makeRequest('GET', `/api/reports/revenue?from=${TO}&to=${TO}&groupBy=day`)));
    expect(day.periods).toHaveLength(1);
    const todayAgg = await db.payment.aggregate({ where: { clinicId, createdAt: { gte: dayRangeTz(TO).start, lte: dayRangeTz(TO).end } }, _sum: { amount: true } });
    expect(day.totals.revenue).toBe(num(todayAgg._sum.amount));
  });

  it('revenue: shifokor filtri faqat shu shifokor qabullariga bogʻlangan toʻlovlarni oladi', async () => {
    actAs('admin');
    const doctor = users.doctor;
    if (!doctor) throw new Error('doctor yoʻq');
    const r = await readData<RevenueReportDTO>(await revenueGET(makeRequest('GET', `/api/reports/revenue?${RANGE_QS}&groupBy=day&doctorId=${doctor.id}`)));
    expect(r.totals.revenue).toBe(await paymentsSum(clinics.demo.id, doctor.id));
    expect(r.totals.visits).toBe(await visitsCount(clinics.demo.id, doctor.id));
  });

  it('doctors: ulushlar yigʻindisi 100 ± 0.5, tushum kamayish tartibida, maosh formulasi', async () => {
    actAs('admin');
    const d = await readData<DoctorsReportDTO>(await doctorsGET(makeRequest('GET', `/api/reports/doctors?${RANGE_QS}`)));
    expect(d.rows.length).toBeGreaterThan(0);
    const shareSum = d.rows.reduce((s, r) => s + r.share, 0);
    expect(Math.abs(shareSum - 100)).toBeLessThanOrEqual(0.5);
    expect(d.totals.revenue).toBe(await paymentsSum(clinics.demo.id));
    for (let i = 1; i < d.rows.length; i++) expect(d.rows[i - 1]!.revenue).toBeGreaterThanOrEqual(d.rows[i]!.revenue);
    for (const r of d.rows) {
      expect(r.avgCheck).toBe(r.visits > 0 ? Math.round(r.revenue / r.visits) : 0);
      if (r.salaryType === 'PERCENT') expect(r.salary).toBe(Math.round((r.revenue * r.salaryValue) / 100));
      else expect(r.salary).toBe(r.salaryValue);
      expect(r.revenue).toBe(await paymentsSum(clinics.demo.id, r.doctorId));
      expect(r.visits).toBe(await visitsCount(clinics.demo.id, r.doctorId));
    }
    // Faqat demo klinika xodimlari
    const demoUserIds = new Set((await db.user.findMany({ where: { clinicId: clinics.demo.id }, select: { id: true } })).map((u) => u.id));
    for (const r of d.rows) expect(demoUserIds.has(r.doctorId)).toBe(true);
  });

  it('services / medicine: qatorlar yigʻindisi = TreatmentLine yigʻindisi; ulushlar ~100', async () => {
    actAs('admin');
    const clinicId = clinics.demo.id;
    const s = await readData<ServicesReportDTO>(await servicesGET(makeRequest('GET', `/api/reports/services?${RANGE_QS}`)));
    const agg = await db.treatmentLine.aggregate({
      where: { visit: { clinicId, createdAt: { gte: start, lte: end }, status: { not: 'CANCELLED' } } },
      _sum: { lineTotal: true, quantity: true },
      _count: { _all: true },
    });
    expect(s.totals.revenue).toBe(num(agg._sum.lineTotal));
    expect(s.totals.lines).toBe(agg._count._all);
    expect(Math.abs(s.totals.count - num(agg._sum.quantity))).toBeLessThan(0.01);
    expect(Math.abs(s.rows.reduce((sum, r) => sum + r.share, 0) - 100)).toBeLessThanOrEqual(1);
    for (const r of s.rows) {
      expect(Math.abs(r.adultCount + r.childCount - r.count)).toBeLessThan(0.01);
      expect(Math.abs(r.medCount + r.noMedCount - r.count)).toBeLessThan(0.01);
      expect(r.code).toBeTruthy();
    }

    const m = await readData<MedicineReportDTO>(await medicineGET(makeRequest('GET', `/api/reports/medicine?${RANGE_QS}`)));
    expect(m.totals.total.revenue).toBe(s.totals.revenue);
    expect(m.totals.total.lines).toBe(s.totals.lines);
    expect(Math.abs(m.totals.med.count - s.totals.medCount)).toBeLessThan(0.01);
    for (const r of m.rows) {
      expect(Math.abs(r.med.count + r.noMed.count - r.total.count)).toBeLessThan(0.01);
      if (!r.medicineOptional) expect(r.noMed.lines).toBe(0);
    }
  });

  it('patient-types: kattalar + bolalar = jami; trend yigʻindisi = jami', async () => {
    actAs('admin');
    const p = await readData<PatientTypesReportDTO>(await patientTypesGET(makeRequest('GET', `/api/reports/patient-types?${RANGE_QS}&groupBy=week`)));
    expect(p.adult.revenue + p.child.revenue).toBe(p.total.revenue);
    expect(p.adult.lines + p.child.lines).toBe(p.total.lines);
    expect(Math.abs(p.adult.share + p.child.share - 100)).toBeLessThanOrEqual(0.02);
    expect(p.trend.reduce((s, x) => s + x.adult.revenue + x.child.revenue, 0)).toBe(p.total.revenue);
    expect(p.trend.map((x) => x.period)).toEqual(buildPeriods(FROM, TO, 'week').map((x) => x.period));
    const childLines = await db.treatmentLine.count({ where: { patientType: 'CHILD', visit: { clinicId: clinics.demo.id, createdAt: { gte: start, lte: end }, status: { not: 'CANCELLED' } } } });
    expect(p.child.lines).toBe(childLines);
  });

  it('shifts: yopiq smenalar snapshot jamlari, farq = haqiqiy − kutilgan', async () => {
    actAs('cashier');
    const s = await readData<ShiftsReportDTO>(await shiftsGET(makeRequest('GET', `/api/reports/shifts?${RANGE_QS}`)));
    expect(s.rows.length).toBeGreaterThan(0);
    expect(s.totals.count).toBe(s.rows.length);
    expect(s.totals.open).toBe(s.rows.filter((r) => r.status === 'OPEN').length);
    for (const r of s.rows) {
      const sum = r.totals.CASH + r.totals.CARD + r.totals.TRANSFER + r.totals.CLICK + r.totals.PAYME;
      expect(r.total).toBe(sum);
      expect(r.expectedCash).toBe(r.openingCash + r.totals.CASH);
      if (r.status === 'CLOSED' && r.closingCash !== null) expect(r.difference).toBe(r.closingCash - r.expectedCash);
      if (r.status === 'OPEN') expect(r.difference).toBeNull();
    }
    const closed = s.rows.find((r) => r.status === 'CLOSED');
    if (closed) {
      const row = await db.cashShift.findFirst({ where: { id: closed.id, clinicId: clinics.demo.id } });
      expect(num(row?.totalCash)).toBe(closed.totals.CASH);
      expect(num(row?.totalCard)).toBe(closed.totals.CARD);
    }
  });

  it('debtors (barcha vaqt): jami qarz = Σ (totalNet − paidAmount) yakunlangan qabullar boʻyicha, kamayish tartibida', async () => {
    actAs('cashier');
    const d = await readData<DebtorsReportDTO>(await debtorsGET(makeRequest('GET', `/api/reports/debtors?${RANGE_QS}&all=1`)));
    expect(d.allTime).toBe(true);
    const rows = await db.visit.findMany({ where: { clinicId: clinics.demo.id, status: 'COMPLETED' }, select: { totalNet: true, paidAmount: true, patientId: true } });
    const expected = rows.reduce((s, v) => s + Math.max(0, num(v.totalNet) - num(v.paidAmount)), 0);
    expect(d.total).toBe(expected);
    expect(d.count).toBe(new Set(rows.filter((v) => num(v.totalNet) > num(v.paidAmount)).map((v) => v.patientId)).size);
    for (let i = 1; i < d.rows.length; i++) expect(d.rows[i - 1]!.totalDebt).toBeGreaterThanOrEqual(d.rows[i]!.totalDebt);
    for (const r of d.rows) {
      expect(r.totalDebt).toBeGreaterThan(0);
      expect(r.patient.phone).toBeTruthy();
      expect(r.lastVisitId).toBeTruthy();
    }
    const ranged = await readData<DebtorsReportDTO>(await debtorsGET(makeRequest('GET', `/api/reports/debtors?${RANGE_QS}`)));
    expect(ranged.allTime).toBe(false);
    expect(ranged.total).toBeLessThanOrEqual(d.total);
  });

  it('CASHIER: /doctors, /services, /patient-types, /medicine va full eksport → 403; RECEPTION → 403; ADMIN → 200', async () => {
    actAs('cashier');
    for (const [name, handler] of [
      ['doctors', doctorsGET],
      ['services', servicesGET],
      ['patient-types', patientTypesGET],
      ['medicine', medicineGET],
    ] as const) {
      const err = await readError(await handler(makeRequest('GET', `/api/reports/${name}?${RANGE_QS}`)));
      expect(err.status, name).toBe(403);
      expect(err.code).toBe('FORBIDDEN');
    }
    const full = await readError(await exportGET(makeRequest('GET', `/api/reports/export?kind=full&${RANGE_QS}`)));
    expect(full.status).toBe(403);
    const okRes = await revenueGET(makeRequest('GET', `/api/reports/revenue?${RANGE_QS}`));
    expect(okRes.status).toBe(200);

    actAs('reception');
    expect((await readError(await summaryGET(makeRequest('GET', `/api/reports/summary?${RANGE_QS}`)))).status).toBe(403);
    expect((await readError(await revenueGET(makeRequest('GET', `/api/reports/revenue?${RANGE_QS}`)))).status).toBe(403);

    actAs('admin');
    expect((await doctorsGET(makeRequest('GET', `/api/reports/doctors?${RANGE_QS}`))).status).toBe(200);
  });

  it('validatsiya: notoʻgʻri sana / groupBy → 400', async () => {
    actAs('admin');
    expect((await readError(await revenueGET(makeRequest('GET', '/api/reports/revenue?from=2026-02-30')))).status).toBe(400);
    expect((await readError(await revenueGET(makeRequest('GET', `/api/reports/revenue?${RANGE_QS}&groupBy=year`)))).status).toBe(400);
    expect((await readError(await exportGET(makeRequest('GET', `/api/reports/export?kind=nope&${RANGE_QS}`)))).status).toBe(400);
  });

  it('boshqa klinika izolyatsiyasi: admin2 (lor-plus) faqat oʻz maʼlumotini koʻradi', async () => {
    actAs('admin2');
    const s = await readData<SummaryDTO>(await summaryGET(makeRequest('GET', `/api/reports/summary?${RANGE_QS}`)));
    expect(s.revenue).toBe(await paymentsSum(clinics.lorPlus.id));
    expect(s.visits).toBe(await visitsCount(clinics.lorPlus.id));
    const d = await readData<DoctorsReportDTO>(await doctorsGET(makeRequest('GET', `/api/reports/doctors?${RANGE_QS}`)));
    const plusIds = new Set((await db.user.findMany({ where: { clinicId: clinics.lorPlus.id }, select: { id: true } })).map((u) => u.id));
    expect(d.rows.length).toBeGreaterThan(0);
    for (const r of d.rows) expect(plusIds.has(r.doctorId)).toBe(true);
    // Demo shifokor id bilan filtr — boshqa klinika: hech narsa
    const demoDoctor = users.doctor;
    if (!demoDoctor) throw new Error('doctor yoʻq');
    const filtered = await readData<RevenueReportDTO>(await revenueGET(makeRequest('GET', `/api/reports/revenue?${RANGE_QS}&groupBy=month&doctorId=${demoDoctor.id}`)));
    expect(filtered.totals.revenue).toBe(0);
    expect(filtered.totals.visits).toBe(0);
    const debts = await readData<DebtorsReportDTO>(await debtorsGET(makeRequest('GET', `/api/reports/debtors?${RANGE_QS}&all=1`)));
    const plusPatients = new Set((await db.patient.findMany({ where: { clinicId: clinics.lorPlus.id }, select: { id: true } })).map((p) => p.id));
    for (const r of debts.rows) expect(plusPatients.has(r.patient.id)).toBe(true);
  });

  it('export: .xlsx (Content-Disposition ASCII + UTF-8), ExcelJS oʻqiy oladi; full → 8 varaq', async () => {
    actAs('admin');
    const res = await exportGET(makeRequest('GET', `/api/reports/export?kind=revenue&${RANGE_QS}&groupBy=week&locale=ru`));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const cd = res.headers.get('content-disposition') ?? '';
    expect(cd).toContain(`attachment; filename="report-revenue-${FROM}_${TO}.xlsx"`);
    expect(cd).toContain("filename*=UTF-8''");
    expect(decodeURIComponent(cd.split("filename*=UTF-8''")[1] ?? '')).toBe(`otchet-выручка-${FROM}_${TO}.xlsx`);
    const buf = Buffer.from(await res.arrayBuffer());
    expect(Number(res.headers.get('content-length'))).toBe(buf.byteLength);
    const wb = await loadWorkbook(buf);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Выручка']);
    const ws = wb.worksheets[0];
    expect(String(ws?.getCell('A1').value)).toContain(clinics.demo.name);
    expect(ws?.getRow(4).getCell(1).value).toBe('Период');
    const periods = buildPeriods(FROM, TO, 'week');
    expect(ws?.getRow(5 + periods.length).getCell(1).value).toBe('Итого');

    const fullRes = await exportGET(makeRequest('GET', `/api/reports/export?kind=full&${RANGE_QS}&groupBy=day`));
    expect(fullRes.status).toBe(200);
    const fullWb = await loadWorkbook(await fullRes.arrayBuffer());
    expect(fullWb.worksheets).toHaveLength(8);
    expect(fullWb.worksheets[0]?.name).toBe('Xulosa');
  });

  it('debtors/remind: SmsLog PENDING yoziladi, 24 soat ichida qayta → 409, rozilik yoʻq → 400, boshqa klinika → 404', async () => {
    const doctor = users.doctor;
    if (!doctor) throw new Error('doctor yoʻq');
    const clinicId = clinics.demo.id;
    const patient = await db.patient.create({
      data: {
        clinicId,
        cardNumber: `9999-${String(Date.now()).slice(-5)}`,
        fullName: `${MARKER} Bemor`,
        birthDate: new Date('1990-01-01T00:00:00.000Z'),
        gender: 'MALE',
        phone: '+998901112233',
        smsConsent: true,
      },
      select: { id: true },
    });
    created.patientId = patient.id;
    const visit = await db.visit.create({
      data: {
        clinicId,
        patientId: patient.id,
        doctorId: doctor.id,
        status: 'COMPLETED',
        totalGross: 300_000,
        discount: 0,
        totalNet: 300_000,
        paidAmount: 100_000,
        completedAt: new Date(),
      },
      select: { id: true },
    });
    created.visitId = visit.id;

    actAs('cashier');
    const res = await remindPOST(makeRequest('POST', '/api/reports/debtors/remind', { patientId: patient.id, locale: 'uz' }));
    expect(res.status).toBe(200);
    const data = await readData<DebtReminderResultDTO>(res);
    created.smsIds.push(data.id);
    expect(data.phone).toBe('+998901112233');
    expect(data.text).toContain('200 000');
    expect(data.text).toContain(clinics.demo.name);
    expect(data.text).not.toContain('{');
    const row = await db.smsLog.findFirst({ where: { id: data.id, clinicId } });
    expect(row?.status).toBe('PENDING');
    expect(row?.kind).toBe('CUSTOM');
    expect(row?.patientId).toBe(patient.id);
    const audit = await db.auditLog.findFirst({ where: { entity: 'SmsLog', entityId: data.id } });
    expect(audit?.action).toBe('CREATE');

    // Qarzdorlar roʻyxatida oxirgi SMS vaqti koʻrinadi
    const d = await readData<DebtorsReportDTO>(await debtorsGET(makeRequest('GET', `/api/reports/debtors?${RANGE_QS}&all=1`)));
    const mine = d.rows.find((r) => r.patient.id === patient.id);
    expect(mine?.totalDebt).toBe(200_000);
    expect(mine?.lastSmsAt).toBeTruthy();

    // Takror → 409
    const again = await readError(await remindPOST(makeRequest('POST', '/api/reports/debtors/remind', { patientId: patient.id })));
    expect(again.status).toBe(409);

    // Rozilik yoʻq → 400
    await db.patient.update({ where: { id: patient.id }, data: { smsConsent: false } });
    const noConsent = await readError(await remindPOST(makeRequest('POST', '/api/reports/debtors/remind', { patientId: patient.id })));
    expect(noConsent.status).toBe(400);
    await db.patient.update({ where: { id: patient.id }, data: { smsConsent: true } });

    // Boshqa klinika → 404
    actAs('admin2');
    const other = await readError(await remindPOST(makeRequest('POST', '/api/reports/debtors/remind', { patientId: patient.id })));
    expect(other.status).toBe(404);

    // RECEPTION → 403
    actAs('reception');
    expect((await readError(await remindPOST(makeRequest('POST', '/api/reports/debtors/remind', { patientId: patient.id })))).status).toBe(403);
  });
});
