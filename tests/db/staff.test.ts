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
import { verifyPassword } from '@/lib/auth/password';
import { calcSalary, monthKey, monthRange } from '@/lib/staff/salary';
import { defaultScheduleForm } from '@/lib/staff/schedule';
import type { SalaryDoctorDTO, SalaryReportDTO, StaffListDTO, StaffUserDTO } from '@/lib/staff/types';
import { GET as listGET, POST as createPOST } from '@/app/api/users/route';
import { GET as oneGET, PATCH as onePATCH, DELETE as oneDELETE } from '@/app/api/users/[id]/route';
import { POST as passwordPOST } from '@/app/api/users/[id]/password/route';
import { GET as salaryGET } from '@/app/api/users/salary/route';
import { GET as doctorSalaryGET } from '@/app/api/users/[id]/salary/route';

const HAS_DB = !!process.env.DATABASE_URL;
const dbDescribe = HAS_DB ? describe : describe.skip;

/** Unikal belgi: yaratilgan xodimlar shu prefiks bilan boshlanadi va oxirida oʻchiriladi */
const MARKER = 'zztest-staff';

interface SeedUser {
  id: string;
  login: string;
  role: Role;
  fullName: string;
  clinicId: string;
}

type PrismaModule = typeof import('@/lib/prisma');
let db: PrismaModule['prisma'];

const clinics = { demo: '', lorPlus: '' };
const users: Record<string, SeedUser> = {};

function actAs(u: SeedUser) {
  vi.mocked(getServerSession).mockResolvedValue(
    mockSession({
      id: u.id,
      login: u.login,
      role: u.role,
      fullName: u.fullName,
      clinicId: u.clinicId,
      clinicName: u.clinicId === clinics.demo ? 'Shifo LOR' : 'LOR Plus',
      clinicSlug: u.clinicId === clinics.demo ? 'demo' : 'lor-plus',
    }),
  );
}

const seed = (login: string): SeedUser => {
  const u = users[login];
  if (!u) throw new Error(`Seed user ${login} topilmadi`);
  return u;
};

const ctx = (id: string) => ({ params: { id } });

const newDoctorBody = (suffix: string) => ({
  login: `${MARKER}-${suffix}`,
  password: 'Doctor123!',
  fullName: `Testov Shifokor ${suffix}`,
  role: 'DOCTOR',
  phone: '+998 90 700 11 22',
  email: `${MARKER}-${suffix}@example.test`,
  specialty: 'LOR-shifokor',
  room: '9',
  color: '#7c5cff',
  salaryType: 'PERCENT',
  salaryValue: 30,
  schedule: defaultScheduleForm(),
});

