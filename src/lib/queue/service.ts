import type { Prisma, QueueStatus, QueueType, Role } from '@prisma/client';
import { prisma, type Tx } from '@/lib/prisma';
import { ApiError } from '@/lib/api/errors';
import { audit } from '@/lib/api/audit';
import { serialize } from '@/lib/api/respond';
import { dateKeyToDate, todayKey } from '@/lib/date';
import { estimateWait, formatQueueNumber, prefixForType } from '@/lib/queue-number';
import { parseClinicSettings, type ClinicSettings } from '@/lib/settings/types';
import type { Locale } from '@/i18n/config';
import type { TicketData } from '@/lib/printer/types';
import { publishQueueEvent, queueEventFromRow, type QueueEvent } from '@/lib/realtime/queue-events';
import { displayCalled, groupBoard, waitingByType } from './board';
import { ticketDataFor } from './ticket';
import type { DisplayStateDTO, QueueAction, QueueBoardDTO, QueueRowDTO } from './types';

/**
 * Navbat xizmati (FAQAT SERVER). Barcha soʻrovlar `clinicId` boʻyicha chegaralanadi.
 * Raqamlash: kun (Asia/Tashkent) + prefiks boʻyicha `seq`, `pg_advisory_xact_lock` bilan poyga oldini olinadi.
 */

export const queueRowInclude = {
  patient: { select: { id: true, fullName: true, cardNumber: true, phone: true, gender: true, birthDate: true } },
  doctor: { select: { id: true, fullName: true, room: true, color: true, specialty: true } },
  visit: { select: { id: true, status: true } },
} satisfies Prisma.QueueInclude;

export type QueueRow = Prisma.QueueGetPayload<{ include: typeof queueRowInclude }>;

export interface QueueClinic {
  id: string;
  name: string;
  phone: string;
  ticketFooter: string;
  kioskKey: string;
  settings: ClinicSettings;
}

export interface QueueActor {
  id: string;
  role: Role;
  room?: string | null;
  ip?: string | null;
  userAgent?: string | null;
}

/** Prisma qatori → API JSON shakli (Date → ISO) */
export function toRowDTO(row: QueueRow): QueueRowDTO {
  return serialize(row) as unknown as QueueRowDTO;
}

const CLINIC_SELECT = { id: true, name: true, phone: true, ticketFooter: true, kioskKey: true, settings: true, isActive: true } as const;

function toQueueClinic(c: { id: string; name: string; phone: string; ticketFooter: string; kioskKey: string; settings: unknown }): QueueClinic {
  return { id: c.id, name: c.name, phone: c.phone, ticketFooter: c.ticketFooter, kioskKey: c.kioskKey, settings: parseClinicSettings(c.settings) };
}

export async function loadQueueClinic(clinicId: string, db: Tx | typeof prisma = prisma): Promise<QueueClinic> {
  const c = await db.clinic.findFirst({ where: { id: clinicId }, select: CLINIC_SELECT });
  if (!c) throw ApiError.notFound('Klinika topilmadi');
  return toQueueClinic(c);
}

/** Kiosk/tablo: kalit boʻyicha faol klinika (topilmasa null) */
export async function findClinicByKioskKey(key: string): Promise<QueueClinic | null> {
  const k = key.trim();
  if (!k) return null;
  const c = await prisma.clinic.findFirst({ where: { kioskKey: k, isActive: true }, select: CLINIC_SELECT });
  return c ? toQueueClinic(c) : null;
}

/** Kalit boʻyicha klinika, boʻlmasa 404 */
export async function requireClinicByKioskKey(key: string): Promise<QueueClinic> {
  const c = await findClinicByKioskKey(key);
  if (!c) throw ApiError.notFound('Kiosk kaliti notoʻgʻri');
  return c;
}

