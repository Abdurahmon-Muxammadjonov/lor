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
import type { Role, Service } from '@prisma/client';
import { mockSession } from '../helpers/session';
import { makeRequest, readData, readError } from '../helpers/request';
import { calcLine, calcVisit } from '@/lib/calc';
import { roundToStep } from '@/lib/money';
import { dateKeyToDate, todayKey } from '@/lib/date';
import { GET as listGET, POST as createPOST } from '@/app/api/visits/route';
import { GET as oneGET, PATCH as onePATCH } from '@/app/api/visits/[id]/route';
import { POST as linesPOST } from '@/app/api/visits/[id]/lines/route';
import { PATCH as linePATCH, DELETE as lineDELETE } from '@/app/api/visits/[id]/lines/[lineId]/route';
import { PATCH as discountPATCH } from '@/app/api/visits/[id]/discount/route';
import { POST as completePOST } from '@/app/api/visits/[id]/complete/route';
import { POST as cancelPOST } from '@/app/api/visits/[id]/cancel/route';
import { GET as icdGET } from '@/app/api/icd10/route';
import type { Icd10Response, VisitDetailDTO, VisitListResponse } from '@/lib/visits/dto';

const HAS_DB = !!process.env.DATABASE_URL;
const dbDescribe = HAS_DB ? describe : describe.skip;

interface TestUser {
  id: string;
  login: string;
  role: Role;
  fullName: string;
  clinicId: string;
}

type PrismaModule = typeof import('@/lib/prisma');
let db: PrismaModule['prisma'];

const clinics = { demo: { id: '', roundTo: 100, childAgeLimit: 14 }, lorPlus: { id: '' } };
const users: Record<string, TestUser> = {};
const services: Record<'half' | 'whole' | 'medOnly' | 'other', Service> = {} as Record<
  'half' | 'whole' | 'medOnly' | 'other',
  Service
>;
let patientId = '';
let childPatientId = '';
const createdVisitIds: string[] = [];
let queueId = '';
let appointmentId = '';
let originalPrice: { id: string; priceAdultNoMed: string } | null = null;