async function cleanup() {
  const rows = await db.user.findMany({ where: { login: { startsWith: MARKER } }, select: { id: true } });
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return;
  await db.auditLog.deleteMany({ where: { OR: [{ userId: { in: ids } }, { entity: 'User', entityId: { in: ids } }] } });
  await db.passwordResetToken.deleteMany({ where: { userId: { in: ids } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
}

dbDescribe('staff API (DB)', () => {
  beforeAll(async () => {
    db = (await import('@/lib/prisma')).prisma;
    const cs = await db.clinic.findMany({ where: { slug: { in: ['demo', 'lor-plus'] } }, select: { id: true, slug: true } });
    for (const c of cs) {
      if (c.slug === 'demo') clinics.demo = c.id;
      if (c.slug === 'lor-plus') clinics.lorPlus = c.id;
    }
    expect(clinics.demo).toBeTruthy();
    expect(clinics.lorPlus).toBeTruthy();
    const us = await db.user.findMany({
      where: { login: { in: ['admin', 'doctor', 'doctor2', 'reception', 'cashier', 'admin2'] } },
      select: { id: true, login: true, role: true, fullName: true, clinicId: true },
    });
    for (const u of us) users[u.login] = u;
    for (const l of ['admin', 'doctor', 'doctor2', 'reception', 'cashier', 'admin2']) expect(users[l], `seed user ${l}`).toBeTruthy();
    await cleanup();
  });

  afterAll(async () => {
    if (!db) return;
    await cleanup();
    await db.$disconnect();
  });

  let created: StaffUserDTO;

  it('ADMIN creates DOCTOR → 201, parol xeshlangan, DTO da parol yoʻq', async () => {
    actAs(seed('admin'));
    const res = await createPOST(makeRequest('POST', '/api/users', newDoctorBody('a')));
    expect(res.status).toBe(201);
    created = await readData<StaffUserDTO>(res);
    expect(created.id).toBeTruthy();
    expect(created.login).toBe(`${MARKER}-a`);
    expect(created.role).toBe('DOCTOR');
    expect(created.clinicId).toBe(clinics.demo);
    expect(created.color).toBe('#7C5CFF');
    expect(created.phone).toBe('+998907001122');
    expect(created.salaryType).toBe('PERCENT');
    expect(created.salaryValue).toBe(30);
    expect(created.isActive).toBe(true);
    expect(created.schedule[1].breakStart).toBe('13:00');
    expect(created.schedule[0].enabled).toBe(false);
    expect('password' in created).toBe(false);

    const row = await db.user.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.password).not.toBe('Doctor123!');
    expect(row.password.startsWith('$2')).toBe(true);
    expect(await verifyPassword('Doctor123!', row.password)).toBe(true);
    expect(row.sessionVersion).toBe(1);

    const audit = await db.auditLog.findFirst({ where: { entity: 'User', entityId: created.id, action: 'CREATE' } });
    expect(audit).toBeTruthy();
    expect(JSON.stringify(audit?.after ?? {})).not.toContain('$2');
  });

  it('duplicate login → 409 CONFLICT (katta harflar bilan ham)', async () => {
    actAs(seed('admin'));
    const res = await createPOST(
      makeRequest('POST', '/api/users', { ...newDoctorBody('b'), login: `${MARKER}-A`, email: `${MARKER}-b@example.test` }),
    );
    const err = await readError(res);
    expect(err.status).toBe(409);
    expect(err.code).toBe('CONFLICT');
    expect(err.message).toBe('staff.errors.loginTaken');
  });

  it('duplicate email → 409', async () => {
    actAs(seed('admin'));
    const res = await createPOST(makeRequest('POST', '/api/users', { ...newDoctorBody('c'), email: `${MARKER}-a@example.test` }));
    const err = await readError(res);
    expect(err.status).toBe(409);
    expect(err.message).toBe('staff.errors.emailTaken');
  });

  it('validation: zaif parol / SUPER_ADMIN → 400', async () => {
    actAs(seed('admin'));
    const weak = await readError(await createPOST(makeRequest('POST', '/api/users', { ...newDoctorBody('d'), password: 'weak' })));
    expect(weak.status).toBe(400);
    expect(weak.code).toBe('VALIDATION');
    const sa = await readError(await createPOST(makeRequest('POST', '/api/users', { ...newDoctorBody('e'), role: 'SUPER_ADMIN' })));
    expect(sa.status).toBe(400);
  });

  it('RECEPTION cannot POST → 403; DOCTOR cannot PATCH/DELETE → 403', async () => {
    actAs(seed('reception'));
    const res = await createPOST(makeRequest('POST', '/api/users', newDoctorBody('f')));
    expect((await readError(res)).status).toBe(403);

    actAs(seed('doctor'));
    expect((await readError(await onePATCH(makeRequest('PATCH', `/api/users/${created.id}`, { room: '1' }), ctx(created.id)))).status).toBe(403);
    expect((await readError(await oneDELETE(makeRequest('DELETE', `/api/users/${created.id}`), ctx(created.id)))).status).toBe(403);
  });

  it('GET /api/users?role=DOCTOR&active=1 → faqat faol shifokorlar, parolsiz, jadval bilan', async () => {
    actAs(seed('reception'));
    const data = await readData<StaffListDTO>(await listGET(makeRequest('GET', '/api/users?role=DOCTOR&active=1')));
    expect(data.items.length).toBeGreaterThanOrEqual(4);
    expect(data.total).toBe(data.items.length);
    for (const u of data.items) {
      expect(u.role).toBe('DOCTOR');
      expect(u.isActive).toBe(true);
      expect(u.clinicId).toBe(clinics.demo);
      expect('password' in u).toBe(false);
      expect(typeof u.schedule[1].start).toBe('string');
      expect(typeof u.salaryValue).toBe('number');
    }
    expect(data.items.some((u) => u.id === created.id)).toBe(true);
    expect(data.items.some((u) => u.role === ('SUPER_ADMIN' as Role))).toBe(false);

    const search = await readData<StaffListDTO>(await listGET(makeRequest('GET', `/api/users?search=${MARKER}-a`)));
    expect(search.items.map((u) => u.id)).toEqual([created.id]);

    const bad = await readError(await listGET(makeRequest('GET', '/api/users?role=OWNER')));
    expect(bad.status).toBe(400);
  });

  it('GET /api/users/[id]: oʻz klinikasi 200, boshqa klinika 404', async () => {
    actAs(seed('cashier'));
    const one = await readData<StaffUserDTO>(await oneGET(makeRequest('GET', `/api/users/${created.id}`), ctx(created.id)));
    expect(one.id).toBe(created.id);
    actAs(seed('admin2'));
    expect((await readError(await oneGET(makeRequest('GET', `/api/users/${created.id}`), ctx(created.id)))).status).toBe(404);
    expect((await readError(await onePATCH(makeRequest('PATCH', `/api/users/${created.id}`, { room: '2' }), ctx(created.id)))).status).toBe(404);
  });

  it('PATCH: maydonlar yangilanadi, audit yoziladi; rol oʻzgarsa sessionVersion oshadi', async () => {
    actAs(seed('admin'));
    const upd = await readData<StaffUserDTO>(
      await onePATCH(
        makeRequest('PATCH', `/api/users/${created.id}`, { room: '11', salaryType: 'FIXED', salaryValue: '8 000 000', specialty: '' }),
        ctx(created.id),
      ),
    );
    expect(upd.room).toBe('11');
    expect(upd.salaryType).toBe('FIXED');
    expect(upd.salaryValue).toBe(8_000_000);
    expect(upd.specialty).toBeNull();
    let row = await db.user.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.sessionVersion).toBe(1);

    const audit = await db.auditLog.findFirst({
      where: { entity: 'User', entityId: created.id, action: 'UPDATE' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).toBeTruthy();
    expect(JSON.stringify(audit?.after)).toContain('"room":"11"');

    const roleUpd = await readData<StaffUserDTO>(await onePATCH(makeRequest('PATCH', `/api/users/${created.id}`, { role: 'RECEPTION' }), ctx(created.id)));
    expect(roleUpd.role).toBe('RECEPTION');
    row = await db.user.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.sessionVersion).toBe(2);

    // PERCENT > 100 → 400
    const bad = await readError(await onePATCH(makeRequest('PATCH', `/api/users/${created.id}`, { salaryType: 'PERCENT', salaryValue: 120 }), ctx(created.id)));
    expect(bad.status).toBe(400);

    // Orqaga: yana shifokor (ish haqi testlari uchun)
    await readData<StaffUserDTO>(await onePATCH(makeRequest('PATCH', `/api/users/${created.id}`, { role: 'DOCTOR', salaryType: 'PERCENT', salaryValue: 30 }), ctx(created.id)));
  });

  it('ADMIN oʻz rolini oʻzgartira olmaydi → 409', async () => {
    const admin = seed('admin');
    actAs(admin);
    const err = await readError(await onePATCH(makeRequest('PATCH', `/api/users/${admin.id}`, { role: 'DOCTOR' }), ctx(admin.id)));
    expect(err.status).toBe(409);
    expect(err.message).toBe('staff.errors.self');
    const err2 = await readError(await onePATCH(makeRequest('PATCH', `/api/users/${admin.id}`, { isActive: false }), ctx(admin.id)));
    expect(err2.status).toBe(409);
  });

  it('POST /api/users/[id]/password: xesh yangilanadi, sessionVersion oshadi', async () => {
    actAs(seed('admin'));
    const before = await db.user.findUniqueOrThrow({ where: { id: created.id }, select: { password: true, sessionVersion: true } });
    const weak = await readError(await passwordPOST(makeRequest('POST', `/api/users/${created.id}/password`, { password: 'weak' }), ctx(created.id)));
    expect(weak.status).toBe(400);
    const res = await passwordPOST(makeRequest('POST', `/api/users/${created.id}/password`, { password: 'NewPass456' }), ctx(created.id));
    expect((await readData<{ id: string }>(res)).id).toBe(created.id);
    const after = await db.user.findUniqueOrThrow({ where: { id: created.id }, select: { password: true, sessionVersion: true } });
    expect(after.password).not.toBe(before.password);
    expect(after.sessionVersion).toBe(before.sessionVersion + 1);
    expect(await verifyPassword('NewPass456', after.password)).toBe(true);
    expect(await verifyPassword('Doctor123!', after.password)).toBe(false);

    actAs(seed('reception'));
    expect((await readError(await passwordPOST(makeRequest('POST', `/api/users/${created.id}/password`, { password: 'NewPass456' }), ctx(created.id)))).status).toBe(403);
  });

  it('deactivate self → 409 (deactivateSelf)', async () => {
    const admin = seed('admin');
    actAs(admin);
    const err = await readError(await oneDELETE(makeRequest('DELETE', `/api/users/${admin.id}`), ctx(admin.id)));
    expect(err.status).toBe(409);
    expect(err.code).toBe('CONFLICT');
    expect(err.message).toBe('staff.errors.deactivateSelf');
    const still = await db.user.findUniqueOrThrow({ where: { id: admin.id }, select: { isActive: true } });
    expect(still.isActive).toBe(true);
  });

  it('salary endpoint: har bir shifokor tushumi = prisma aggregate (joriy oy), ish haqi = calcSalary', async () => {
    actAs(seed('admin'));
    const month = monthKey();
    const report = await readData<SalaryReportDTO>(await salaryGET(makeRequest('GET', `/api/users/salary?month=${month}`)));
    expect(report.month).toBe(month);
    const { start, end } = monthRange(month);
    expect(report.from).toBe(start.toISOString());
    expect(report.to).toBe(end.toISOString());
    expect(report.doctors.length).toBeGreaterThanOrEqual(3);

    for (const item of report.doctors) {
      expect(item.doctor.id).toBeTruthy();
      const agg = await db.visit.aggregate({
        where: { clinicId: clinics.demo, doctorId: item.doctor.id, status: 'COMPLETED', completedAt: { gte: start, lt: end } },
        _sum: { totalNet: true },
        _count: { _all: true },
      });
      const expectedRevenue = Number(agg._sum.totalNet?.toFixed(0) ?? '0');
      expect(item.revenue, item.doctor.fullName).toBe(expectedRevenue);
      expect(item.visits, item.doctor.fullName).toBe(agg._count._all);

      const distinct = await db.visit.findMany({
        where: { clinicId: clinics.demo, doctorId: item.doctor.id, status: 'COMPLETED', completedAt: { gte: start, lt: end } },
        distinct: ['patientId'],
        select: { patientId: true },
      });
      expect(item.patients, item.doctor.fullName).toBe(distinct.length);

      const user = await db.user.findUniqueOrThrow({ where: { id: item.doctor.id }, select: { salaryType: true, salaryValue: true } });
      expect(item.salary, item.doctor.fullName).toBe(calcSalary(user.salaryType, user.salaryValue.toString(), expectedRevenue).toNumber());
      if (item.salaryType === 'PERCENT') expect(item.salary % 100).toBe(0);

      // Kunlik taqsimot jami = oylik jami
      expect(item.days.reduce((s, d) => s + d.visits, 0)).toBe(item.visits);
      expect(item.days.reduce((s, d) => s + d.revenue, 0)).toBe(item.revenue);
      for (const d of item.days) expect(d.date.startsWith(month)).toBe(true);
      expect(item.services.length).toBeLessThanOrEqual(10);
      for (let i = 1; i < item.services.length; i++) {
        expect(item.services[i - 1]!.revenue).toBeGreaterThanOrEqual(item.services[i]!.revenue);
      }
    }

    expect(report.totals.visits).toBe(report.doctors.reduce((s, d) => s + d.visits, 0));
    expect(report.totals.revenue).toBe(report.doctors.reduce((s, d) => s + d.revenue, 0));
    expect(report.totals.salary).toBe(report.doctors.reduce((s, d) => s + d.salary, 0));

    // Seed shifokor (doctor, 30 %) shu oyda kamida bitta qabulga ega (seed 90 kunlik tarix)
    const seedDoctor = report.doctors.find((d) => d.doctor.id === seed('doctor').id);
    expect(seedDoctor).toBeTruthy();
    expect(seedDoctor!.salaryType).toBe('PERCENT');
    expect(seedDoctor!.salaryValue).toBe(30);

    // Boshqa klinika shifokorlari roʻyxatda yoʻq
    expect(report.doctors.some((d) => d.doctor.id === users['doctor4']?.id)).toBe(false);

    const bad = await readError(await salaryGET(makeRequest('GET', '/api/users/salary?month=2026-9')));
    expect(bad.status).toBe(400);
  });

  it('salary: RECEPTION/DOCTOR → 403; shifokor oʻzinikini koʻradi, boshqanikini emas', async () => {
    const month = monthKey();
    actAs(seed('reception'));
    expect((await readError(await salaryGET(makeRequest('GET', `/api/users/salary?month=${month}`)))).status).toBe(403);
    const doctor = seed('doctor');
    actAs(doctor);
    expect((await readError(await salaryGET(makeRequest('GET', `/api/users/salary?month=${month}`)))).status).toBe(403);

    const own = await readData<{ month: string; item: SalaryDoctorDTO }>(
      await doctorSalaryGET(makeRequest('GET', `/api/users/${doctor.id}/salary?month=${month}`), ctx(doctor.id)),
    );
    expect(own.month).toBe(month);
    expect(own.item.doctor.id).toBe(doctor.id);

    const other = seed('doctor2');
    expect((await readError(await doctorSalaryGET(makeRequest('GET', `/api/users/${other.id}/salary?month=${month}`), ctx(other.id)))).status).toBe(403);

    actAs(seed('admin'));
    const asAdmin = await readData<{ item: SalaryDoctorDTO }>(
      await doctorSalaryGET(makeRequest('GET', `/api/users/${other.id}/salary?month=${month}`), ctx(other.id)),
    );
    expect(asAdmin.item.doctor.id).toBe(other.id);

    // Shifokor boʻlmagan xodim uchun 404
    const rec = seed('reception');
    expect((await readError(await doctorSalaryGET(makeRequest('GET', `/api/users/${rec.id}/salary?month=${month}`), ctx(rec.id)))).status).toBe(404);
  });

  it('DELETE (deactivate) → isActive=false, sessionVersion oshadi, faollar roʻyxatidan chiqadi; PATCH isActive=true qaytaradi', async () => {
    actAs(seed('admin'));
    const before = await db.user.findUniqueOrThrow({ where: { id: created.id }, select: { sessionVersion: true } });
    const res = await readData<StaffUserDTO>(await oneDELETE(makeRequest('DELETE', `/api/users/${created.id}`), ctx(created.id)));
    expect(res.isActive).toBe(false);
    const row = await db.user.findUniqueOrThrow({ where: { id: created.id }, select: { isActive: true, sessionVersion: true } });
    expect(row.isActive).toBe(false);
    expect(row.sessionVersion).toBe(before.sessionVersion + 1);

    const active = await readData<StaffListDTO>(await listGET(makeRequest('GET', '/api/users?active=1')));
    expect(active.items.some((u) => u.id === created.id)).toBe(false);
    const inactive = await readData<StaffListDTO>(await listGET(makeRequest('GET', '/api/users?active=0')));
    expect(inactive.items.some((u) => u.id === created.id)).toBe(true);

    // Takroriy nofaol qilish — idempotent
    const again = await readData<StaffUserDTO>(await oneDELETE(makeRequest('DELETE', `/api/users/${created.id}`), ctx(created.id)));
    expect(again.isActive).toBe(false);

    const back = await readData<StaffUserDTO>(await onePATCH(makeRequest('PATCH', `/api/users/${created.id}`, { isActive: true }), ctx(created.id)));
    expect(back.isActive).toBe(true);
  });
});
