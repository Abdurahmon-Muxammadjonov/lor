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
import type { Prisma, Role } from '@prisma/client';
import { mockSession } from '../helpers/session';
import { makeRequest, readData, readError } from '../helpers/request';
import { GET as listGET, POST as createPOST } from '@/app/api/appointments/route';
import { GET as oneGET, PATCH as onePATCH, DELETE as oneDELETE } from '@/app/api/appointments/[id]/route';
import { POST as statusPOST } from '@/app/api/appointments/[id]/status/route';
import { GET as slotsGET } from '@/app/api/appointments/slots/route';
import { todayKey } from '@/lib/date';
import { addDaysKey, atTz, tzDayOfWeek } from '@/lib/appointments/availability';
import type {
  AppointmentDTO,
  AppointmentErrorDetails,
  AppointmentListDTO,
  SlotsDTO,
} from '@/lib/appointments/types';

const HAS_DB = !!process.env.DATABASE_URL;
const dbDescribe = HAS_DB ? describe : describe.skip;

const MARKER = 'ZZAPPT';

interface TestUser {
  id: string;
  login: string;
  role: Role;
  fullName: string;
  clinicId: string;
}

type PrismaModule = typeof import('@/lib/prisma');
let db: PrismaModule['prisma'];

const clinics: Record<
  'demo' | 'lorPlus',
  { id: string; slug: string; slotMinutes: number; settings: unknown }
> = {
  demo: { id: '', slug: 'demo', slotMinutes: 20, settings: {} },
  lorPlus: { id: '', slug: 'lor-plus', slotMinutes: 30, settings: {} },
};
const users: Record<string, TestUser> = {};
const patients: { demo: string; lorPlus: string } = { demo: '', lorPlus: '' };

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

/** Ikki haftadan keyingi seshanba — seed yozilishlari (shu hafta) bilan kesishmaydi */
function targetDateKey(): string {
  let key = addDaysKey(todayKey(), 14);
  while (tzDayOfWeek(key) !== 2) key = addDaysKey(key, 1);
  return key;
}

const DATE = targetDateKey();
const SUNDAY = (() => {
  let key = DATE;
  while (tzDayOfWeek(key) !== 0) key = addDaysKey(key, 1);
  return key;
})();
const at = (hm: string, key = DATE) => atTz(key, hm).toISOString();

const details = (d: unknown) => d as AppointmentErrorDetails;

async function cleanup() {
  const rows = await db.patient.findMany({ where: { fullName: { contains: MARKER } }, select: { id: true } });
  const ids = rows.map((r) => r.id);
  if (ids.length === 0) return;
  const appts = await db.appointment.findMany({ where: { patientId: { in: ids } }, select: { id: true } });
  const apptIds = appts.map((a) => a.id);
  await db.smsLog.deleteMany({ where: { patientId: { in: ids } } });
  await db.queue.deleteMany({ where: { patientId: { in: ids } } });
  if (apptIds.length)
    await db.auditLog.deleteMany({ where: { entity: 'Appointment', entityId: { in: apptIds } } });
  await db.appointment.deleteMany({ where: { patientId: { in: ids } } });
  await db.patient.deleteMany({ where: { id: { in: ids } } });
}

