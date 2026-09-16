import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { NextRequest } from 'next/server';

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
import { makeRequest, readData, readError, readJson } from '../helpers/request';
import { GET as listGET, POST as createPOST } from '@/app/api/patients/route';
import { GET as searchGET } from '@/app/api/patients/search/route';
import { GET as exportGET } from '@/app/api/patients/export/route';
import { GET as oneGET, PATCH as onePATCH, DELETE as oneDELETE } from '@/app/api/patients/[id]/route';
import { GET as visitsGET } from '@/app/api/patients/[id]/visits/route';
import { GET as paymentsGET } from '@/app/api/patients/[id]/payments/route';
import { GET as appointmentsGET } from '@/app/api/patients/[id]/appointments/route';
import type {
  PatientAppointmentsResponse,
  PatientDTO,
  PatientListResponse,
  PatientPaymentsResponse,
  PatientRowDTO,
  PatientSearchResponse,
  PatientVisitsResponse,
} from '@/lib/patients/types';

const HAS_DB = !!process.env.DATABASE_URL;
const dbDescribe = HAS_DB ? describe : describe.skip;

// Marker faylga xos boʻlishi shart: `cleanup()` va `?q=` qidiruvi `contains`/ILIKE bilan ishlaydi,
// shuning uchun 'ZZTEST' boshqa fayllar markerlariga (masalan 'ZZTEST-CASHIER') ham tushib ketardi.
const MARKER = 'ZZTEST-PATIENTS';
const PHONE_A = '+998997001101';
const PHONE_B = '+998997001102';
const PHONE_C = '+998997001103';

interface TestUser {
  id: string;
  login: string;
  role: Role;
  fullName: string;
  clinicId: string;
}

// prisma faqat DB mavjud boʻlganda import qilinadi (skip holatida ulanish ochilmaydi)
type PrismaModule = typeof import('@/lib/prisma');
let db: PrismaModule['prisma'];

const clinics: Record<'demo' | 'lorPlus', { id: string; slug: string; childAgeLimit: number }> = {
  demo: { id: '', slug: 'demo', childAgeLimit: 14 },
  lorPlus: { id: '', slug: 'lor-plus', childAgeLimit: 12 },
};
const users: Record<string, TestUser> = {};
const createdIds: string[] = [];

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

async function createPatient(body: Record<string, unknown>) {
  const res = await createPOST(makeRequest('POST', '/api/patients', body));
  return res;
}

const basePatient = {
  fullName: `Oʻktamov Sherzod ${MARKER}`,
  birthDate: '1990-05-20',
  gender: 'MALE',
  phone: PHONE_A,
  address: 'Toshkent',
  smsConsent: true,
};

async function cleanup() {
  const rows = await db.patient.findMany({
    where: { fullName: { contains: MARKER } },
    select: { id: true },
  });
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return;
  await db.appointment.deleteMany({ where: { patientId: { in: ids } } });
  await db.queue.updateMany({ where: { patientId: { in: ids } }, data: { patientId: null } });
  await db.smsLog.deleteMany({ where: { patientId: { in: ids } } });
  await db.auditLog.deleteMany({ where: { entity: 'Patient', entityId: { in: ids } } });
  await db.patient.deleteMany({ where: { id: { in: ids } } });
}