function actAs(login: string) {
  const u = users[login];
  if (!u) throw new Error(`Test user ${login} topilmadi`);
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
const lineCtx = (id: string, lineId: string) => ({ params: { id, lineId } });

async function createVisit(body: Record<string, unknown>): Promise<VisitDetailDTO> {
  const res = await createPOST(makeRequest('POST', '/api/visits', body));
  expect(res.status).toBe(201);
  const v = await readData<VisitDetailDTO>(res);
  createdVisitIds.push(v.id);
  return v;
}

async function getVisit(id: string): Promise<VisitDetailDTO> {
  return readData<VisitDetailDTO>(await oneGET(makeRequest('GET', `/api/visits/${id}`), ctx(id)));
}

async function addLine(id: string, body: Record<string, unknown>): Promise<VisitDetailDTO> {
  const res = await linesPOST(makeRequest('POST', `/api/visits/${id}/lines`, body), ctx(id));
  expect(res.status).toBe(201);
  return readData<VisitDetailDTO>(res);
}

/** Kutilgan qator hisobini xizmat narxidan (Prisma Decimal → string) olish */
function expectedLine(
  svc: Service,
  input: {
    patientType: 'ADULT' | 'CHILD';
    withMedicine: boolean;
    quantity: number;
    discountType: 'NONE' | 'PERCENT' | 'FIXED';
    discountValue: number;
  },
) {
  const r = calcLine(input, {
    priceAdultNoMed: svc.priceAdultNoMed.toString(),
    priceAdultMed: svc.priceAdultMed.toString(),
    priceChildNoMed: svc.priceChildNoMed.toString(),
    priceChildMed: svc.priceChildMed.toString(),
    allowHalf: svc.allowHalf,
    medicineOptional: svc.medicineOptional,
  });
  return {
    unitPrice: r.unitPrice.toNumber(),
    gross: r.gross.toNumber(),
    discount: r.discount.toNumber(),
    net: r.net.toNumber(),
  };
}

async function cleanup() {
  if (createdVisitIds.length === 0 && !queueId && !appointmentId) return;
  const lines = await db.treatmentLine.findMany({
    where: { visitId: { in: createdVisitIds } },
    select: { id: true },
  });
  await db.payment.deleteMany({ where: { visitId: { in: createdVisitIds } } });
  await db.auditLog.deleteMany({
    where: { entityId: { in: [...createdVisitIds, ...lines.map((l) => l.id)] } },
  });
  await db.visit.deleteMany({ where: { id: { in: createdVisitIds } } });
  if (queueId) await db.queue.deleteMany({ where: { id: queueId } });
  if (appointmentId) await db.appointment.deleteMany({ where: { id: appointmentId } });
  if (originalPrice) {
    await db.service.update({
      where: { id: originalPrice.id },
      data: { priceAdultNoMed: originalPrice.priceAdultNoMed },
    });
    originalPrice = null;
  }
}

dbDescribe('visits API (DB)', () => {
  beforeAll(async () => {
    db = (await import('@/lib/prisma')).prisma;
    const rows = await db.clinic.findMany({
      where: { slug: { in: ['demo', 'lor-plus'] } },
      select: { id: true, slug: true, roundTo: true, childAgeLimit: true },
    });
    for (const c of rows) {
      if (c.slug === 'demo') clinics.demo = { id: c.id, roundTo: c.roundTo, childAgeLimit: c.childAgeLimit };
      if (c.slug === 'lor-plus') clinics.lorPlus = { id: c.id };
    }
    expect(clinics.demo.id).toBeTruthy();
    expect(clinics.lorPlus.id).toBeTruthy();

    const us = await db.user.findMany({
      where: { login: { in: ['admin', 'doctor', 'doctor2', 'reception', 'cashier', 'admin2'] } },
      select: { id: true, login: true, role: true, fullName: true, clinicId: true },
    });
    for (const u of us) users[u.login] = u;
    for (const l of ['admin', 'doctor', 'doctor2', 'reception', 'cashier', 'admin2'])
      expect(users[l], `user ${l}`).toBeTruthy();

    const clinicId = clinics.demo.id;
    const half = await db.service.findFirst({
      where: { clinicId, isActive: true, allowHalf: true, medicineOptional: true },
      orderBy: { code: 'asc' },
    });
    const whole = await db.service.findFirst({
      where: { clinicId, isActive: true, allowHalf: false, medicineOptional: true },
      orderBy: { code: 'asc' },
    });
    const medOnly = await db.service.findFirst({
      where: { clinicId, isActive: true, medicineOptional: false },
      orderBy: { code: 'asc' },
    });
    const other = await db.service.findFirst({
      where: {
        clinicId,
        isActive: true,
        allowHalf: true,
        medicineOptional: true,
        id: { not: half?.id ?? '' },
      },
      orderBy: { code: 'desc' },
    });
    expect(half && whole && medOnly && other).toBeTruthy();
    services.half = half!;
    services.whole = whole!;
    services.medOnly = medOnly!;
    services.other = other!;

    const adult = await db.patient.findFirst({
      where: { clinicId, birthDate: { lt: new Date('2000-01-01') } },
      orderBy: { cardNumber: 'asc' },
      select: { id: true },
    });
    const child = await db.patient.findFirst({
      where: { clinicId, birthDate: { gt: new Date('2016-01-01') } },
      orderBy: { cardNumber: 'asc' },
      select: { id: true },
    });
    expect(adult).toBeTruthy();
    patientId = adult!.id;
    childPatientId = child?.id ?? adult!.id;

    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await db.$disconnect();
  });

  it('DOCTOR creates a visit for a seeded patient (doctorId forced to self), RECEPTION needs doctorId', async () => {
    actAs('doctor');
    const v = await createVisit({ patientId, doctorId: users.admin!.id });
    expect(v.status).toBe('OPEN');
    expect(v.doctorId).toBe(users.doctor!.id);
    expect(v.doctor.id).toBe(users.doctor!.id);
    expect(v.patient.id).toBe(patientId);
    expect(v.lines).toEqual([]);
    expect(v.payments).toEqual([]);
    expect(v.totalNet).toBe(0);
    expect(v.clinic.roundTo).toBe(clinics.demo.roundTo);
    expect(v.clinic.childAgeLimit).toBe(clinics.demo.childAgeLimit);

    actAs('reception');
    const noDoctor = await readError(await createPOST(makeRequest('POST', '/api/visits', { patientId })));
    expect(noDoctor.status).toBe(400);
    const notDoctor = await readError(
      await createPOST(makeRequest('POST', '/api/visits', { patientId, doctorId: users.reception!.id })),
    );
    expect(notDoctor.status).toBe(404);
    const byReception = await createVisit({ patientId: childPatientId, doctorId: users.doctor2!.id });
    expect(byReception.doctorId).toBe(users.doctor2!.id);

    actAs('cashier');
    const forbidden = await readError(
      await createPOST(makeRequest('POST', '/api/visits', { patientId, doctorId: users.doctor!.id })),
    );
    expect(forbidden.status).toBe(403);
  });

  it('adds 5 different lines (adult/child, med/nomed, half qty, % and fixed) — totals match calcVisit (criterion 5)', async () => {
    actAs('doctor');
    const v = await createVisit({ patientId });
    const id = v.id;

    const inputs = [
      {
        svc: services.half,
        patientType: 'ADULT' as const,
        withMedicine: false,
        quantity: 1.5,
        discountType: 'NONE' as const,
        discountValue: 0,
      },
      {
        svc: services.half,
        patientType: 'CHILD' as const,
        withMedicine: true,
        quantity: 2,
        discountType: 'PERCENT' as const,
        discountValue: 10,
      },
      {
        svc: services.medOnly,
        patientType: 'ADULT' as const,
        withMedicine: false,
        quantity: 1,
        discountType: 'NONE' as const,
        discountValue: 0,
      },
      {
        svc: services.whole,
        patientType: 'ADULT' as const,
        withMedicine: true,
        quantity: 2,
        discountType: 'FIXED' as const,
        discountValue: 5000,
      },
      {
        svc: services.other,
        patientType: 'CHILD' as const,
        withMedicine: false,
        quantity: 0.5,
        discountType: 'PERCENT' as const,
        discountValue: 50,
      },
    ];

    let last: VisitDetailDTO | null = null;
    for (const [i, inp] of inputs.entries()) {
      last = await addLine(id, {
        serviceId: inp.svc.id,
        patientType: inp.patientType,
        withMedicine: inp.withMedicine,
        quantity: inp.quantity,
        discountType: inp.discountType,
        discountValue: inp.discountValue,
        side: i === 0 ? 'LEFT' : undefined,
        organ: i === 0 ? 'NOSE' : undefined,
        detail: i === 0 ? 'Gaymor sinusi' : undefined,
      });
      expect(last.lines).toHaveLength(i + 1);
      const line = last.lines[i]!;
      const exp = expectedLine(inp.svc, inp);
      expect(line.serviceCode).toBe(inp.svc.code);
      expect(line.serviceName).toBe(inp.svc.name);
      expect(line.unitPrice).toBe(exp.unitPrice);
      expect(line.grossTotal).toBe(exp.gross);
      expect(line.discountTotal).toBe(exp.discount);
      expect(line.lineTotal).toBe(exp.net);
      expect(line.quantity).toBe(inp.quantity);
      expect(line.order).toBe(i + 1);
      // medicineOptional=false → withMedicine majburan true, narx "dori bilan"
      if (!inp.svc.medicineOptional) {
        expect(line.withMedicine).toBe(true);
        expect(line.unitPrice).toBe(Number(inp.svc.priceAdultMed.toString()));
      }
    }
    const first = last!.lines[0]!;
    expect(first.side).toBe('LEFT');
    expect(first.organ).toBe('NOSE');
    expect(first.detail).toBe('Gaymor sinusi');
    // 1.5 × narx (criterion 1) — dorisiz kattalar narxi
    expect(first.lineTotal).toBe(
      roundToStep(Number(services.half.priceAdultNoMed.toString()) * 1.5, 1).toNumber(),
    );

    const got = await getVisit(id);
    const nets = got.lines.map((l) => l.lineTotal);
    const totals = calcVisit(nets, { type: 'NONE', value: 0 }, [], clinics.demo.roundTo);
    expect(got.totalNet).toBe(totals.total.toNumber());
    expect(got.totalGross).toBe(got.lines.reduce((a, l) => a + l.grossTotal, 0));
    expect(got.discount).toBe(got.lines.reduce((a, l) => a + l.discountTotal, 0));
    expect(got.paidAmount).toBe(0);
    expect(got.totalNet % clinics.demo.roundTo).toBe(0);

    // DB dagi qiymat ham bir xil (Decimal → butun)
    const row = await db.visit.findUniqueOrThrow({ where: { id }, select: { totalNet: true } });
    expect(Number(row.totalNet.toString())).toBe(totals.total.toNumber());
  });

  it('allowHalf=false service with 0.5 → 400 HALF_NOT_ALLOWED; 1.3 → 400 VALIDATION (criterion 4)', async () => {
    actAs('doctor');
    const v = await createVisit({ patientId });
    const half = await readError(
      await linesPOST(
        makeRequest('POST', `/api/visits/${v.id}/lines`, {
          serviceId: services.whole.id,
          patientType: 'ADULT',
          withMedicine: true,
          quantity: 0.5,
        }),
        ctx(v.id),
      ),
    );
    expect(half.status).toBe(400);
    expect(half.code).toBe('HALF_NOT_ALLOWED');

    const bad = await readError(
      await linesPOST(
        makeRequest('POST', `/api/visits/${v.id}/lines`, {
          serviceId: services.half.id,
          patientType: 'ADULT',
          withMedicine: true,
          quantity: 1.3,
        }),
        ctx(v.id),
      ),
    );
    expect(bad.status).toBe(400);
    expect(bad.code).toBe('VALIDATION');

    const pct = await readError(
      await linesPOST(
        makeRequest('POST', `/api/visits/${v.id}/lines`, {
          serviceId: services.half.id,
          patientType: 'ADULT',
          withMedicine: true,
          quantity: 1,
          discountType: 'PERCENT',
          discountValue: 150,
        }),
        ctx(v.id),
      ),
    );
    expect(pct.status).toBe(400);

    const unknown = await readError(
      await linesPOST(
        makeRequest('POST', `/api/visits/${v.id}/lines`, {
          serviceId: 'nope',
          patientType: 'ADULT',
          withMedicine: true,
          quantity: 1,
        }),
        ctx(v.id),
      ),
    );
    expect(unknown.status).toBe(404);

    const after = await getVisit(v.id);
    expect(after.lines).toHaveLength(0);
    expect(after.totalNet).toBe(0);
  });

  it('global discount (% and fixed) recalculates totalNet with clinic rounding (criterion 6)', async () => {
    actAs('doctor');
    const v = await createVisit({ patientId });
    await addLine(v.id, {
      serviceId: services.half.id,
      patientType: 'ADULT',
      withMedicine: false,
      quantity: 1.5,
    });
    await addLine(v.id, {
      serviceId: services.other.id,
      patientType: 'ADULT',
      withMedicine: true,
      quantity: 1,
    });

    const pct = await readData<VisitDetailDTO>(
      await discountPATCH(
        makeRequest('PATCH', `/api/visits/${v.id}/discount`, { type: 'PERCENT', value: 10 }),
        ctx(v.id),
      ),
    );
    const nets = pct.lines.map((l) => l.lineTotal);
    const expPct = calcVisit(nets, { type: 'PERCENT', value: 10 }, [], clinics.demo.roundTo);
    expect(pct.globalDiscountType).toBe('PERCENT');
    expect(pct.globalDiscountValue).toBe(10);
    expect(pct.totalNet).toBe(expPct.total.toNumber());
    expect(pct.discount).toBe(
      expPct.globalDiscount.toNumber() + pct.lines.reduce((a, l) => a + l.discountTotal, 0),
    );

    const fixed = await readData<VisitDetailDTO>(
      await discountPATCH(
        makeRequest('PATCH', `/api/visits/${v.id}/discount`, { type: 'FIXED', value: 7350 }),
        ctx(v.id),
      ),
    );
    const expFixed = calcVisit(nets, { type: 'FIXED', value: 7350 }, [], clinics.demo.roundTo);
    expect(fixed.totalNet).toBe(expFixed.total.toNumber());
    expect(fixed.totalNet % clinics.demo.roundTo).toBe(0);

    const none = await readData<VisitDetailDTO>(
      await discountPATCH(
        makeRequest('PATCH', `/api/visits/${v.id}/discount`, { type: 'NONE', value: 999 }),
        ctx(v.id),
      ),
    );
    expect(none.globalDiscountValue).toBe(0);
    expect(none.totalNet).toBe(
      calcVisit(nets, { type: 'NONE', value: 0 }, [], clinics.demo.roundTo).total.toNumber(),
    );

    const over = await readError(
      await discountPATCH(
        makeRequest('PATCH', `/api/visits/${v.id}/discount`, { type: 'PERCENT', value: 101 }),
        ctx(v.id),
      ),
    );
    expect(over.status).toBe(400);
  });

  it('service price change does not alter an existing visit (snapshot, criterion 10)', async () => {
    actAs('doctor');
    const v = await createVisit({ patientId });
    const withLine = await addLine(v.id, {
      serviceId: services.half.id,
      patientType: 'ADULT',
      withMedicine: false,
      quantity: 1.5,
    });
    const before = await getVisit(v.id);

    // Xizmatlar moduli narxni oʻzgartirdi (toʻgʻridan-toʻgʻri prisma orqali)
    originalPrice = { id: services.half.id, priceAdultNoMed: services.half.priceAdultNoMed.toString() };
    await db.service.update({
      where: { id: services.half.id },
      data: { priceAdultNoMed: Number(originalPrice.priceAdultNoMed) + 10_000 },
    });

    const after = await getVisit(v.id);
    expect(after.totalNet).toBe(before.totalNet);
    expect(after.lines[0]!.unitPrice).toBe(withLine.lines[0]!.unitPrice);
    expect(after.lines[0]!.lineTotal).toBe(withLine.lines[0]!.lineTotal);

    // Yangi qabulda esa yangi narx ishlaydi
    const fresh = await createVisit({ patientId });
    const freshLine = await addLine(fresh.id, {
      serviceId: services.half.id,
      patientType: 'ADULT',
      withMedicine: false,
      quantity: 1,
    });
    expect(freshLine.lines[0]!.unitPrice).toBe(Number(originalPrice.priceAdultNoMed) + 10_000);

    await db.service.update({
      where: { id: services.half.id },
      data: { priceAdultNoMed: originalPrice.priceAdultNoMed },
    });
    originalPrice = null;
  });

  it('PATCH/DELETE line recalculates; PATCH clinical fields; audit rows are written', async () => {
    actAs('doctor');
    const v = await createVisit({ patientId });
    const a = await addLine(v.id, {
      serviceId: services.half.id,
      patientType: 'ADULT',
      withMedicine: false,
      quantity: 1,
    });
    const b = await addLine(v.id, {
      serviceId: services.other.id,
      patientType: 'ADULT',
      withMedicine: false,
      quantity: 1,
    });
    const lineA = a.lines[0]!;

    const upd = await readData<VisitDetailDTO>(
      await linePATCH(
        makeRequest('PATCH', `/api/visits/${v.id}/lines/${lineA.id}`, {
          quantity: 2.5,
          patientType: 'CHILD',
          side: 'BOTH',
        }),
        lineCtx(v.id, lineA.id),
      ),
    );
    const updated = upd.lines.find((l) => l.id === lineA.id)!;
    const exp = expectedLine(services.half, {
      patientType: 'CHILD',
      withMedicine: false,
      quantity: 2.5,
      discountType: 'NONE',
      discountValue: 0,
    });
    expect(updated.lineTotal).toBe(exp.net);
    expect(updated.patientType).toBe('CHILD');
    expect(updated.side).toBe('BOTH');
    expect(upd.totalNet).toBe(
      calcVisit(
        upd.lines.map((l) => l.lineTotal),
        { type: 'NONE', value: 0 },
        [],
        clinics.demo.roundTo,
      ).total.toNumber(),
    );

    const halfErr = await readError(
      await linePATCH(
        makeRequest('PATCH', `/api/visits/${v.id}/lines/${lineA.id}`, {
          serviceId: services.whole.id,
          quantity: 1.5,
        }),
        lineCtx(v.id, lineA.id),
      ),
    );
    expect(halfErr.code).toBe('HALF_NOT_ALLOWED');

    const del = await readData<VisitDetailDTO>(
      await lineDELETE(
        makeRequest('DELETE', `/api/visits/${v.id}/lines/${lineA.id}`),
        lineCtx(v.id, lineA.id),
      ),
    );
    expect(del.lines).toHaveLength(1);
    expect(del.lines[0]!.id).toBe(b.lines[1]!.id);
    expect(del.totalNet).toBe(
      calcVisit(
        [del.lines[0]!.lineTotal],
        { type: 'NONE', value: 0 },
        [],
        clinics.demo.roundTo,
      ).total.toNumber(),
    );

    const missing = await readError(
      await lineDELETE(
        makeRequest('DELETE', `/api/visits/${v.id}/lines/${lineA.id}`),
        lineCtx(v.id, lineA.id),
      ),
    );
    expect(missing.status).toBe(404);

    const clinical = await readData<VisitDetailDTO>(
      await onePATCH(
        makeRequest('PATCH', `/api/visits/${v.id}`, {
          complaint: 'Burun bitishi <b>3 kun</b>',
          icd10: 'j01.0',
          diagnosis: 'Oʻtkir gaymorit',
          plan: 'Burun yuvish ×3',
        }),
        ctx(v.id),
      ),
    );
    expect(clinical.complaint).toBe('Burun bitishi 3 kun');
    expect(clinical.icd10).toBe('J01.0');
    expect(clinical.diagnosis).toBe('Oʻtkir gaymorit');
    const badIcd = await readError(
      await onePATCH(makeRequest('PATCH', `/api/visits/${v.id}`, { icd10: 'nope' }), ctx(v.id)),
    );
    expect(badIcd.status).toBe(400);
    const cleared = await readData<VisitDetailDTO>(
      await onePATCH(makeRequest('PATCH', `/api/visits/${v.id}`, { icd10: '' }), ctx(v.id)),
    );
    expect(cleared.icd10).toBeNull();

    const audits = await db.auditLog.findMany({
      where: { entityId: { in: [v.id, lineA.id] } },
      select: { action: true, entity: true },
    });
    expect(audits.some((x) => x.entity === 'Visit' && x.action === 'CREATE')).toBe(true);
    expect(audits.some((x) => x.entity === 'TreatmentLine' && x.action === 'CREATE')).toBe(true);
    expect(audits.some((x) => x.entity === 'TreatmentLine' && x.action === 'UPDATE')).toBe(true);
    expect(audits.some((x) => x.entity === 'TreatmentLine' && x.action === 'DELETE')).toBe(true);
  });

  it('RECEPTION/CASHIER get 403 on writes but can read; other clinic gets 404', async () => {
    actAs('doctor');
    const v = await createVisit({ patientId });

    actAs('reception');
    const post = await readError(
      await linesPOST(
        makeRequest('POST', `/api/visits/${v.id}/lines`, {
          serviceId: services.half.id,
          patientType: 'ADULT',
          withMedicine: true,
          quantity: 1,
        }),
        ctx(v.id),
      ),
    );
    expect(post.status).toBe(403);
    expect(post.code).toBe('FORBIDDEN');
    const read = await getVisit(v.id);
    expect(read.id).toBe(v.id);

    actAs('cashier');
    expect(
      (
        await readError(
          await onePATCH(makeRequest('PATCH', `/api/visits/${v.id}`, { complaint: 'x' }), ctx(v.id)),
        )
      ).status,
    ).toBe(403);
    expect(
      (await readError(await completePOST(makeRequest('POST', `/api/visits/${v.id}/complete`), ctx(v.id))))
        .status,
    ).toBe(403);
    expect(
      (
        await readError(
          await discountPATCH(
            makeRequest('PATCH', `/api/visits/${v.id}/discount`, { type: 'NONE' }),
            ctx(v.id),
          ),
        )
      ).status,
    ).toBe(403);

    actAs('admin2');
    expect((await readError(await oneGET(makeRequest('GET', `/api/visits/${v.id}`), ctx(v.id)))).status).toBe(
      404,
    );
    expect(
      (
        await readError(
          await linesPOST(
            makeRequest('POST', `/api/visits/${v.id}/lines`, {
              serviceId: services.half.id,
              patientType: 'ADULT',
              withMedicine: true,
              quantity: 1,
            }),
            ctx(v.id),
          ),
        )
      ).status,
    ).toBe(404);
    expect(
      (await readError(await completePOST(makeRequest('POST', `/api/visits/${v.id}/complete`), ctx(v.id))))
        .status,
    ).toBe(404);
    // Boshqa klinika bemori / xizmati bilan qabul ochib boʻlmaydi
    expect(
      (
        await readError(
          await createPOST(makeRequest('POST', '/api/visits', { patientId, doctorId: users.doctor!.id })),
        )
      ).status,
    ).toBe(404);
  });

  it('complete: requires ≥1 line, sets COMPLETED + completedAt, closes queue/appointment; lines on completed → 409 VISIT_CLOSED', async () => {
    actAs('doctor');
    const dateKey = todayKey();
    const queue = await db.queue.create({
      data: {
        clinicId: clinics.demo.id,
        date: dateKeyToDate(dateKey),
        number: 'Z-999',
        prefix: 'Z',
        seq: 999,
        type: 'DOCTOR',
        status: 'CALLED',
        patientId,
        doctorId: users.doctor!.id,
      },
      select: { id: true },
    });
    queueId = queue.id;
    const now = new Date();
    const appt = await db.appointment.create({
      data: {
        clinicId: clinics.demo.id,
        patientId,
        doctorId: users.doctor!.id,
        startAt: now,
        endAt: new Date(now.getTime() + 20 * 60_000),
        status: 'CONFIRMED',
        note: 'ZZTEST visits',
      },
      select: { id: true },
    });
    appointmentId = appt.id;

    const v = await createVisit({ patientId, queueId, appointmentId });
    expect(v.queue?.id).toBe(queueId);
    expect(v.queue?.status).toBe('SERVING');
    expect(v.appointment?.status).toBe('ARRIVED');

    // Xuddi shu talon bilan ikkinchi qabul → 409
    const dup = await readError(await createPOST(makeRequest('POST', '/api/visits', { patientId, queueId })));
    expect(dup.status).toBe(409);

    const empty = await readError(
      await completePOST(makeRequest('POST', `/api/visits/${v.id}/complete`), ctx(v.id)),
    );
    expect(empty.status).toBe(409);
    expect(empty.code).toBe('CONFLICT');

    await addLine(v.id, {
      serviceId: services.half.id,
      patientType: 'ADULT',
      withMedicine: true,
      quantity: 1,
    });
    const done = await readData<VisitDetailDTO>(
      await completePOST(makeRequest('POST', `/api/visits/${v.id}/complete`), ctx(v.id)),
    );
    expect(done.status).toBe('COMPLETED');
    expect(done.completedAt).toBeTruthy();
    expect(done.queue?.status).toBe('DONE');
    expect(done.appointment?.status).toBe('DONE');

    const closed = await readError(
      await linesPOST(
        makeRequest('POST', `/api/visits/${v.id}/lines`, {
          serviceId: services.half.id,
          patientType: 'ADULT',
          withMedicine: true,
          quantity: 1,
        }),
        ctx(v.id),
      ),
    );
    expect(closed.status).toBe(409);
    expect(closed.code).toBe('VISIT_CLOSED');
    expect(
      (
        await readError(
          await discountPATCH(
            makeRequest('PATCH', `/api/visits/${v.id}/discount`, { type: 'PERCENT', value: 5 }),
            ctx(v.id),
          ),
        )
      ).code,
    ).toBe('VISIT_CLOSED');
    expect(
      (await readError(await onePATCH(makeRequest('PATCH', `/api/visits/${v.id}`, { plan: 'x' }), ctx(v.id))))
        .code,
    ).toBe('VISIT_CLOSED');
    expect(
      (await readError(await completePOST(makeRequest('POST', `/api/visits/${v.id}/complete`), ctx(v.id))))
        .code,
    ).toBe('VISIT_CLOSED');
    expect(
      (await readError(await cancelPOST(makeRequest('POST', `/api/visits/${v.id}/cancel`), ctx(v.id)))).code,
    ).toBe('VISIT_CLOSED');
    const lineId = done.lines[0]!.id;
    expect(
      (
        await readError(
          await lineDELETE(
            makeRequest('DELETE', `/api/visits/${v.id}/lines/${lineId}`),
            lineCtx(v.id, lineId),
          ),
        )
      ).code,
    ).toBe('VISIT_CLOSED');

    const audit = await db.auditLog.findFirst({ where: { entityId: v.id, action: 'VISIT_COMPLETE' } });
    expect(audit).toBeTruthy();
  });

  it('cancel: only unpaid visits; paid → 409 HAS_PAYMENTS', async () => {
    actAs('doctor');
    const v = await createVisit({ patientId });
    await addLine(v.id, {
      serviceId: services.half.id,
      patientType: 'ADULT',
      withMedicine: true,
      quantity: 1,
    });
    await db.payment.create({
      data: {
        clinicId: clinics.demo.id,
        visitId: v.id,
        amount: 10_000,
        method: 'CASH',
        cashierId: users.cashier!.id,
        note: 'ZZTEST',
      },
    });
    const paid = await readError(
      await cancelPOST(makeRequest('POST', `/api/visits/${v.id}/cancel`), ctx(v.id)),
    );
    expect(paid.status).toBe(409);
    expect((paid.details as { reason?: string } | undefined)?.reason).toBe('HAS_PAYMENTS');
    await db.payment.deleteMany({ where: { visitId: v.id } });

    const cancelled = await readData<VisitDetailDTO>(
      await cancelPOST(makeRequest('POST', `/api/visits/${v.id}/cancel`), ctx(v.id)),
    );
    expect(cancelled.status).toBe('CANCELLED');
    expect(
      (await readError(await cancelPOST(makeRequest('POST', `/api/visits/${v.id}/cancel`), ctx(v.id)))).code,
    ).toBe('VISIT_CLOSED');

    actAs('reception');
    const v2 = await createVisit({ patientId, doctorId: users.doctor!.id });
    expect(
      (await readError(await cancelPOST(makeRequest('POST', `/api/visits/${v2.id}/cancel`), ctx(v2.id))))
        .status,
    ).toBe(403);
  });

  it('GET /api/visits lists with filters and pagination; GET /api/icd10 searches', async () => {
    actAs('admin');
    const today = todayKey();
    const list = await readData<VisitListResponse>(
      await listGET(
        makeRequest('GET', `/api/visits?from=${today}&to=${today}&doctorId=${users.doctor!.id}&pageSize=100`),
      ),
    );
    expect(list.page).toBe(1);
    expect(list.pageSize).toBe(100);
    expect(list.items.every((v) => v.doctor.id === users.doctor!.id)).toBe(true);
    const mine = list.items.filter((v) => createdVisitIds.includes(v.id));
    expect(mine.length).toBeGreaterThan(0);
    for (const v of mine) {
      expect(typeof v.linesCount).toBe('number');
      expect(v.patient.cardNumber).toMatch(/^\d{4}-\d{5}$/);
    }

    const open = await readData<VisitListResponse>(
      await listGET(makeRequest('GET', `/api/visits?from=${today}&to=${today}&status=OPEN&pageSize=5`)),
    );
    expect(open.items.every((v) => v.status === 'OPEN')).toBe(true);
    expect(open.items.length).toBeLessThanOrEqual(5);

    expect((await readError(await listGET(makeRequest('GET', '/api/visits?status=DONE')))).status).toBe(400);
    expect((await readError(await listGET(makeRequest('GET', '/api/visits?from=15.09.2026')))).status).toBe(
      400,
    );

    actAs('admin2');
    const other = await readData<VisitListResponse>(
      await listGET(makeRequest('GET', `/api/visits?from=${today}&to=${today}&pageSize=200`)),
    );
    expect(other.items.some((v) => createdVisitIds.includes(v.id))).toBe(false);

    actAs('cashier');
    const icd = await readData<Icd10Response>(await icdGET(makeRequest('GET', '/api/icd10?q=H66&limit=5')));
    expect(icd.items.length).toBeGreaterThan(0);
    expect(icd.items.length).toBeLessThanOrEqual(5);
    expect(icd.items[0]!.code.startsWith('H66')).toBe(true);
    const all = await readData<Icd10Response>(await icdGET(makeRequest('GET', '/api/icd10')));
    expect(all.items).toHaveLength(20);
  });
});
