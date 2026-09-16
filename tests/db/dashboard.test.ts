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
import { GET as statsGET } from '@/app/api/dashboard/stats/route';
import { GET as queueCountGET } from '@/app/api/dashboard/queue-count/route';
import { GET as todayGET } from '@/app/api/dashboard/today/route';
import { GET as meGET, PATCH as mePATCH } from '@/app/api/me/route';
import { GET as meClinicGET } from '@/app/api/me/clinic/route';
import { dateKeyToDate, todayKey, todayRange, yesterdayRange } from '@/lib/date';
import { deltaPercent, rangeBounds, rangeDateKeys } from '@/lib/dashboard/stats';
import type { DashboardStatsDTO, MeClinicDTO, MeDTO, QueueCountDTO, TodaySummaryDTO, UpdateMeResultDTO } from '@/lib/dashboard/types';

const HAS_DB = !!process.env.DATABASE_URL;
const dbDescribe = HAS_DB ? describe : describe.skip;

const MARKER = `zztest-dash-${Date.now()}`;

interface TestUser {
  id: string;
  login: string;
  role: Role;
  fullName: string;
  clinicId: string;
}

type PrismaModule = typeof import('@/lib/prisma');
let db: PrismaModule['prisma'];

const clinics: Record<'demo' | 'lorPlus', { id: string; slug: string; kioskKey: string }> = {
  demo: { id: '', slug: 'demo', kioskKey: '' },
  lorPlus: { id: '', slug: 'lor-plus', kioskKey: '' },
};
const users: Record<string, TestUser> = {};
let tempUserId: string | null = null;

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
      clinicName: isDemo ? 'Shifo LOR' : 'LOR Plus',
      clinicSlug: isDemo ? 'demo' : 'lor-plus',
    }),
  );
}

const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(String(v)));

async function paymentsSum(clinicId: string, start: Date, end: Date, doctorId?: string): Promise<number> {
  const agg = await db.payment.aggregate({
    where: { clinicId, createdAt: { gte: start, lte: end }, ...(doctorId ? { visit: { doctorId } } : {}) },
    _sum: { amount: true },
  });
  return num(agg._sum.amount);
}

async function visitsCount(clinicId: string, start: Date, end: Date, doctorId?: string): Promise<number> {
  return db.visit.count({
    where: { clinicId, createdAt: { gte: start, lte: end }, status: { not: 'CANCELLED' }, ...(doctorId ? { doctorId } : {}) },
  });
}

async function getStats(query: string): Promise<DashboardStatsDTO> {
  return readData<DashboardStatsDTO>(await statsGET(makeRequest('GET', `/api/dashboard/stats${query}`)));
}

