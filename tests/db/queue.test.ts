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
import { todayKey } from '@/lib/date';
import { parseClinicSettings } from '@/lib/settings/types';
import { resetRateLimits } from '@/lib/queue/rate-limit';
import type { CreatedTicketDTO, DisplayStateDTO, KioskTicketResultDTO, NextTicketResultDTO, QueueBoardDTO, QueueRowDTO, TicketWithDataDTO, VisitFromTicketResultDTO } from '@/lib/queue/types';
import { GET as boardGET, POST as createPOST } from '@/app/api/queue/route';
import { POST as nextPOST } from '@/app/api/queue/next/route';
import { GET as stateGET } from '@/app/api/queue/state/route';
import { GET as ticketGET } from '@/app/api/queue/[id]/route';
import { POST as callPOST } from '@/app/api/queue/[id]/call/route';
import { POST as donePOST } from '@/app/api/queue/[id]/done/route';
import { POST as skipPOST } from '@/app/api/queue/[id]/skip/route';
import { POST as recallPOST } from '@/app/api/queue/[id]/recall/route';
import { POST as printPOST } from '@/app/api/queue/[id]/print/route';
import { POST as visitPOST } from '@/app/api/queue/[id]/visit/route';
import { POST as patientPOST } from '@/app/api/queue/[id]/patient/route';
import { POST as kioskTicketPOST } from '@/app/api/kiosk/ticket/route';
import { POST as kioskPrintPOST } from '@/app/api/kiosk/print/route';
import { GET as displayStateGET } from '@/app/api/display/state/route';
import { POST as printRawPOST } from '@/app/api/print/raw/route';

const HAS_DB = !!process.env.DATABASE_URL;
const dbDescribe = HAS_DB ? describe : describe.skip;

const STAMP = Date.now().toString(36);
const MARKER = `zztest-queue-${STAMP}`;
const KEY_A = `${MARKER}-key-a`;
const KEY_B = `${MARKER}-key-b`;
const DAY1 = '2030-01-01';
const DAY2 = '2030-01-02';
const DAY3 = '2030-01-03';

type PrismaModule = typeof import('@/lib/prisma');
type ServiceModule = typeof import('@/lib/queue/service');
let db: PrismaModule['prisma'];
let svc: ServiceModule;

interface TestUser {
  id: string;
  login: string;
  role: Role;
  fullName: string;
  clinicId: string;
  clinicName: string;
  clinicSlug: string;
  room: string | null;
}

const ctx = {
  clinicA: '',
  clinicB: '',
  doctorA: null as TestUser | null,
  receptionA: null as TestUser | null,
  cashierA: null as TestUser | null,
  doctorB: null as TestUser | null,
  patientA: '',
};

function asUser(u: TestUser | null) {
  if (!u) throw new Error('test user missing');
  vi.mocked(getServerSession).mockResolvedValue(
    mockSession({ id: u.id, login: u.login, role: u.role, fullName: u.fullName, clinicId: u.clinicId, clinicName: u.clinicName, clinicSlug: u.clinicSlug, room: u.room }),
  );
}

async function makeUser(clinicId: string, clinicName: string, clinicSlug: string, role: Role, suffix: string, room: string | null): Promise<TestUser> {
  const login = `${MARKER}-${suffix}`;
  const u = await db.user.create({
    data: { clinicId, login, password: 'x', fullName: `Test ${suffix}`, role, room, color: '#00D4FF' },
    select: { id: true },
  });
  return { id: u.id, login, role, fullName: `Test ${suffix}`, clinicId, clinicName, clinicSlug, room };
}

async function cleanupClinic(clinicId: string) {
  await db.payment.deleteMany({ where: { clinicId } });
  await db.visit.deleteMany({ where: { clinicId } });
  await db.queue.deleteMany({ where: { clinicId } });
  await db.appointment.deleteMany({ where: { clinicId } });
  await db.auditLog.deleteMany({ where: { clinicId } });
  await db.smsLog.deleteMany({ where: { clinicId } });
  await db.patient.deleteMany({ where: { clinicId } });
  await db.user.deleteMany({ where: { clinicId } });
  await db.clinic.delete({ where: { id: clinicId } });
}