/** Klinika + kun boʻyicha tranzaksion qulf (raqamlash va chaqiruv poygalari uchun) */
async function advisoryLock(tx: Tx, key: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}::text))`;
}

// ───────────────────────────── Talon yaratish ─────────────────────────────

export interface CreateTicketInput {
  clinicId: string;
  type: QueueType;
  patientId?: string | null;
  doctorId?: string | null;
  /** Standart: bugun (Asia/Tashkent) */
  dateKey?: string;
  now?: Date;
  /** Kiosk: faqat yoqilgan turlar */
  enforceEnabled?: boolean;
}

export interface CreatedTicket {
  row: QueueRow;
  ahead: number;
  waitMin: number;
  clinic: QueueClinic;
}

export async function createTicket(input: CreateTicketInput): Promise<CreatedTicket> {
  const dateKey = input.dateKey ?? todayKey(input.now);
  const date = dateKeyToDate(dateKey);
  const now = input.now ?? new Date();

  return prisma.$transaction(
    async (tx) => {
      const clinic = await loadQueueClinic(input.clinicId, tx);
      if (input.enforceEnabled && !clinic.settings.queue.enabledTypes.includes(input.type)) {
        throw new ApiError(400, 'VALIDATION', 'Bu navbat turi oʻchirilgan', { code: 'TYPE_DISABLED', type: input.type });
      }

      let patientId: string | null = null;
      if (input.patientId) {
        const p = await tx.patient.findFirst({ where: { id: input.patientId, clinicId: clinic.id }, select: { id: true } });
        if (!p) throw ApiError.notFound('Bemor topilmadi');
        patientId = p.id;
      }

      let doctorId: string | null = null;
      let room: string | null = null;
      if (input.doctorId) {
        const d = await tx.user.findFirst({
          where: { id: input.doctorId, clinicId: clinic.id, role: 'DOCTOR', isActive: true },
          select: { id: true, room: true },
        });
        if (!d) throw ApiError.notFound('Shifokor topilmadi yoki faol emas');
        doctorId = d.id;
        room = d.room;
      }

      await advisoryLock(tx, `${clinic.id}:${dateKey}`);

      const prefix = prefixForType(input.type, clinic.settings.queue);
      const max = await tx.queue.aggregate({ where: { clinicId: clinic.id, date, prefix }, _max: { seq: true } });
      const seq = (max._max.seq ?? 0) + 1;
      const number = formatQueueNumber(prefix, seq);

      const row = await tx.queue.create({
        data: { clinicId: clinic.id, date, number, prefix, seq, type: input.type, patientId, doctorId, room, createdAt: now },
        include: queueRowInclude,
      });

      const ahead = await tx.queue.count({
        where: { clinicId: clinic.id, date, type: input.type, status: 'WAITING', id: { not: row.id }, createdAt: { lt: row.createdAt } },
      });
      const waitMin = estimateWait(ahead, clinic.settings.printer.avgServiceMinutes);
      return { row, ahead, waitMin, clinic };
    },
    { maxWait: 10_000, timeout: 20_000 },
  );
}

// ───────────────────────────── Chaqirish / holat ─────────────────────────────

function actorRoom(actor: QueueActor, fallback: string | null): string | null {
  const r = actor.room?.trim();
  return r ? r : fallback;
}

/** Navbatdagi keyingi WAITING talonni chaqirish (shifokor — faqat oʻziga biriktirilgan yoki biriktirilmagan) */
export async function callNext(clinicId: string, type: QueueType, actor: QueueActor, dateKey = todayKey()): Promise<QueueRow | null> {
  const date = dateKeyToDate(dateKey);
  const row = await prisma.$transaction(
    async (tx) => {
      await advisoryLock(tx, `${clinicId}:call:${type}`);
      const where: Prisma.QueueWhereInput = { clinicId, date, type, status: 'WAITING' };
      if (actor.role === 'DOCTOR') where.OR = [{ doctorId: null }, { doctorId: actor.id }];
      const next = await tx.queue.findFirst({ where, orderBy: [{ createdAt: 'asc' }, { seq: 'asc' }], include: queueRowInclude });
      if (!next) return null;
      const doctorId = actor.role === 'DOCTOR' ? actor.id : next.doctorId;
      const room = actor.role === 'DOCTOR' ? actorRoom(actor, next.room ?? next.doctor?.room ?? null) : (next.room ?? next.doctor?.room ?? actorRoom(actor, null));
      const updated = await tx.queue.update({
        where: { id: next.id },
        data: { status: 'CALLED', calledAt: new Date(), doctorId, room },
        include: queueRowInclude,
      });
      await audit(
        { clinicId, userId: actor.id, action: 'QUEUE_CALL', entity: 'Queue', entityId: updated.id, before: { status: next.status }, after: { status: 'CALLED', number: updated.number, room }, ip: actor.ip, userAgent: actor.userAgent },
        tx,
      );
      return updated;
    },
    { maxWait: 10_000, timeout: 20_000 },
  );
  if (row) publishQueueEvent(clinicId, queueEventFromRow(row, null, 'called'));
  return row;
}

const ALLOWED: Record<QueueAction, readonly QueueStatus[]> = {
  call: ['WAITING', 'SKIPPED'],
  serve: ['CALLED', 'WAITING', 'SKIPPED'],
  done: ['CALLED', 'SERVING', 'WAITING', 'SKIPPED'],
  skip: ['WAITING', 'CALLED', 'SERVING'],
  recall: ['SKIPPED', 'CALLED', 'WAITING'],
};

export interface SetStatusOptions {
  /** recall: WAITING ga qaytarish (qayta chaqirish oʻrniga) */
  requeue?: boolean;
}

/** Talon holatini oʻzgartirish: call | serve | done | skip | recall */
export async function setStatus(clinicId: string, id: string, action: QueueAction, actor: QueueActor, opts: SetStatusOptions = {}): Promise<QueueRow> {
  const result = await prisma.$transaction(async (tx) => {
    const row = await tx.queue.findFirst({ where: { id, clinicId }, include: queueRowInclude });
    if (!row) throw ApiError.notFound('Talon topilmadi');

    if (!ALLOWED[action].includes(row.status)) {
      throw new ApiError(409, 'CONFLICT', 'Bu holatdan oʻtish mumkin emas', { code: 'INVALID_TRANSITION', from: row.status, action });
    }
    if (actor.role === 'DOCTOR' && row.doctorId && row.doctorId !== actor.id && (action === 'call' || action === 'serve' || action === 'recall')) {
      throw new ApiError(403, 'FORBIDDEN', 'Bu talon boshqa shifokorga biriktirilgan', { code: 'OTHER_DOCTOR' });
    }

    const now = new Date();
    const data: Prisma.QueueUncheckedUpdateInput = {};
    let eventType: QueueEvent['type'] = 'updated';
    const takeOver = () => {
      if (actor.role === 'DOCTOR') {
        data.doctorId = actor.id;
        data.room = actorRoom(actor, row.room ?? row.doctor?.room ?? null);
      } else if (!row.room) {
        data.room = row.doctor?.room ?? actorRoom(actor, null);
      }
    };

    switch (action) {
      case 'call':
        data.status = 'CALLED';
        data.calledAt = now;
        takeOver();
        eventType = 'called';
        break;
      case 'recall':
        if (opts.requeue) {
          data.status = 'WAITING';
          data.calledAt = null;
          data.servedAt = null;
        } else {
          data.status = 'CALLED';
          data.calledAt = now;
          takeOver();
          eventType = 'called';
        }
        break;
      case 'serve':
        data.status = 'SERVING';
        data.servedAt = now;
        if (!row.calledAt) data.calledAt = now;
        takeOver();
        break;
      case 'done':
        data.status = 'DONE';
        data.doneAt = now;
        if (!row.calledAt) data.calledAt = now;
        if (!row.servedAt) data.servedAt = now;
        break;
      case 'skip':
        data.status = 'SKIPPED';
        break;
    }

    const updated = await tx.queue.update({ where: { id: row.id }, data, include: queueRowInclude });
    if (action === 'call' || (action === 'recall' && !opts.requeue)) {
      await audit(
        { clinicId, userId: actor.id, action: 'QUEUE_CALL', entity: 'Queue', entityId: updated.id, before: { status: row.status }, after: { status: updated.status, number: updated.number, room: updated.room }, ip: actor.ip, userAgent: actor.userAgent },
        tx,
      );
    }
    return { updated, eventType };
  });
  publishQueueEvent(clinicId, queueEventFromRow(result.updated, null, result.eventType));
  return result.updated;
}

// ───────────────────────────── Oʻqish ─────────────────────────────

export async function getBoardRows(clinicId: string, dateKey: string): Promise<QueueRow[]> {
  return prisma.queue.findMany({
    where: { clinicId, date: dateKeyToDate(dateKey) },
    orderBy: [{ createdAt: 'asc' }],
    include: queueRowInclude,
  });
}

/** Kunlik taxta: ustunlar + statistika */
export async function getBoard(clinicId: string, dateKey = todayKey()): Promise<QueueBoardDTO> {
  const rows = await getBoardRows(clinicId, dateKey);
  return groupBoard(rows.map(toRowDTO), dateKey, new Date());
}

export async function getTicket(clinicId: string, id: string): Promise<QueueRow> {
  const row = await prisma.queue.findFirst({ where: { id, clinicId }, include: queueRowInclude });
  if (!row) throw ApiError.notFound('Talon topilmadi');
  return row;
}

/** Talon oldida hozir kutayotganlar soni (shu tur, oldinroq olingan) */
export async function aheadCount(row: Pick<QueueRow, 'id' | 'clinicId' | 'date' | 'type' | 'createdAt'>): Promise<number> {
  return prisma.queue.count({
    where: { clinicId: row.clinicId, date: row.date, type: row.type, status: 'WAITING', id: { not: row.id }, createdAt: { lt: row.createdAt } },
  });
}

/** Qator → printer TicketData (oldindagilar va kutish vaqti hisoblanadi) */
export async function ticketDataForRow(row: QueueRow, clinic: QueueClinic, locale: Locale, ahead?: number): Promise<TicketData> {
  const a = ahead ?? (row.status === 'WAITING' ? await aheadCount(row) : 0);
  const waitMin = row.status === 'WAITING' ? estimateWait(a, clinic.settings.printer.avgServiceMinutes) : 0;
  return ticketDataFor({ ...row, ahead: a, waitMin }, clinic, locale);
}

/** Chop etilganini belgilash */
export async function markPrinted(clinicId: string, id: string): Promise<QueueRow> {
  const row = await getTicket(clinicId, id);
  return prisma.queue.update({ where: { id: row.id }, data: { printedAt: new Date() }, include: queueRowInclude });
}

/** Talonga bemorni biriktirish (qabul ochilmagan boʻlsa) */
export async function linkPatient(clinicId: string, id: string, patientId: string): Promise<QueueRow> {
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.queue.findFirst({ where: { id, clinicId }, include: queueRowInclude });
    if (!row) throw ApiError.notFound('Talon topilmadi');
    if (row.visit) throw new ApiError(409, 'CONFLICT', 'Bu talon boʻyicha qabul ochilgan — bemorni oʻzgartirib boʻlmaydi', { code: 'VISIT_LINKED' });
    const p = await tx.patient.findFirst({ where: { id: patientId, clinicId }, select: { id: true } });
    if (!p) throw ApiError.notFound('Bemor topilmadi');
    return tx.queue.update({ where: { id: row.id }, data: { patientId: p.id }, include: queueRowInclude });
  });
  publishQueueEvent(clinicId, queueEventFromRow(updated, null, 'updated'));
  return updated;
}

// ───────────────────────────── Talondan qabul ─────────────────────────────

export interface VisitFromTicketResult {
  visitId: string;
  row: QueueRow;
  existing: boolean;
}

/**
 * Talon boʻyicha qabul (Visit) ochish: bemor biriktirilgan boʻlishi shart; shifokor — chaqiruvchi (DOCTOR)
 * yoki berilgan/talonga biriktirilgan shifokor. Talon SERVING ga oʻtadi. Qabul allaqachon boʻlsa — oʻsha qaytadi.
 */
export async function createVisitFromTicket(clinicId: string, id: string, actor: QueueActor, doctorIdInput?: string | null): Promise<VisitFromTicketResult> {
  const result = await prisma.$transaction(async (tx) => {
    const row = await tx.queue.findFirst({ where: { id, clinicId }, include: queueRowInclude });
    if (!row) throw ApiError.notFound('Talon topilmadi');

    if (row.visit) {
      const same = row.status === 'SERVING' ? row : await tx.queue.update({ where: { id: row.id }, data: { status: 'SERVING', servedAt: row.servedAt ?? new Date() }, include: queueRowInclude });
      return { visitId: row.visit.id, row: same, existing: true, changed: row.status !== 'SERVING' };
    }
    if (!row.patientId) {
      throw new ApiError(400, 'VALIDATION', 'Qabulni boshlash uchun bemor biriktirilishi kerak', { code: 'PATIENT_REQUIRED' });
    }
    if (row.status === 'DONE' || row.status === 'SKIPPED') {
      throw new ApiError(409, 'CONFLICT', 'Bu holatdan oʻtish mumkin emas', { code: 'INVALID_TRANSITION', from: row.status, action: 'serve' });
    }

    const doctorId = actor.role === 'DOCTOR' ? actor.id : (doctorIdInput ?? row.doctorId);
    if (!doctorId) {
      throw new ApiError(400, 'VALIDATION', 'Shifokor tanlanmagan', { code: 'DOCTOR_REQUIRED', fieldErrors: { doctorId: ['Shifokor tanlanmagan'] } });
    }
    if (actor.role === 'DOCTOR' && row.doctorId && row.doctorId !== actor.id) {
      throw new ApiError(403, 'FORBIDDEN', 'Bu talon boshqa shifokorga biriktirilgan', { code: 'OTHER_DOCTOR' });
    }
    const doctor = await tx.user.findFirst({ where: { id: doctorId, clinicId, role: 'DOCTOR', isActive: true }, select: { id: true, room: true } });
    if (!doctor) throw ApiError.notFound('Shifokor topilmadi yoki faol emas');

    const now = new Date();
    const updated = await tx.queue.update({
      where: { id: row.id },
      data: { status: 'SERVING', servedAt: now, calledAt: row.calledAt ?? now, doctorId: doctor.id, room: actor.role === 'DOCTOR' ? actorRoom(actor, doctor.room) : (row.room ?? doctor.room) },
      include: queueRowInclude,
    });
    const visit = await tx.visit.create({
      data: { clinicId, patientId: row.patientId, doctorId: doctor.id, queueId: row.id },
      select: { id: true },
    });
    await audit(
      { clinicId, userId: actor.id, action: 'CREATE', entity: 'Visit', entityId: visit.id, after: { patientId: row.patientId, doctorId: doctor.id, queueId: row.id, number: row.number }, ip: actor.ip, userAgent: actor.userAgent },
      tx,
    );
    const withVisit = await tx.queue.findFirstOrThrow({ where: { id: updated.id }, include: queueRowInclude });
    return { visitId: visit.id, row: withVisit, existing: false, changed: true };
  });
  if (result.changed) publishQueueEvent(clinicId, queueEventFromRow(result.row, null, 'updated'));
  return { visitId: result.visitId, row: result.row, existing: result.existing };
}

// ───────────────────────────── Tablo / oqim ─────────────────────────────

export async function getDisplayState(clinic: QueueClinic, dateKey = todayKey()): Promise<DisplayStateDTO> {
  const rows = (await getBoardRows(clinic.id, dateKey)).map(toRowDTO);
  const called = displayCalled(rows, 5);
  const byType = waitingByType(rows);
  return {
    clinicName: clinic.name,
    clinicPhone: clinic.phone,
    called,
    current: called.find((c) => c.status === 'CALLED') ?? called[0] ?? null,
    waitingCount: Object.values(byType).reduce((a, b) => a + b, 0),
    waitingByType: byType,
    now: new Date().toISOString(),
  };
}

/** SSE soʻrovi: `since` dan keyin yangilangan qatorlar → hodisalar */
export async function pollQueueEvents(clinicId: string, since: Date, limit = 200): Promise<QueueEvent[]> {
  const rows = await prisma.queue.findMany({
    where: { clinicId, updatedAt: { gte: since } },
    orderBy: { updatedAt: 'asc' },
    take: limit,
    select: { id: true, number: true, status: true, type: true, room: true, doctorId: true, createdAt: true, calledAt: true, updatedAt: true },
  });
  return rows.map((r) => queueEventFromRow(r, since));
}