dbDescribe('patients API (DB)', () => {
  beforeAll(async () => {
    db = (await import('@/lib/prisma')).prisma;
    const rows = await db.clinic.findMany({
      where: { slug: { in: ['demo', 'lor-plus'] } },
      select: { id: true, slug: true, childAgeLimit: true },
    });
    for (const c of rows) {
      if (c.slug === 'demo') clinics.demo = c;
      if (c.slug === 'lor-plus') clinics.lorPlus = c;
    }
    expect(clinics.demo.id).toBeTruthy();
    expect(clinics.lorPlus.id).toBeTruthy();
    const us = await db.user.findMany({
      where: { login: { in: ['admin', 'doctor', 'reception', 'cashier', 'admin2'] } },
      select: { id: true, login: true, role: true, fullName: true, clinicId: true },
    });
    for (const u of us) users[u.login] = u;
    for (const l of ['admin', 'doctor', 'reception', 'cashier', 'admin2'])
      expect(users[l], `seed user ${l}`).toBeTruthy();
    await cleanup();
  });

  afterAll(async () => {
    if (!db) return;
    await cleanup();
    await db.$disconnect();
  });

  let patientA: PatientRowDTO;
  let patientB: PatientRowDTO;

  it('POST yaratadi: karta raqami YYYY-NNNNN va ketma-ket', async () => {
    actAs('reception');
    const res1 = await createPatient(basePatient);
    expect(res1.status).toBe(201);
    patientA = await readData<PatientRowDTO>(res1);
    createdIds.push(patientA.id);
    const year = new Date().getFullYear();
    expect(patientA.cardNumber).toMatch(/^\d{4}-\d{5}$/);
    expect(patientA.cardNumber.startsWith(`${year}-`)).toBe(true);
    expect(patientA.phone).toBe(PHONE_A);
    expect(patientA.birthDate.slice(0, 10)).toBe('1990-05-20');
    expect(patientA.clinicId).toBe(clinics.demo.id);

    const res2 = await createPatient({
      ...basePatient,
      fullName: `Karimova Nodira ${MARKER}`,
      gender: 'FEMALE',
      phone: PHONE_B,
      birthDate: '20.03.2018',
    });
    expect(res2.status).toBe(201);
    patientB = await readData<PatientRowDTO>(res2);
    createdIds.push(patientB.id);
    const seqA = Number(patientA.cardNumber.split('-')[1]);
    const seqB = Number(patientB.cardNumber.split('-')[1]);
    expect(seqB).toBe(seqA + 1);
    expect(patientB.birthDate.slice(0, 10)).toBe('2018-03-20');

    const auditRow = await db.auditLog.findFirst({
      where: { entity: 'Patient', entityId: patientA.id, action: 'CREATE' },
    });
    expect(auditRow).toBeTruthy();
  });

  it('parallel yaratishda karta raqamlari takrorlanmaydi (advisory lock)', async () => {
    actAs('admin');
    const results = await Promise.all(
      [1, 2, 3, 4].map((i) =>
        createPatient({
          ...basePatient,
          fullName: `Parallel ${i} ${MARKER}`,
          phone: `+99899700120${i}`,
          force: true,
        }),
      ),
    );
    const rows = await Promise.all(results.map((r) => readData<PatientRowDTO>(r)));
    rows.forEach((r) => createdIds.push(r.id));
    const cards = new Set(rows.map((r) => r.cardNumber));
    expect(cards.size).toBe(4);
  });

  it('takroriy telefon → 409 CONFLICT (existingId), force=true → 201', async () => {
    actAs('reception');
    const dup = await createPatient({ ...basePatient, fullName: `Dublikat Bemor ${MARKER}` });
    const err = await readError(dup);
    expect(err.status).toBe(409);
    expect(err.code).toBe('CONFLICT');
    const details = err.details as { existingId: string; existingName: string; existingCard: string };
    expect(details.existingId).toBe(patientA.id);
    expect(details.existingCard).toBe(patientA.cardNumber);

    const forced = await createPatient({ ...basePatient, fullName: `Dublikat Bemor ${MARKER}`, force: true });
    expect(forced.status).toBe(201);
    const row = await readData<PatientRowDTO>(forced);
    createdIds.push(row.id);
    expect(row.phone).toBe(PHONE_A);
  });

  it('validatsiya: kelajakdagi sana, qisqa ism, notoʻgʻri telefon → 400', async () => {
    actAs('reception');
    const future = await createPatient({ ...basePatient, birthDate: '2099-01-01', phone: PHONE_C });
    expect((await readError(future)).code).toBe('VALIDATION');
    const short = await createPatient({ ...basePatient, fullName: 'Ab', phone: PHONE_C });
    expect((await readError(short)).status).toBe(400);
    const badPhone = await createPatient({ ...basePatient, phone: '12' });
    expect((await readError(badPhone)).status).toBe(400);
    const badJson = await createPOST(makeRequest('POST', '/api/patients', '{bad json'));
    expect((await readError(badJson)).code).toBe('VALIDATION');
  });

  it('CASHIER yarata olmaydi (403)', async () => {
    actAs('cashier');
    const res = await createPatient({ ...basePatient, phone: PHONE_C });
    expect((await readError(res)).status).toBe(403);
  });

  it('search: apostrofsiz ism ("oktam" → "Oʻktamov"), telefon raqamlari, karta raqami', async () => {
    actAs('doctor');
    const byName = await readData<PatientSearchResponse>(
      await searchGET(makeRequest('GET', '/api/patients/search?q=oktam%20zztest')),
    );
    expect(byName.items.some((i) => i.id === patientA.id)).toBe(true);
    const first = byName.items[0];
    expect(first).toBeDefined();
    expect(Object.keys(first ?? {}).sort()).toEqual([
      'birthDate',
      'cardNumber',
      'fullName',
      'gender',
      'id',
      'phone',
    ]);

    const byApos = await readData<PatientSearchResponse>(
      await searchGET(makeRequest('GET', "/api/patients/search?q=o'ktamov")),
    );
    expect(byApos.items.some((i) => i.id === patientA.id)).toBe(true);

    const byPhone = await readData<PatientSearchResponse>(
      await searchGET(makeRequest('GET', '/api/patients/search?q=99%20700%2011%2001')),
    );
    expect(byPhone.items.some((i) => i.id === patientA.id)).toBe(true);

    const byCard = await readData<PatientSearchResponse>(
      await searchGET(
        makeRequest('GET', `/api/patients/search?q=${encodeURIComponent(patientB.cardNumber)}`),
      ),
    );
    expect(byCard.items[0]?.id).toBe(patientB.id);

    const limited = await readData<PatientSearchResponse>(
      await searchGET(makeRequest('GET', '/api/patients/search?q=&limit=3')),
    );
    expect(limited.items.length).toBeLessThanOrEqual(3);
  });

  it('GET roʻyxat: q, type=CHILD, gender, hasDebt, sahifalash', async () => {
    actAs('reception');
    const all = await readData<PatientListResponse>(
      await listGET(makeRequest('GET', `/api/patients?q=${MARKER}&pageSize=50`)),
    );
    expect(all.total).toBeGreaterThanOrEqual(2);
    const a = all.items.find((i) => i.id === patientA.id);
    expect(a).toBeDefined();
    expect(a?.patientType).toBe('ADULT');
    expect(a?.visitsCount).toBe(0);
    expect(a?.lastVisitAt).toBeNull();
    expect(a?.debt).toBe(0);
    expect(typeof a?.age).toBe('number');

    const children = await readData<PatientListResponse>(
      await listGET(makeRequest('GET', `/api/patients?q=${MARKER}&type=CHILD&pageSize=50`)),
    );
    expect(children.items.some((i) => i.id === patientB.id)).toBe(true);
    expect(children.items.every((i) => i.patientType === 'CHILD')).toBe(true);

    const females = await readData<PatientListResponse>(
      await listGET(makeRequest('GET', `/api/patients?q=${MARKER}&gender=FEMALE&pageSize=50`)),
    );
    expect(females.items.every((i) => i.gender === 'FEMALE')).toBe(true);
    expect(females.items.some((i) => i.id === patientB.id)).toBe(true);

    const debtors = await readData<PatientListResponse>(
      await listGET(makeRequest('GET', '/api/patients?hasDebt=1&pageSize=5')),
    );
    expect(debtors.items.every((i) => i.debt > 0)).toBe(true);

    const byLast = await readData<PatientListResponse>(
      await listGET(makeRequest('GET', '/api/patients?sort=lastVisit&pageSize=5')),
    );
    expect(byLast.items[0]?.lastVisitAt).toBeTruthy();

    const page2 = await readData<PatientListResponse>(
      await listGET(makeRequest('GET', '/api/patients?page=2&pageSize=5')),
    );
    expect(page2.page).toBe(2);
    expect(page2.pageSize).toBe(5);
    expect(page2.items.length).toBeLessThanOrEqual(5);
  });

  it('GET /api/patients/[id] — agregatlar bilan; boshqa klinika koʻra olmaydi (404)', async () => {
    actAs('cashier');
    const res = await oneGET(makeRequest('GET', `/api/patients/${patientA.id}`), ctx(patientA.id));
    const p = await readData<PatientDTO>(res);
    expect(p.id).toBe(patientA.id);
    expect(p.stats).toEqual({
      visits: 0,
      openVisits: 0,
      lastVisitAt: null,
      totalNet: 0,
      totalPaid: 0,
      debt: 0,
    });
    expect(p.lastVisit).toBeNull();
    expect(p.patientType).toBe('ADULT');

    // Tashriflari bor demo bemor — agregatlar musbat
    const withVisits = await db.visit.findFirst({
      where: { clinicId: clinics.demo.id, status: 'COMPLETED' },
      select: { patientId: true },
    });
    expect(withVisits).toBeTruthy();
    const seeded = await readData<PatientDTO>(
      await oneGET(makeRequest('GET', `/api/patients/${withVisits!.patientId}`), ctx(withVisits!.patientId)),
    );
    expect(seeded.stats.visits).toBeGreaterThan(0);
    expect(seeded.stats.totalPaid).toBeGreaterThanOrEqual(0);
    expect(seeded.lastVisit?.doctor.fullName).toBeTruthy();
    expect(typeof seeded.stats.totalNet).toBe('number');

    actAs('admin2');
    const other = await oneGET(makeRequest('GET', `/api/patients/${patientA.id}`), ctx(patientA.id));
    expect((await readError(other)).status).toBe(404);
    const otherList = await readData<PatientListResponse>(
      await listGET(makeRequest('GET', `/api/patients?q=${MARKER}`)),
    );
    expect(otherList.total).toBe(0);
  });

  it('PATCH: DOCTOR oʻzgartira oladi (audit UPDATE), CASHIER — 403; telefon ziddiyati → 409', async () => {
    actAs('doctor');
    const res = await onePATCH(
      makeRequest('PATCH', `/api/patients/${patientA.id}`, {
        allergies: 'Penitsillin',
        address: null,
        smsConsent: false,
      }),
      ctx(patientA.id),
    );
    const updated = await readData<PatientRowDTO>(res);
    expect(updated.allergies).toBe('Penitsillin');
    expect(updated.address).toBeNull();
    expect(updated.smsConsent).toBe(false);
    const auditRow = await db.auditLog.findFirst({
      where: { entity: 'Patient', entityId: patientA.id, action: 'UPDATE' },
      orderBy: { createdAt: 'desc' },
    });
    expect(auditRow).toBeTruthy();
    const before = auditRow?.before as Record<string, unknown>;
    const after = auditRow?.after as Record<string, unknown>;
    expect(before.allergies).toBeNull();
    expect(after.allergies).toBe('Penitsillin');
    expect(after.smsConsent).toBe(false);

    const conflict = await onePATCH(
      makeRequest('PATCH', `/api/patients/${patientA.id}`, { phone: PHONE_B }),
      ctx(patientA.id),
    );
    expect((await readError(conflict)).status).toBe(409);
    const forced = await onePATCH(
      makeRequest('PATCH', `/api/patients/${patientA.id}`, { phone: '99 700 11 01', force: true }),
      ctx(patientA.id),
    );
    expect((await readData<PatientRowDTO>(forced)).phone).toBe(PHONE_A);

    const empty = await onePATCH(makeRequest('PATCH', `/api/patients/${patientA.id}`, {}), ctx(patientA.id));
    expect((await readError(empty)).status).toBe(400);

    actAs('cashier');
    const denied = await onePATCH(
      makeRequest('PATCH', `/api/patients/${patientA.id}`, { notes: 'x' }),
      ctx(patientA.id),
    );
    expect((await readError(denied)).status).toBe(403);

    actAs('admin2');
    const foreign = await onePATCH(
      makeRequest('PATCH', `/api/patients/${patientA.id}`, { notes: 'x' }),
      ctx(patientA.id),
    );
    expect((await readError(foreign)).status).toBe(404);
  });

  it('bemor tarixi: visits (qatorlar snapshot + toʻlovlar), payments (balans), appointments', async () => {
    actAs('doctor');
    const visit = await db.visit.findFirst({
      where: { clinicId: clinics.demo.id, status: 'COMPLETED', lines: { some: {} }, payments: { some: {} } },
      select: { patientId: true, id: true },
    });
    expect(visit).toBeTruthy();
    const pid = visit!.patientId;

    const visits = await readData<PatientVisitsResponse>(
      await visitsGET(makeRequest('GET', `/api/patients/${pid}/visits?pageSize=5`), ctx(pid)),
    );
    expect(visits.total).toBeGreaterThan(0);
    expect(visits.items.length).toBeLessThanOrEqual(5);
    const v = visits.items[0]!;
    expect(v.doctor.fullName).toBeTruthy();
    expect(Array.isArray(v.lines)).toBe(true);
    expect(typeof v.totalNet).toBe('number');
    expect(typeof v.payments.paid).toBe('number');
    expect(v.balance).toBe(v.totalNet - v.paidAmount);
    const withLines = visits.items.find((x) => x.lines.length > 0);
    if (withLines) {
      const line = withLines.lines[0]!;
      expect(line.serviceName).toBeTruthy();
      expect(typeof line.lineTotal).toBe('number');
      expect(typeof line.quantity).toBe('number');
    }

    const payments = await readData<PatientPaymentsResponse>(
      await paymentsGET(makeRequest('GET', `/api/patients/${pid}/payments`), ctx(pid)),
    );
    expect(payments.items.length).toBeGreaterThan(0);
    expect(payments.items[0]!.cashier.fullName).toBeTruthy();
    expect(payments.items[0]!.visit.doctor.fullName).toBeTruthy();
    expect(payments.summary.totalNet - payments.summary.totalPaid).toBe(payments.summary.debt);
    expect(payments.debts.every((d) => d.balance > 0)).toBe(true);
    expect(payments.summary.debtVisits).toBe(payments.debts.length);

    const appts = await readData<PatientAppointmentsResponse>(
      await appointmentsGET(makeRequest('GET', `/api/patients/${pid}/appointments`), ctx(pid)),
    );
    expect(Array.isArray(appts.upcoming)).toBe(true);
    expect(Array.isArray(appts.past)).toBe(true);
    for (const a of appts.upcoming) expect(['SCHEDULED', 'CONFIRMED', 'ARRIVED']).toContain(a.status);

    actAs('admin2');
    expect(
      (await readError(await visitsGET(makeRequest('GET', `/api/patients/${pid}/visits`), ctx(pid)))).status,
    ).toBe(404);
  });

  it('DELETE: tashriflari bor → 409; RECEPTION → 403; ADMIN yangi bemorni oʻchiradi', async () => {
    actAs('admin');
    const withVisits = await db.visit.findFirst({
      where: { clinicId: clinics.demo.id },
      select: { patientId: true },
    });
    const blocked = await oneDELETE(
      makeRequest('DELETE', `/api/patients/${withVisits!.patientId}`),
      ctx(withVisits!.patientId),
    );
    const err = await readError(blocked);
    expect(err.status).toBe(409);
    expect((err.details as { visits: number }).visits).toBeGreaterThan(0);

    actAs('reception');
    const denied = await oneDELETE(makeRequest('DELETE', `/api/patients/${patientB.id}`), ctx(patientB.id));
    expect((await readError(denied)).status).toBe(403);

    actAs('admin');
    const okRes = await oneDELETE(makeRequest('DELETE', `/api/patients/${patientB.id}`), ctx(patientB.id));
    expect((await readData<{ id: string }>(okRes)).id).toBe(patientB.id);
    expect(await db.patient.findUnique({ where: { id: patientB.id } })).toBeNull();
    const auditRow = await db.auditLog.findFirst({
      where: { entity: 'Patient', entityId: patientB.id, action: 'DELETE' },
    });
    expect(auditRow).toBeTruthy();

    const again = await oneDELETE(makeRequest('DELETE', `/api/patients/${patientB.id}`), ctx(patientB.id));
    expect((await readError(again)).status).toBe(404);
  });

  it('export CSV: ADMIN → BOM + sarlavha; DOCTOR → 403', async () => {
    actAs('admin');
    const res = await exportGET(makeRequest('GET', `/api/patients/export?q=${MARKER}`) as NextRequest);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    expect(res.headers.get('content-disposition')).toContain('.csv');
    const bytes = new Uint8Array(await res.arrayBuffer());
    // UTF-8 BOM (EF BB BF) — Excel uchun; `text()` uni yutib yuboradi, shuning uchun baytlarni tekshiramiz
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder('utf-8').decode(bytes);
    const lines = text.split('\r\n').filter(Boolean);
    expect(lines[0]).toContain('"');
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(text).toContain(patientA.cardNumber);

    actAs('doctor');
    const denied = await exportGET(makeRequest('GET', '/api/patients/export'));
    expect((await readJson(denied)).ok).toBe(false);
    expect(denied.status).toBe(403);
  });
});