dbDescribe('queue (DB)', () => {
  beforeAll(async () => {
    db = (await import('@/lib/prisma')).prisma;
    svc = await import('@/lib/queue/service');

    const a = await db.clinic.create({
      data: {
        slug: `${MARKER}-a`,
        name: 'Test Queue Clinic A',
        phone: '+998901112233',
        kioskKey: KEY_A,
        ticketFooter: 'Test footer A',
        settings: parseClinicSettings({ printer: { avgServiceMinutes: 8 }, queue: { enabledTypes: ['DOCTOR', 'RECHECK', 'LAB', 'CASHIER'] } }),
      },
      select: { id: true },
    });
    const b = await db.clinic.create({
      data: {
        slug: `${MARKER}-b`,
        name: 'Test Queue Clinic B',
        phone: '+998901112244',
        kioskKey: KEY_B,
        settings: parseClinicSettings({ queue: { enabledTypes: ['DOCTOR'] } }),
      },
      select: { id: true },
    });
    ctx.clinicA = a.id;
    ctx.clinicB = b.id;
    ctx.doctorA = await makeUser(a.id, 'Test Queue Clinic A', `${MARKER}-a`, 'DOCTOR', 'doctor-a', '3');
    ctx.receptionA = await makeUser(a.id, 'Test Queue Clinic A', `${MARKER}-a`, 'RECEPTION', 'reception-a', 'Registratura');
    ctx.cashierA = await makeUser(a.id, 'Test Queue Clinic A', `${MARKER}-a`, 'CASHIER', 'cashier-a', 'Kassa');
    ctx.doctorB = await makeUser(b.id, 'Test Queue Clinic B', `${MARKER}-b`, 'DOCTOR', 'doctor-b', '1');
    const p = await db.patient.create({
      data: { clinicId: a.id, cardNumber: `${MARKER}-p1`, fullName: 'Testov Bemor', birthDate: new Date('1990-01-01T00:00:00Z'), gender: 'MALE', phone: '+998901234567' },
      select: { id: true },
    });
    ctx.patientA = p.id;
  }, 60_000);

  afterAll(async () => {
    if (!db) return;
    if (ctx.clinicA) await cleanupClinic(ctx.clinicA);
    if (ctx.clinicB) await cleanupClinic(ctx.clinicB);
    await db.$disconnect();
  }, 60_000);

  describe('createTicket raqamlash', () => {
    it('bir kunda ketma-ket: A-001, A-002; boshqa tur oʻz prefiksi bilan B-001', async () => {
      const t1 = await svc.createTicket({ clinicId: ctx.clinicA, type: 'DOCTOR', dateKey: DAY1 });
      const t2 = await svc.createTicket({ clinicId: ctx.clinicA, type: 'DOCTOR', dateKey: DAY1 });
      const t3 = await svc.createTicket({ clinicId: ctx.clinicA, type: 'RECHECK', dateKey: DAY1 });
      expect(t1.row.number).toBe('A-001');
      expect(t2.row.number).toBe('A-002');
      expect(t3.row.number).toBe('B-001');
      expect(t1.row.seq).toBe(1);
      expect(t2.row.seq).toBe(2);
      expect(t1.row.status).toBe('WAITING');
      expect(t1.row.date.toISOString().slice(0, 10)).toBe(DAY1);
    });

    it('yangi kun — yana 001 dan', async () => {
      const t = await svc.createTicket({ clinicId: ctx.clinicA, type: 'DOCTOR', dateKey: DAY2 });
      expect(t.row.number).toBe('A-001');
      expect(t.ahead).toBe(0);
      expect(t.waitMin).toBe(0);
    });

    it('oldindagilar soni va kutish vaqti (avgServiceMinutes = 8)', async () => {
      const t = await svc.createTicket({ clinicId: ctx.clinicA, type: 'DOCTOR', dateKey: DAY1 });
      expect(t.row.number).toBe('A-003');
      expect(t.ahead).toBe(2);
      expect(t.waitMin).toBe(16);
    });

    it('bemor va shifokor tekshiruvi', async () => {
      await expect(svc.createTicket({ clinicId: ctx.clinicA, type: 'DOCTOR', dateKey: DAY1, patientId: 'nope' })).rejects.toMatchObject({ status: 404 });
      await expect(svc.createTicket({ clinicId: ctx.clinicA, type: 'DOCTOR', dateKey: DAY1, doctorId: ctx.doctorB!.id })).rejects.toMatchObject({ status: 404 });
      const t = await svc.createTicket({ clinicId: ctx.clinicA, type: 'DOCTOR', dateKey: DAY1, patientId: ctx.patientA, doctorId: ctx.doctorA!.id });
      expect(t.row.patient?.id).toBe(ctx.patientA);
      expect(t.row.doctor?.id).toBe(ctx.doctorA!.id);
      expect(t.row.room).toBe('3');
    });

    it('kiosk: oʻchirilgan tur rad etiladi', async () => {
      await expect(svc.createTicket({ clinicId: ctx.clinicB, type: 'LAB', dateKey: DAY1, enforceEnabled: true })).rejects.toMatchObject({ status: 400 });
    });

    it('parallel 10 ta talon — takrorlanmas raqamlar', async () => {
      const results = await Promise.all(Array.from({ length: 10 }, () => svc.createTicket({ clinicId: ctx.clinicA, type: 'DOCTOR', dateKey: DAY3 })));
      const numbers = results.map((r) => r.row.number);
      expect(new Set(numbers).size).toBe(10);
      expect([...numbers].sort()).toEqual(Array.from({ length: 10 }, (_, i) => `A-${String(i + 1).padStart(3, '0')}`));
    }, 30_000);
  });

  describe('chaqirish va holatlar', () => {
    it('callNext (shifokor): birinchi WAITING → CALLED, shifokor xonasi, audit', async () => {
      const first = await svc.callNext(ctx.clinicA, 'DOCTOR', { id: ctx.doctorA!.id, role: 'DOCTOR', room: '3' }, DAY1);
      expect(first).not.toBeNull();
      expect(first!.number).toBe('A-001');
      expect(first!.status).toBe('CALLED');
      expect(first!.doctorId).toBe(ctx.doctorA!.id);
      expect(first!.room).toBe('3');
      expect(first!.calledAt).toBeInstanceOf(Date);
      const audit = await db.auditLog.findFirst({ where: { clinicId: ctx.clinicA, action: 'QUEUE_CALL', entityId: first!.id } });
      expect(audit).not.toBeNull();
    });

    it('serve → done; DONE dan call → 409', async () => {
      const board = await svc.getBoard(ctx.clinicA, DAY1);
      const called = board.called.find((r) => r.number === 'A-001')!;
      const serving = await svc.setStatus(ctx.clinicA, called.id, 'serve', { id: ctx.doctorA!.id, role: 'DOCTOR', room: '3' });
      expect(serving.status).toBe('SERVING');
      expect(serving.servedAt).toBeInstanceOf(Date);
      const done = await svc.setStatus(ctx.clinicA, called.id, 'done', { id: ctx.doctorA!.id, role: 'DOCTOR', room: '3' });
      expect(done.status).toBe('DONE');
      await expect(svc.setStatus(ctx.clinicA, called.id, 'call', { id: ctx.doctorA!.id, role: 'DOCTOR' })).rejects.toMatchObject({ status: 409, code: 'CONFLICT' });
    });

    it('skip → recall (CALLED) → requeue (WAITING)', async () => {
      const board = await svc.getBoard(ctx.clinicA, DAY1);
      const w = board.waiting[0]!;
      const skipped = await svc.setStatus(ctx.clinicA, w.id, 'skip', { id: ctx.receptionA!.id, role: 'RECEPTION' });
      expect(skipped.status).toBe('SKIPPED');
      const recalled = await svc.setStatus(ctx.clinicA, w.id, 'recall', { id: ctx.receptionA!.id, role: 'RECEPTION' });
      expect(recalled.status).toBe('CALLED');
      const requeued = await svc.setStatus(ctx.clinicA, w.id, 'recall', { id: ctx.receptionA!.id, role: 'RECEPTION' }, { requeue: true });
      expect(requeued.status).toBe('WAITING');
      expect(requeued.calledAt).toBeNull();
    });

    it('shifokor boshqa shifokorga biriktirilgan talonni chaqira olmaydi', async () => {
      const t = await svc.createTicket({ clinicId: ctx.clinicA, type: 'DOCTOR', dateKey: DAY2, doctorId: ctx.doctorA!.id });
      const other = await makeUser(ctx.clinicA, 'Test Queue Clinic A', `${MARKER}-a`, 'DOCTOR', 'doctor-a2', '5');
      await expect(svc.setStatus(ctx.clinicA, t.row.id, 'call', { id: other.id, role: 'DOCTOR', room: '5' })).rejects.toMatchObject({ status: 403 });
      const next = await svc.callNext(ctx.clinicA, 'DOCTOR', { id: other.id, role: 'DOCTOR', room: '5' }, DAY2);
      // DAY2 da: A-001 (biriktirilmagan) → chaqiriladi; A-002 (doctorA ga) qoladi
      expect(next?.number).toBe('A-001');
      const again = await svc.callNext(ctx.clinicA, 'DOCTOR', { id: other.id, role: 'DOCTOR', room: '5' }, DAY2);
      expect(again).toBeNull();
    });

    it('getBoard / getDisplayState / pollQueueEvents', async () => {
      const since = new Date(Date.now() - 60_000);
      const board = await svc.getBoard(ctx.clinicA, DAY1);
      expect(board.stats.total).toBeGreaterThanOrEqual(5);
      expect(board.done.some((r) => r.number === 'A-001')).toBe(true);
      const clinic = await svc.loadQueueClinic(ctx.clinicA);
      const display = await svc.getDisplayState(clinic, DAY1);
      expect(display.clinicName).toBe('Test Queue Clinic A');
      expect(display.waitingCount).toBe(board.stats.waiting);
      const events = await svc.pollQueueEvents(ctx.clinicA, since);
      expect(events.length).toBeGreaterThan(0);
      expect(events.every((e) => typeof e.at === 'string' && e.number.length > 0)).toBe(true);
    });
  });

  describe('API (sessiya bilan)', () => {
    it('DOCTOR: boshqa klinika taxtasini koʻra olmaydi (?clinicId= eʼtiborsiz), talon 404', async () => {
      const tB = await svc.createTicket({ clinicId: ctx.clinicB, type: 'DOCTOR', dateKey: DAY1 });
      asUser(ctx.doctorA);
      const board = await readData<QueueBoardDTO>(await boardGET(makeRequest('GET', `/api/queue?date=${DAY1}&clinicId=${ctx.clinicB}`)));
      const ids = [...board.waiting, ...board.called, ...board.serving, ...board.done, ...board.skipped].map((r) => r.id);
      expect(ids).not.toContain(tB.row.id);
      expect(ids.length).toBeGreaterThan(0);
      const err = await readError(await ticketGET(makeRequest('GET', `/api/queue/${tB.row.id}`), { params: { id: tB.row.id } }));
      expect(err.status).toBe(404);
    });

    it('RECEPTION: POST /api/queue → talon + ticketData; print; patient link; CASHIER link → 403', async () => {
      asUser(ctx.receptionA);
      const created = await readData<CreatedTicketDTO>(await createPOST(makeRequest('POST', '/api/queue', { type: 'DOCTOR', locale: 'ru' })));
      expect(created.number).toMatch(/^A-\d{3}$/);
      expect(created.status).toBe('WAITING');
      expect(created.ticketData.service).toBe('Приём врача');
      expect(created.ticketData.clinicName).toBe('Test Queue Clinic A');
      expect(created.ticketData.number).toBe(created.number);
      expect(typeof created.ahead).toBe('number');

      const printed = await readData<TicketWithDataDTO>(await printPOST(makeRequest('POST', `/api/queue/${created.id}/print`, { locale: 'uz' }), { params: { id: created.id } }));
      expect(printed.ticket.printedAt).not.toBeNull();
      expect(printed.ticketData.service).toBe('Shifokor qabuli');

      const linked = await readData<QueueRowDTO>(await patientPOST(makeRequest('POST', `/api/queue/${created.id}/patient`, { patientId: ctx.patientA }), { params: { id: created.id } }));
      expect(linked.patient?.id).toBe(ctx.patientA);

      asUser(ctx.cashierA);
      const forbidden = await readError(await patientPOST(makeRequest('POST', `/api/queue/${created.id}/patient`, { patientId: ctx.patientA }), { params: { id: created.id } }));
      expect(forbidden.status).toBe(403);
    });

    it('DOCTOR: next → CALLED; visit → Visit yaratiladi, talon SERVING; bemorsiz → 400', async () => {
      asUser(ctx.doctorA);
      const next = await readData<NextTicketResultDTO>(await nextPOST(makeRequest('POST', '/api/queue/next', { type: 'DOCTOR' })));
      expect(next.ticket).not.toBeNull();
      expect(next.ticket!.status).toBe('CALLED');
      expect(next.ticket!.doctorId).toBe(ctx.doctorA!.id);

      // bemor biriktirilgan talon (yuqoridagi testda) — qabul ochiladi
      const withPatient = await db.queue.findFirst({ where: { clinicId: ctx.clinicA, date: new Date(`${todayKey()}T00:00:00.000Z`), patientId: ctx.patientA }, orderBy: { createdAt: 'desc' } });
      expect(withPatient).not.toBeNull();
      const res = await visitPOST(makeRequest('POST', `/api/queue/${withPatient!.id}/visit`, {}), { params: { id: withPatient!.id } });
      expect(res.status).toBe(201);
      const created = await readData<VisitFromTicketResultDTO>(res);
      expect(created.visitId).toBeTruthy();
      expect(created.existing).toBe(false);
      expect(created.ticket.status).toBe('SERVING');
      expect(created.ticket.visit?.id).toBe(created.visitId);
      const visit = await db.visit.findUnique({ where: { id: created.visitId } });
      expect(visit).toMatchObject({ clinicId: ctx.clinicA, patientId: ctx.patientA, doctorId: ctx.doctorA!.id, queueId: withPatient!.id, status: 'OPEN' });
      expect(Number(visit!.totalNet)).toBe(0);

      // ikkinchi marta — mavjud qabul qaytadi (idempotent)
      const again = await readData<VisitFromTicketResultDTO>(await visitPOST(makeRequest('POST', `/api/queue/${withPatient!.id}/visit`), { params: { id: withPatient!.id } }));
      expect(again.existing).toBe(true);
      expect(again.visitId).toBe(created.visitId);

      // bemorsiz talon → 400 PATIENT_REQUIRED
      const anon = await svc.createTicket({ clinicId: ctx.clinicA, type: 'DOCTOR' });
      const err = await readError(await visitPOST(makeRequest('POST', `/api/queue/${anon.row.id}/visit`), { params: { id: anon.row.id } }));
      expect(err.status).toBe(400);
      expect((err.details as { code?: string })?.code).toBe('PATIENT_REQUIRED');

      // done / skip / recall / call yoʻllari
      const done = await readData<QueueRowDTO>(await donePOST(makeRequest('POST', `/api/queue/${anon.row.id}/done`), { params: { id: anon.row.id } }));
      expect(done.status).toBe('DONE');
      const t2 = await svc.createTicket({ clinicId: ctx.clinicA, type: 'RECHECK' });
      const skipped = await readData<QueueRowDTO>(await skipPOST(makeRequest('POST', `/api/queue/${t2.row.id}/skip`), { params: { id: t2.row.id } }));
      expect(skipped.status).toBe('SKIPPED');
      const recalled = await readData<QueueRowDTO>(await recallPOST(makeRequest('POST', `/api/queue/${t2.row.id}/recall`), { params: { id: t2.row.id } }));
      expect(recalled.status).toBe('CALLED');
      const requeued = await readData<QueueRowDTO>(await recallPOST(makeRequest('POST', `/api/queue/${t2.row.id}/recall`, { requeue: true }), { params: { id: t2.row.id } }));
      expect(requeued.status).toBe('WAITING');
      const called = await readData<QueueRowDTO>(await callPOST(makeRequest('POST', `/api/queue/${t2.row.id}/call`), { params: { id: t2.row.id } }));
      expect(called.status).toBe('CALLED');
      expect(called.room).toBe('3');

      const state = await readData<QueueBoardDTO>(await stateGET(makeRequest('GET', '/api/queue/state')));
      expect(state.dateKey).toBe(todayKey());
    });

    it('sessiyasiz → 401; print/raw sozlanmagan printer → PRINTER_ERROR', async () => {
      vi.mocked(getServerSession).mockResolvedValue(null);
      const err = await readError(await boardGET(makeRequest('GET', '/api/queue')));
      expect(err.status).toBe(401);
      asUser(ctx.receptionA);
      const printErr = await readError(await printRawPOST(makeRequest('POST', '/api/print/raw', { bytesBase64: 'AQID' })));
      expect(printErr.status).toBe(400);
      expect(printErr.code).toBe('PRINTER_ERROR');
      expect((printErr.details as { code?: string })?.code).toBe('NETWORK_NOT_CONFIGURED');
    });
  });

  describe('API (ochiq: kiosk / tablo)', () => {
    it('POST /api/kiosk/ticket: kalitsiz 400, notoʻgʻri kalit 404, oʻchirilgan tur 400, toʻgʻri → 201', async () => {
      resetRateLimits();
      asUser(ctx.doctorA); // sessiya boʻlsa ham kalit shart
      const noKey = await readError(await kioskTicketPOST(makeRequest('POST', '/api/kiosk/ticket', { type: 'DOCTOR' })));
      expect(noKey.status).toBe(400);
      expect(noKey.code).toBe('VALIDATION');
      const badKey = await readError(await kioskTicketPOST(makeRequest('POST', '/api/kiosk/ticket', { key: `${MARKER}-wrong`, type: 'DOCTOR' })));
      expect(badKey.status).toBe(404);
      const disabled = await readError(await kioskTicketPOST(makeRequest('POST', '/api/kiosk/ticket', { key: KEY_B, type: 'LAB' })));
      expect(disabled.status).toBe(400);
      expect((disabled.details as { code?: string })?.code).toBe('TYPE_DISABLED');

      const res = await kioskTicketPOST(makeRequest('POST', '/api/kiosk/ticket', { key: KEY_A, type: 'CASHIER', locale: 'uz' }));
      expect(res.status).toBe(201);
      const data = await readData<KioskTicketResultDTO>(res);
      expect(data.ticket.number).toMatch(/^D-\d{3}$/);
      expect(data.ticket.clinicId).toBe(ctx.clinicA);
      expect(data.ticketData.service).toBe('Kassa');
      expect(data.ticketData.footer).toBe('Test footer A');
      expect(data.showSeconds).toBe(5);
      expect(data.ticket.ticketData.number).toBe(data.ticket.number);
    });

    it('GET /api/display/state?key= → tablo holati; kalitsiz 400', async () => {
      const state = await readData<DisplayStateDTO>(await displayStateGET(makeRequest('GET', `/api/display/state?key=${KEY_A}`)));
      expect(state.clinicName).toBe('Test Queue Clinic A');
      expect(state.waitingCount).toBeGreaterThanOrEqual(1);
      expect(state.called.length).toBeGreaterThanOrEqual(1);
      expect(state.called.length).toBeLessThanOrEqual(5);
      expect(state.current?.status).toBe('CALLED');
      expect(typeof state.waitingByType.CASHIER).toBe('number');
      const err = await readError(await displayStateGET(makeRequest('GET', '/api/display/state')));
      expect(err.status).toBe(400);
    });

    it('tezlik chegarasi: 30/daqiqa IP boʻyicha → 429', async () => {
      resetRateLimits();
      const headers = { 'x-forwarded-for': '203.0.113.9' };
      for (let i = 0; i < 30; i++) {
        const r = await kioskPrintPOST(makeRequest('POST', '/api/kiosk/print', { key: KEY_A, bytesBase64: 'AQID' }, headers));
        expect(r.status).not.toBe(429);
      }
      const blocked = await readError(await kioskPrintPOST(makeRequest('POST', '/api/kiosk/print', { key: KEY_A, bytesBase64: 'AQID' }, headers)));
      expect(blocked.status).toBe(429);
      expect(blocked.code).toBe('RATE_LIMITED');
      // boshqa IP — ruxsat (printer sozlanmagan → PRINTER_ERROR, lekin 429 emas)
      const other = await readError(await kioskPrintPOST(makeRequest('POST', '/api/kiosk/print', { key: KEY_A, bytesBase64: 'AQID' }, { 'x-forwarded-for': '203.0.113.10' })));
      expect(other.code).toBe('PRINTER_ERROR');
      resetRateLimits();
    });
  });
});