dbDescribe('appointments API (DB)', () => {
  beforeAll(async () => {
    db = (await import('@/lib/prisma')).prisma;
    const rows = await db.clinic.findMany({
      where: { slug: { in: ['demo', 'lor-plus'] } },
      select: { id: true, slug: true, slotMinutes: true, settings: true },
    });
    for (const c of rows) {
      if (c.slug === 'demo') clinics.demo = c;
      if (c.slug === 'lor-plus') clinics.lorPlus = c;
    }
    expect(clinics.demo.id).toBeTruthy();
    expect(clinics.lorPlus.id).toBeTruthy();
    const us = await db.user.findMany({
      where: { login: { in: ['admin', 'doctor', 'doctor2', 'reception', 'cashier', 'admin2', 'doctor4'] } },
      select: { id: true, login: true, role: true, fullName: true, clinicId: true },
    });
    for (const u of us) users[u.login] = u;
    for (const l of ['admin', 'doctor', 'doctor2', 'reception', 'cashier', 'admin2', 'doctor4'])
      expect(users[l], `seed user ${l}`).toBeTruthy();
    await cleanup();
    const demoPatient = await db.patient.create({
      data: {
        clinicId: clinics.demo.id,
        cardNumber: `ZZ-${MARKER}-1`,
        fullName: `Testov Yozilish ${MARKER}`,
        birthDate: new Date('1990-01-01T00:00:00.000Z'),
        gender: 'MALE',
        phone: '+998997002201',
        smsConsent: true,
      },
      select: { id: true },
    });
    const plusPatient = await db.patient.create({
      data: {
        clinicId: clinics.lorPlus.id,
        cardNumber: `ZZ-${MARKER}-2`,
        fullName: `Plusova Yozilish ${MARKER}`,
        birthDate: new Date('1985-05-05T00:00:00.000Z'),
        gender: 'FEMALE',
        phone: '+998997002202',
        smsConsent: true,
      },
      select: { id: true },
    });
    patients.demo = demoPatient.id;
    patients.lorPlus = plusPatient.id;
  });

  afterAll(async () => {
    if (!db) return;
    await cleanup();
    await db.$disconnect();
  });

  let apptA: AppointmentDTO;
  let apptB: AppointmentDTO;
  let apptC: AppointmentDTO;

  it('RECEPTION yozilish yaratadi → 201, SCHEDULED, endAt = startAt + davomiylik, audit CREATE', async () => {
    actAs('reception');
    const res = await createPOST(
      makeRequest('POST', '/api/appointments', {
        patientId: patients.demo,
        doctorId: users.doctor!.id,
        startAt: at('10:00'),
        durationMin: 30,
        note: `${MARKER} test`,
      }),
    );
    expect(res.status).toBe(201);
    const data = await readData<AppointmentDTO & { smsQueued: boolean }>(res);
    apptA = data;
    expect(data.status).toBe('SCHEDULED');
    expect(new Date(data.startAt).toISOString()).toBe(at('10:00'));
    expect(new Date(data.endAt).getTime() - new Date(data.startAt).getTime()).toBe(30 * 60000);
    expect(data.createdById).toBe(users.reception!.id);
    expect(data.doctor.id).toBe(users.doctor!.id);
    expect(data.patient.fullName).toContain(MARKER);
    expect(data.note).toBe(`${MARKER} test`);
    expect(data.smsQueued).toBe(false); // demo klinikada SMS oʻchirilgan
    const audit = await db.auditLog.findFirst({
      where: { entity: 'Appointment', entityId: data.id, action: 'CREATE' },
    });
    expect(audit?.userId).toBe(users.reception!.id);
  });

  it('davomiylik berilmasa clinic.slotMinutes', async () => {
    actAs('admin');
    const res = await createPOST(
      makeRequest('POST', '/api/appointments', {
        patientId: patients.demo,
        doctorId: users.doctor!.id,
        startAt: at('15:00'),
      }),
    );
    const data = await readData<AppointmentDTO>(res);
    expect(new Date(data.endAt).getTime() - new Date(data.startAt).getTime()).toBe(
      clinics.demo.slotMinutes * 60000,
    );
    const del = await oneDELETE(makeRequest('DELETE', `/api/appointments/${data.id}`), ctx(data.id));
    expect(del.status).toBe(200);
  });

  it('kesishuv → 409 CONFLICT { reason: OVERLAP, conflictId }', async () => {
    actAs('reception');
    const res = await createPOST(
      makeRequest('POST', '/api/appointments', {
        patientId: patients.demo,
        doctorId: users.doctor!.id,
        startAt: at('10:10'),
        durationMin: 20,
      }),
    );
    const err = await readError(res);
    expect(err.status).toBe(409);
    expect(err.code).toBe('CONFLICT');
    expect(details(err.details).reason).toBe('OVERLAP');
    expect(details(err.details).conflictId).toBe(apptA.id);
  });

  it('chegaraga tegib turgan (10:30) va boshqa shifokorda bir xil vaqt — ruxsat', async () => {
    actAs('reception');
    apptB = await readData<AppointmentDTO>(
      await createPOST(
        makeRequest('POST', '/api/appointments', {
          patientId: patients.demo,
          doctorId: users.doctor!.id,
          startAt: at('10:30'),
          durationMin: 20,
        }),
      ),
    );
    expect(apptB.status).toBe('SCHEDULED');
    apptC = await readData<AppointmentDTO>(
      await createPOST(
        makeRequest('POST', '/api/appointments', {
          patientId: patients.demo,
          doctorId: users.doctor2!.id,
          startAt: at('10:00'),
          durationMin: 20,
        }),
      ),
    );
    expect(apptC.doctorId).toBe(users.doctor2!.id);
  });

  it('jadval: dam olish kuni / ish vaqtidan tashqari / tanaffus / oʻtgan sana → 400 VALIDATION reason', async () => {
    actAs('reception');
    const body = (startAt: string) => ({
      patientId: patients.demo,
      doctorId: users.doctor!.id,
      startAt,
      durationMin: 20,
    });
    const dayOff = await readError(
      await createPOST(makeRequest('POST', '/api/appointments', body(at('10:00', SUNDAY)))),
    );
    expect(dayOff.status).toBe(400);
    expect(details(dayOff.details).reason).toBe('DAY_OFF');
    const outside = await readError(
      await createPOST(makeRequest('POST', '/api/appointments', body(at('19:00')))),
    );
    expect(details(outside.details).reason).toBe('OUTSIDE_HOURS');
    const brk = await readError(
      await createPOST(makeRequest('POST', '/api/appointments', body(at('13:00')))),
    );
    expect(details(brk.details).reason).toBe('BREAK');
    const past = await readError(
      await createPOST(
        makeRequest('POST', '/api/appointments', body(at('10:00', addDaysKey(todayKey(), -7)))),
      ),
    );
    expect(details(past.details).reason).toBe('PAST');
    const badBody = await readError(
      await createPOST(
        makeRequest('POST', '/api/appointments', {
          patientId: patients.demo,
          doctorId: users.doctor!.id,
          startAt: at('10:00'),
          durationMin: 3,
        }),
      ),
    );
    expect(badBody.status).toBe(400);
    expect(badBody.code).toBe('VALIDATION');
  });

  it('boshqa klinika bemori / shifokori → 400 PATIENT / DOCTOR', async () => {
    actAs('reception');
    const p = await readError(
      await createPOST(
        makeRequest('POST', '/api/appointments', {
          patientId: patients.lorPlus,
          doctorId: users.doctor!.id,
          startAt: at('16:00'),
        }),
      ),
    );
    expect(p.status).toBe(400);
    expect(details(p.details).reason).toBe('PATIENT');
    const d = await readError(
      await createPOST(
        makeRequest('POST', '/api/appointments', {
          patientId: patients.demo,
          doctorId: users.doctor4!.id,
          startAt: at('16:00'),
        }),
      ),
    );
    expect(details(d.details).reason).toBe('DOCTOR');
  });

  it('GET roʻyxat: oraliq va doctorId filtri', async () => {
    actAs('doctor');
    const from = at('00:00');
    const to = at('23:59');
    const all = await readData<AppointmentListDTO>(
      await listGET(
        makeRequest('GET', `/api/appointments?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
      ),
    );
    const ids = all.items.map((a) => a.id);
    expect(ids).toContain(apptA.id);
    expect(ids).toContain(apptB.id);
    expect(ids).toContain(apptC.id);
    expect(all.items.every((a) => a.clinicId === clinics.demo.id)).toBe(true);
    const only2 = await readData<AppointmentListDTO>(
      await listGET(
        makeRequest(
          'GET',
          `/api/appointments?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&doctorId=${users.doctor2!.id}`,
        ),
      ),
    );
    expect(only2.items.map((a) => a.id)).toContain(apptC.id);
    expect(only2.items.map((a) => a.id)).not.toContain(apptA.id);
    const bad = await readError(
      await listGET(
        makeRequest('GET', `/api/appointments?from=${encodeURIComponent(to)}&to=${encodeURIComponent(from)}`),
      ),
    );
    expect(bad.status).toBe(400);
  });

  it('boʻsh slotlar: band vaqtlar TAKEN, tanaffus BREAK, qolganlari boʻsh', async () => {
    actAs('reception');
    const slots = await readData<SlotsDTO>(
      await slotsGET(makeRequest('GET', `/api/appointments/slots?doctorId=${users.doctor!.id}&date=${DATE}`)),
    );
    expect(slots.slotMinutes).toBe(clinics.demo.slotMinutes);
    expect(slots.day.enabled).toBe(true);
    const by = new Map(slots.slots.map((s) => [s.time, s]));
    expect(by.get('10:00')?.reason).toBe('TAKEN');
    expect(by.get('10:20')?.reason).toBe('TAKEN');
    expect(by.get('10:40')?.reason).toBe('TAKEN');
    expect(by.get('11:00')?.available).toBe(true);
    expect(by.get('13:00')?.reason).toBe('BREAK');
    expect(by.get('08:00')?.reason).toBe('OUTSIDE_HOURS');
    // tahrirlashda oʻz vaqti band emas
    const excl = await readData<SlotsDTO>(
      await slotsGET(
        makeRequest(
          'GET',
          `/api/appointments/slots?doctorId=${users.doctor!.id}&date=${DATE}&excludeId=${apptA.id}`,
        ),
      ),
    );
    expect(excl.slots.find((s) => s.time === '10:00')?.available).toBe(true);
    const sunday = await readData<SlotsDTO>(
      await slotsGET(
        makeRequest('GET', `/api/appointments/slots?doctorId=${users.doctor!.id}&date=${SUNDAY}`),
      ),
    );
    expect(sunday.day.enabled).toBe(false);
    expect(sunday.slots.every((s) => !s.available)).toBe(true);
  });

  it('koʻchirish (PATCH startAt) → 200; boshqa yozilish ustiga → 409 OVERLAP; faqat izoh → 200', async () => {
    actAs('reception');
    const moved = await readData<AppointmentDTO>(
      await onePATCH(
        makeRequest('PATCH', `/api/appointments/${apptA.id}`, { startAt: at('11:00') }),
        ctx(apptA.id),
      ),
    );
    expect(new Date(moved.startAt).toISOString()).toBe(at('11:00'));
    expect(new Date(moved.endAt).toISOString()).toBe(at('11:30'));
    apptA = moved;
    const clash = await readError(
      await onePATCH(
        makeRequest('PATCH', `/api/appointments/${apptB.id}`, { startAt: at('11:10') }),
        ctx(apptB.id),
      ),
    );
    expect(clash.status).toBe(409);
    expect(details(clash.details).reason).toBe('OVERLAP');
    expect(details(clash.details).conflictId).toBe(apptA.id);
    const noted = await readData<AppointmentDTO>(
      await onePATCH(
        makeRequest('PATCH', `/api/appointments/${apptA.id}`, { note: 'yangi izoh' }),
        ctx(apptA.id),
      ),
    );
    expect(noted.note).toBe('yangi izoh');
    expect(new Date(noted.startAt).toISOString()).toBe(at('11:00'));
    const empty = await readError(
      await onePATCH(makeRequest('PATCH', `/api/appointments/${apptA.id}`, {}), ctx(apptA.id)),
    );
    expect(empty.status).toBe(400);
    // shifokorni oʻzgartirish: doctor2 da 10:00–10:20 band (apptC), 11:00 boʻsh
    const toDoc2 = await readData<AppointmentDTO>(
      await onePATCH(
        makeRequest('PATCH', `/api/appointments/${apptB.id}`, {
          doctorId: users.doctor2!.id,
          startAt: at('11:00'),
        }),
        ctx(apptB.id),
      ),
    );
    expect(toDoc2.doctorId).toBe(users.doctor2!.id);
    apptB = toDoc2;
  });

  it('ARRIVED → holat saqlanadi; keyin koʻchirish 409 LOCKED, oʻchirish 409 STATUS, DONE ok, DONE → CANCELLED 409 TRANSITION', async () => {
    actAs('reception');
    const arrived = await readData<AppointmentDTO>(
      await statusPOST(
        makeRequest('POST', `/api/appointments/${apptA.id}/status`, { status: 'ARRIVED' }),
        ctx(apptA.id),
      ),
    );
    expect(arrived.status).toBe('ARRIVED');
    const audit = await db.auditLog.findFirst({
      where: { entity: 'Appointment', entityId: apptA.id, action: 'UPDATE' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).toBeTruthy();
    const locked = await readError(
      await onePATCH(
        makeRequest('PATCH', `/api/appointments/${apptA.id}`, { startAt: at('12:00') }),
        ctx(apptA.id),
      ),
    );
    expect(locked.status).toBe(409);
    expect(details(locked.details).reason).toBe('LOCKED');
    const noDelete = await readError(
      await oneDELETE(makeRequest('DELETE', `/api/appointments/${apptA.id}`), ctx(apptA.id)),
    );
    expect(noDelete.status).toBe(409);
    expect(details(noDelete.details).reason).toBe('STATUS');
    const done = await readData<AppointmentDTO>(
      await statusPOST(
        makeRequest('POST', `/api/appointments/${apptA.id}/status`, { status: 'DONE' }),
        ctx(apptA.id),
      ),
    );
    expect(done.status).toBe('DONE');
    const bad = await readError(
      await statusPOST(
        makeRequest('POST', `/api/appointments/${apptA.id}/status`, { status: 'CANCELLED' }),
        ctx(apptA.id),
      ),
    );
    expect(bad.status).toBe(409);
    expect(details(bad.details).reason).toBe('TRANSITION');
    const invalid = await readError(
      await statusPOST(
        makeRequest('POST', `/api/appointments/${apptA.id}/status`, { status: 'LATE' }),
        ctx(apptA.id),
      ),
    );
    expect(invalid.status).toBe(400);
  });

  it('bekor qilingan yozilish vaqtni boʻshatadi; tiklashda band boʻlsa 409 OVERLAP', async () => {
    actAs('admin');
    const cancelled = await readData<AppointmentDTO>(
      await statusPOST(
        makeRequest('POST', `/api/appointments/${apptC.id}/status`, { status: 'CANCELLED' }),
        ctx(apptC.id),
      ),
    );
    expect(cancelled.status).toBe('CANCELLED');
    const d = await readData<AppointmentDTO>(
      await createPOST(
        makeRequest('POST', '/api/appointments', {
          patientId: patients.demo,
          doctorId: users.doctor2!.id,
          startAt: at('10:00'),
          durationMin: 20,
        }),
      ),
    );
    expect(d.status).toBe('SCHEDULED');
    const restore = await readError(
      await statusPOST(
        makeRequest('POST', `/api/appointments/${apptC.id}/status`, { status: 'SCHEDULED' }),
        ctx(apptC.id),
      ),
    );
    expect(restore.status).toBe(409);
    expect(details(restore.details).reason).toBe('OVERLAP');
    const del = await readData<{ id: string; deleted: boolean }>(
      await oneDELETE(makeRequest('DELETE', `/api/appointments/${d.id}`), ctx(d.id)),
    );
    expect(del.deleted).toBe(true);
    const gone = await readError(await oneGET(makeRequest('GET', `/api/appointments/${d.id}`), ctx(d.id)));
    expect(gone.status).toBe(404);
    const restored = await readData<AppointmentDTO>(
      await statusPOST(
        makeRequest('POST', `/api/appointments/${apptC.id}/status`, { status: 'SCHEDULED' }),
        ctx(apptC.id),
      ),
    );
    expect(restored.status).toBe('SCHEDULED');
  });

  it('boshqa klinika (admin2) → 404 va roʻyxatda koʻrinmaydi', async () => {
    actAs('admin2');
    expect(
      (await readError(await oneGET(makeRequest('GET', `/api/appointments/${apptA.id}`), ctx(apptA.id))))
        .status,
    ).toBe(404);
    expect(
      (
        await readError(
          await onePATCH(makeRequest('PATCH', `/api/appointments/${apptB.id}`, { note: 'x' }), ctx(apptB.id)),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await readError(
          await statusPOST(
            makeRequest('POST', `/api/appointments/${apptB.id}/status`, { status: 'CONFIRMED' }),
            ctx(apptB.id),
          ),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await readError(
          await oneDELETE(makeRequest('DELETE', `/api/appointments/${apptB.id}`), ctx(apptB.id)),
        )
      ).status,
    ).toBe(404);
    const list = await readData<AppointmentListDTO>(
      await listGET(
        makeRequest(
          'GET',
          `/api/appointments?from=${encodeURIComponent(at('00:00'))}&to=${encodeURIComponent(at('23:59'))}`,
        ),
      ),
    );
    expect(list.items.map((a) => a.id)).not.toContain(apptA.id);
    expect(list.items.every((a) => a.clinicId === clinics.lorPlus.id)).toBe(true);
    const slots = await readError(
      await slotsGET(makeRequest('GET', `/api/appointments/slots?doctorId=${users.doctor!.id}&date=${DATE}`)),
    );
    expect(slots.status).toBe(400);
    expect(details(slots.details).reason).toBe('DOCTOR');
  });

  it('CASHIER: yozish 403, koʻrish 200; DOCTOR yoza oladi', async () => {
    actAs('cashier');
    const post = await readError(
      await createPOST(
        makeRequest('POST', '/api/appointments', {
          patientId: patients.demo,
          doctorId: users.doctor!.id,
          startAt: at('16:00'),
        }),
      ),
    );
    expect(post.status).toBe(403);
    expect(
      (
        await readError(
          await onePATCH(makeRequest('PATCH', `/api/appointments/${apptB.id}`, { note: 'x' }), ctx(apptB.id)),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await readError(
          await oneDELETE(makeRequest('DELETE', `/api/appointments/${apptB.id}`), ctx(apptB.id)),
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await readError(
          await statusPOST(
            makeRequest('POST', `/api/appointments/${apptB.id}/status`, { status: 'CONFIRMED' }),
            ctx(apptB.id),
          ),
        )
      ).status,
    ).toBe(403);
    const one = await readData<AppointmentDTO>(
      await oneGET(makeRequest('GET', `/api/appointments/${apptB.id}`), ctx(apptB.id)),
    );
    expect(one.id).toBe(apptB.id);
    actAs('doctor');
    const confirmed = await readData<AppointmentDTO>(
      await statusPOST(
        makeRequest('POST', `/api/appointments/${apptB.id}/status`, { status: 'CONFIRMED' }),
        ctx(apptB.id),
      ),
    );
    expect(confirmed.status).toBe('CONFIRMED');
  });

  it('sessiyasiz → 401', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null);
    const res = await listGET(
      makeRequest(
        'GET',
        `/api/appointments?from=${encodeURIComponent(at('00:00'))}&to=${encodeURIComponent(at('23:59'))}`,
      ),
    );
    expect(res.status).toBe(401);
  });

  it('SMS yoqilgan va bemor rozi boʻlsa → SmsLog PENDING (APPOINTMENT_CONFIRM) shablon bilan', async () => {
    const original = clinics.lorPlus.settings as Prisma.InputJsonValue;
    const base = (
      original && typeof original === 'object' && !Array.isArray(original) ? original : {}
    ) as Record<string, unknown>;
    const template = '{clinic}: {name}, {date} {time} {doctor} {phone}';
    await db.clinic.update({
      where: { id: clinics.lorPlus.id },
      data: {
        settings: {
          ...base,
          sms: {
            ...((base.sms as Record<string, unknown> | undefined) ?? {}),
            enabled: true,
            confirmTemplate: template,
          },
        },
      },
    });
    try {
      actAs('admin2');
      const res = await createPOST(
        makeRequest('POST', '/api/appointments', {
          patientId: patients.lorPlus,
          doctorId: users.doctor4!.id,
          startAt: at('10:00'),
          durationMin: 30,
        }),
      );
      const data = await readData<AppointmentDTO & { smsQueued: boolean }>(res);
      expect(data.smsQueued).toBe(true);
      const sms = await db.smsLog.findFirst({
        where: { patientId: patients.lorPlus, kind: 'APPOINTMENT_CONFIRM' },
        orderBy: { createdAt: 'desc' },
      });
      expect(sms?.status).toBe('PENDING');
      expect(sms?.clinicId).toBe(clinics.lorPlus.id);
      expect(sms?.phone).toBe('+998997002202');
      const [y, m, d] = DATE.split('-');
      expect(sms?.text).toContain(`${d}.${m}.${y} 10:00`);
      expect(sms?.text).toContain('Yozilish'); // shortName → "Yozilish" (ikkinchi soʻz)
      expect(sms?.text).toContain(users.doctor4!.fullName);
      // rozilik yoʻq → SMS yozilmaydi
      await db.patient.update({ where: { id: patients.lorPlus }, data: { smsConsent: false } });
      const res2 = await createPOST(
        makeRequest('POST', '/api/appointments', {
          patientId: patients.lorPlus,
          doctorId: users.doctor4!.id,
          startAt: at('11:00'),
          durationMin: 30,
        }),
      );
      const data2 = await readData<AppointmentDTO & { smsQueued: boolean }>(res2);
      expect(data2.smsQueued).toBe(false);
      expect(await db.smsLog.count({ where: { patientId: patients.lorPlus } })).toBe(1);
    } finally {
      await db.clinic.update({ where: { id: clinics.lorPlus.id }, data: { settings: original ?? {} } });
    }
  });
});