dbDescribe('dashboard API (DB)', () => {
  beforeAll(async () => {
    const mod = await import('@/lib/prisma');
    db = mod.prisma;
    const rows = await db.clinic.findMany({ where: { slug: { in: ['demo', 'lor-plus'] } }, select: { id: true, slug: true, kioskKey: true } });
    for (const c of rows) {
      if (c.slug === 'demo') clinics.demo = { id: c.id, slug: c.slug, kioskKey: c.kioskKey };
      if (c.slug === 'lor-plus') clinics.lorPlus = { id: c.id, slug: c.slug, kioskKey: c.kioskKey };
    }
    expect(clinics.demo.id, 'demo klinika seedlangan boʻlishi kerak').not.toBe('');
    expect(clinics.lorPlus.id, 'lor-plus klinika seedlangan boʻlishi kerak').not.toBe('');

    const us = await db.user.findMany({
      where: { login: { in: ['admin', 'doctor', 'doctor2', 'reception', 'cashier', 'admin2'] } },
      select: { id: true, login: true, role: true, fullName: true, clinicId: true },
    });
    for (const u of us) users[u.login] = u;
    for (const login of ['admin', 'doctor', 'doctor2', 'reception', 'cashier', 'admin2']) {
      expect(users[login], `${login} seedlangan boʻlishi kerak`).toBeDefined();
    }

    const { hashPassword } = await import('@/lib/auth/password');
    const temp = await db.user.create({
      data: {
        clinicId: clinics.demo.id,
        login: MARKER,
        password: await hashPassword('Temp12345'),
        fullName: 'Test Dashboard Xodim',
        role: 'RECEPTION',
        phone: null,
        color: '#00D4FF',
      },
      select: { id: true, login: true, role: true, fullName: true, clinicId: true },
    });
    tempUserId = temp.id;
    users[MARKER] = temp;
  });

  afterAll(async () => {
    if (!db) return;
    if (tempUserId) {
      await db.auditLog.deleteMany({ where: { userId: tempUserId } });
      await db.user.deleteMany({ where: { id: tempUserId } });
    }
    await db.$disconnect();
  });

  // ── Yordamchi funksiyalar ──
  it('deltaPercent / rangeDateKeys / rangeBounds', () => {
    expect(deltaPercent(120, 100)).toBe(20);
    expect(deltaPercent(80, 100)).toBe(-20);
    expect(deltaPercent(50, 0)).toBe(100);
    expect(deltaPercent(0, 0)).toBe(0);
    expect(deltaPercent(0, 100)).toBe(-100);
    const keys = rangeDateKeys(7);
    expect(keys).toHaveLength(7);
    expect(keys[6]).toBe(todayKey());
    expect(new Set(keys).size).toBe(7);
    const b = rangeBounds(30);
    expect(b.keys).toHaveLength(30);
    expect(b.start.getTime()).toBeLessThan(b.end.getTime());
    expect(b.end.getTime()).toBe(todayRange().end.getTime());
  });

  // ── Statistika: ADMIN ──
  it('ADMIN: bugungi tushum / qabullar / navbat toʻgʻridan-toʻgʻri prisma yigʻindilariga teng', async () => {
    actAs('admin');
    const stats = await getStats('?range=7');
    const clinicId = clinics.demo.id;
    const today = todayRange();
    const yesterday = yesterdayRange();

    expect(stats.range).toBe(7);
    expect(stats.doctorId).toBeNull();
    expect(stats.today.revenue).toBe(await paymentsSum(clinicId, today.start, today.end));
    expect(stats.today.revenueYesterday).toBe(await paymentsSum(clinicId, yesterday.start, yesterday.end));
    expect(stats.today.deltaPct).toBe(deltaPercent(stats.today.revenue, stats.today.revenueYesterday));
    expect(stats.today.visits).toBe(await visitsCount(clinicId, today.start, today.end));
    expect(stats.today.visitsYesterday).toBe(await visitsCount(clinicId, yesterday.start, yesterday.end));
    expect(stats.today.waiting).toBe(await db.queue.count({ where: { clinicId, date: dateKeyToDate(todayKey()), status: 'WAITING' } }));
    expect(Number.isInteger(stats.today.revenue)).toBe(true);
    expect(Number.isInteger(stats.today.avgCheck)).toBe(true);

    // Oʻrtacha chek = bugungi qabullar totalNet / soni
    const agg = await db.visit.aggregate({
      where: { clinicId, createdAt: { gte: today.start, lte: today.end }, status: { not: 'CANCELLED' } },
      _sum: { totalNet: true },
      _count: { _all: true },
    });
    const expectedAvg = agg._count._all > 0 ? Math.round(num(agg._sum.totalNet) / agg._count._all) : 0;
    expect(Math.abs(stats.today.avgCheck - expectedAvg)).toBeLessThanOrEqual(1);
  });

  it('ADMIN: kunlik seriya, toʻlov usullari, shifokorlar va qarzlar izchil', async () => {
    actAs('admin');
    const stats = await getStats('?range=30');
    const clinicId = clinics.demo.id;
    const { start, end } = rangeBounds(30);

    // Seriya: 30 kun, bugun bilan tugaydi, bugungi nuqta = bugungi tushum/qabullar
    expect(stats.series).toHaveLength(30);
    expect(stats.series.map((p) => p.date)).toEqual(rangeDateKeys(30));
    const last = stats.series[stats.series.length - 1];
    expect(last?.revenue).toBe(stats.today.revenue);
    expect(last?.visits).toBe(stats.today.visits);
    const seriesRevenue = stats.series.reduce((s, p) => s + p.revenue, 0);
    const seriesVisits = stats.series.reduce((s, p) => s + p.visits, 0);
    expect(seriesRevenue).toBe(await paymentsSum(clinicId, start, end));
    expect(seriesVisits).toBe(await visitsCount(clinicId, start, end));

    // Toʻlov usullari yigʻindisi = davr toʻlovlari
    const methodsTotal = stats.byMethod.reduce((s, m) => s + m.amount, 0);
    expect(methodsTotal).toBe(seriesRevenue);
    const byMethodDb = await db.payment.groupBy({ by: ['method'], where: { clinicId, createdAt: { gte: start, lte: end } }, _sum: { amount: true } });
    for (const m of stats.byMethod) {
      expect(m.amount).toBe(num(byMethodDb.find((r) => r.method === m.method)?._sum.amount));
    }

    // Shifokorlar: tushum kamayish tartibida, jami = davr qabullari totalNet
    const doctorsRevenue = stats.doctors.reduce((s, d) => s + d.revenue, 0);
    const visitAgg = await db.visit.aggregate({ where: { clinicId, createdAt: { gte: start, lte: end }, status: { not: 'CANCELLED' } }, _sum: { totalNet: true } });
    expect(doctorsRevenue).toBe(num(visitAgg._sum.totalNet));
    for (let i = 1; i < stats.doctors.length; i++) {
      expect(stats.doctors[i - 1]!.revenue).toBeGreaterThanOrEqual(stats.doctors[i]!.revenue);
    }
    for (const d of stats.doctors) {
      expect(d.avgCheck).toBe(d.patients > 0 ? Math.round(d.revenue / d.patients) : 0);
      expect(d.color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }

    // Top xizmatlar: ≤ 10, kamayish tartibida
    expect(stats.topServices.length).toBeLessThanOrEqual(10);
    for (let i = 1; i < stats.topServices.length; i++) {
      expect(stats.topServices[i - 1]!.revenue).toBeGreaterThanOrEqual(stats.topServices[i]!.revenue);
    }
    for (const s of stats.topServices) {
      expect(s.count).toBeGreaterThan(0);
      expect(s.serviceName.length).toBeGreaterThan(0);
    }

    // Qarzlar: eng katta 20 ta, qoldiq > 0, jami = DB
    expect(stats.debts.length).toBeLessThanOrEqual(20);
    const debtVisits = await db.visit.findMany({
      where: { clinicId, status: 'COMPLETED' },
      select: { id: true, totalNet: true, paidAmount: true },
    });
    const withDebt = debtVisits.map((v) => ({ id: v.id, balance: num(v.totalNet) - num(v.paidAmount) })).filter((v) => v.balance > 0);
    const expectedTotal = withDebt.reduce((s, v) => s + v.balance, 0);
    expect(stats.debtTotal).toBe(expectedTotal);
    expect(stats.debts.length).toBe(Math.min(20, withDebt.length));
    for (let i = 1; i < stats.debts.length; i++) {
      expect(stats.debts[i - 1]!.balance).toBeGreaterThanOrEqual(stats.debts[i]!.balance);
    }
    for (const d of stats.debts) {
      expect(d.balance).toBeGreaterThan(0);
      expect(d.balance).toBe(withDebt.find((v) => v.id === d.visitId)?.balance);
      expect(d.cardNumber).toMatch(/^\d{4}-\d{5}$/);
      expect(() => new Date(d.date).toISOString()).not.toThrow();
    }
  });

  it('range notoʻgʻri boʻlsa 400 VALIDATION; default 7', async () => {
    actAs('admin');
    const err = await readError(await statsGET(makeRequest('GET', '/api/dashboard/stats?range=15')));
    expect(err.status).toBe(400);
    expect(err.code).toBe('VALIDATION');
    const def = await getStats('');
    expect(def.range).toBe(7);
    expect(def.series).toHaveLength(7);
  });

  it('ADMIN: doctorId filtri faqat shu shifokor qabullarini hisoblaydi', async () => {
    actAs('admin');
    const doctor = users['doctor2']!;
    const stats = await getStats(`?range=30&doctorId=${doctor.id}`);
    const { start, end } = rangeBounds(30);
    expect(stats.doctorId).toBe(doctor.id);
    expect(stats.doctors.every((d) => d.id === doctor.id)).toBe(true);
    const seriesRevenue = stats.series.reduce((s, p) => s + p.revenue, 0);
    expect(seriesRevenue).toBe(await paymentsSum(clinics.demo.id, start, end, doctor.id));
    expect(stats.today.revenue).toBe(await paymentsSum(clinics.demo.id, todayRange().start, todayRange().end, doctor.id));
  });

  // ── DOCTOR: majburan oʻzi ──
  it('DOCTOR: doctorId doim oʻzi (soʻrovdagi boshqa id eʼtiborga olinmaydi)', async () => {
    actAs('doctor');
    const me = users['doctor']!;
    const other = users['doctor2']!;
    const stats = await getStats(`?range=30&doctorId=${other.id}`);
    expect(stats.doctorId).toBe(me.id);
    expect(stats.doctors.every((d) => d.id === me.id)).toBe(true);
    const { start, end } = rangeBounds(30);
    expect(stats.series.reduce((s, p) => s + p.revenue, 0)).toBe(await paymentsSum(clinics.demo.id, start, end, me.id));
    expect(stats.today.visits).toBe(await visitsCount(clinics.demo.id, todayRange().start, todayRange().end, me.id));
    // Qarzlar ham faqat oʻz qabullari
    if (stats.debts.length > 0) {
      const ids = stats.debts.map((d) => d.visitId);
      const foreign = await db.visit.count({ where: { id: { in: ids }, doctorId: { not: me.id } } });
      expect(foreign).toBe(0);
    }
    // Navbat soni klinika boʻyicha (shifokorga bogʻlanmagan)
    expect(stats.today.waiting).toBe(await db.queue.count({ where: { clinicId: clinics.demo.id, date: dateKeyToDate(todayKey()), status: 'WAITING' } }));
  });

  // ── Tenant izolyatsiyasi ──
  it('admin2 (lor-plus) faqat oʻz klinikasini koʻradi', async () => {
    actAs('admin2');
    const stats = await getStats('?range=90');
    const clinicId = clinics.lorPlus.id;
    const { start, end } = rangeBounds(90);
    expect(stats.series.reduce((s, p) => s + p.revenue, 0)).toBe(await paymentsSum(clinicId, start, end));
    expect(stats.series.reduce((s, p) => s + p.visits, 0)).toBe(await visitsCount(clinicId, start, end));
    // Demo klinikaning maʼlumoti kirmagan
    const demoVisits = await visitsCount(clinics.demo.id, start, end);
    expect(stats.series.reduce((s, p) => s + p.visits, 0)).not.toBe(demoVisits);
    if (stats.debts.length > 0) {
      const foreign = await db.visit.count({ where: { id: { in: stats.debts.map((d) => d.visitId) }, clinicId: { not: clinicId } } });
      expect(foreign).toBe(0);
    }
    const lorPlusUserIds = new Set((await db.user.findMany({ where: { clinicId }, select: { id: true } })).map((u) => u.id));
    for (const d of stats.doctors) expect(lorPlusUserIds.has(d.id)).toBe(true);
    const lorPlusServiceIds = new Set((await db.service.findMany({ where: { clinicId }, select: { id: true } })).map((s) => s.id));
    for (const s of stats.topServices) expect(lorPlusServiceIds.has(s.serviceId)).toBe(true);
    expect(stats.today.waiting).toBe(await db.queue.count({ where: { clinicId, date: dateKeyToDate(todayKey()), status: 'WAITING' } }));
  });

  // ── queue-count / today ──
  it('queue-count: kutayotganlar soni', async () => {
    actAs('cashier');
    const data = await readData<QueueCountDTO>(await queueCountGET(makeRequest('GET', '/api/dashboard/queue-count')));
    expect(data.waiting).toBe(await db.queue.count({ where: { clinicId: clinics.demo.id, date: dateKeyToDate(todayKey()), status: 'WAITING' } }));
  });

  it('today: tushum, qabullar va bugungi yozilishlar (≤ 8, faqat faol holatlar)', async () => {
    actAs('reception');
    const data = await readData<TodaySummaryDTO>(await todayGET(makeRequest('GET', '/api/dashboard/today')));
    const today = todayRange();
    expect(data.revenue).toBe(await paymentsSum(clinics.demo.id, today.start, today.end));
    expect(data.visits).toBe(await visitsCount(clinics.demo.id, today.start, today.end));
    expect(data.appointments.length).toBeLessThanOrEqual(8);
    const expected = await db.appointment.count({
      where: { clinicId: clinics.demo.id, startAt: { gte: today.start, lte: today.end }, status: { in: ['SCHEDULED', 'CONFIRMED', 'ARRIVED'] } },
    });
    expect(data.appointments.length).toBe(Math.min(8, expected));
    for (let i = 0; i < data.appointments.length; i++) {
      const a = data.appointments[i]!;
      expect(['SCHEDULED', 'CONFIRMED', 'ARRIVED']).toContain(a.status);
      const at = new Date(a.startAt).getTime();
      expect(at).toBeGreaterThanOrEqual(today.start.getTime());
      expect(at).toBeLessThanOrEqual(today.end.getTime());
      if (i > 0) expect(at).toBeGreaterThanOrEqual(new Date(data.appointments[i - 1]!.startAt).getTime());
      expect(a.patientName.length).toBeGreaterThan(0);
      expect(a.doctorName.length).toBeGreaterThan(0);
    }
    // DOCTOR faqat oʻz yozilishlarini koʻradi
    actAs('doctor');
    const mine = await readData<TodaySummaryDTO>(await todayGET(makeRequest('GET', '/api/dashboard/today')));
    expect(mine.appointments.every((a) => a.doctorId === users['doctor']!.id)).toBe(true);
    expect(mine.revenue).toBe(await paymentsSum(clinics.demo.id, today.start, today.end, users['doctor']!.id));
  });

  // ── /api/me ──
  it('GET /api/me: kiosk kaliti faqat ADMIN / RECEPTION uchun', async () => {
    actAs('admin');
    const admin = await readData<MeDTO>(await meGET(makeRequest('GET', '/api/me')));
    expect(admin.user.id).toBe(users['admin']!.id);
    expect(admin.user.role).toBe('ADMIN');
    expect(admin.clinic.slug).toBe('demo');
    expect(admin.clinic.kioskKey).toBe(clinics.demo.kioskKey);
    expect(admin.clinic.settings.queue.prefixes.DOCTOR).toHaveLength(1);
    expect(admin.clinic.plan).toBeDefined();

    actAs('reception');
    const reception = await readData<MeClinicDTO>(await meClinicGET(makeRequest('GET', '/api/me/clinic')));
    expect(reception.kioskKey).toBe(clinics.demo.kioskKey);

    actAs('doctor');
    const doctor = await readData<MeDTO>(await meGET(makeRequest('GET', '/api/me')));
    expect(doctor.clinic.kioskKey).toBeNull();

    actAs('cashier');
    const cashier = await readData<MeDTO>(await meGET(makeRequest('GET', '/api/me')));
    expect(cashier.clinic.kioskKey).toBeNull();
    expect(cashier.user.login).toBe('cashier');

    actAs('admin2');
    const admin2 = await readData<MeDTO>(await meGET(makeRequest('GET', '/api/me')));
    expect(admin2.clinic.slug).toBe('lor-plus');
    expect(admin2.clinic.kioskKey).toBe(clinics.lorPlus.kioskKey);
  });

  it('PATCH /api/me: ism/telefon/parol yangilanadi, audit yoziladi, notoʻgʻri joriy parol → 400', async () => {
    actAs(MARKER);
    const id = tempUserId!;

    const r1 = await readData<UpdateMeResultDTO>(
      await mePATCH(makeRequest('PATCH', '/api/me', { fullName: 'Test Dashboard Yangi', phone: '+998 90 123 45 67' })),
    );
    expect(r1.passwordChanged).toBe(false);
    expect(r1.user.fullName).toBe('Test Dashboard Yangi');
    expect(r1.user.phone).toBe('+998901234567');
    const row1 = await db.user.findUnique({ where: { id }, select: { fullName: true, phone: true } });
    expect(row1).toEqual({ fullName: 'Test Dashboard Yangi', phone: '+998901234567' });

    // Notoʻgʻri joriy parol
    const bad = await readError(await mePATCH(makeRequest('PATCH', '/api/me', { password: { current: 'Wrong12345', next: 'Newpass123' } })));
    expect(bad.status).toBe(400);
    expect(bad.code).toBe('VALIDATION');
    expect(JSON.stringify(bad.details)).toContain('password.current');

    // Kuchsiz parol → 400 (zod)
    const weak = await readError(await mePATCH(makeRequest('PATCH', '/api/me', { password: { current: 'Temp12345', next: 'short' } })));
    expect(weak.status).toBe(400);

    // Toʻgʻri parol → almashadi
    const r2 = await readData<UpdateMeResultDTO>(await mePATCH(makeRequest('PATCH', '/api/me', { password: { current: 'Temp12345', next: 'Newpass123' } })));
    expect(r2.passwordChanged).toBe(true);
    const { verifyPassword } = await import('@/lib/auth/password');
    const row2 = await db.user.findUnique({ where: { id }, select: { password: true } });
    expect(await verifyPassword('Newpass123', row2!.password)).toBe(true);

    // Telefonni tozalash
    const r3 = await readData<UpdateMeResultDTO>(await mePATCH(makeRequest('PATCH', '/api/me', { phone: '' })));
    expect(r3.user.phone).toBeNull();

    // Boʻsh tana → 400
    const empty = await readError(await mePATCH(makeRequest('PATCH', '/api/me', {})));
    expect(empty.status).toBe(400);

    const audits = await db.auditLog.count({ where: { userId: id, entity: 'User', action: 'UPDATE' } });
    expect(audits).toBeGreaterThanOrEqual(3);
  });
});
