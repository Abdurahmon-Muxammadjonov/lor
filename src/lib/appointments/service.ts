import { Prisma, type AppointmentStatus } from '@prisma/client';
import { prisma, type Tx } from '@/lib/prisma';
import { ApiError } from '@/lib/api/errors';
import { audit } from '@/lib/api/audit';
import { dayRangeTz, todayKey } from '@/lib/date';
import {
  parseClinicSettings,
  parseWeeklySchedule,
  type ClinicSettings,
  type WeeklySchedule,
} from '@/lib/settings/types';
import {
  BLOCKING_STATUSES,
  buildSlots,
  canTransition,
  checkSchedule,
  dayScheduleFor,
  durationMinutes,
  isBlockingStatus,
  isLockedForMove,
  renderAppointmentSms,
} from './availability';
import type {
  AppointmentStatusCode,
  CreateAppointmentInput,
  RangeQueryInput,
  SlotsQueryInput,
  UpdateAppointmentInput,
} from './schemas';
import type { AppointmentErrorDetails } from './types';

/**
 * Yozilish (Appointment) server xizmati. Barcha soʻrovlar `clinicId` boʻyicha chegaralangan.
 *
 * Holat oʻzgarishi (ARRIVED) da navbat raqami SERVERDA yaratilmaydi: navbat raqamlash mantiqi
 * [queue] moduliga tegishli, shuning uchun client `POST /api/appointments/[id]/status` dan soʻng
 * `POST /api/queue { type: 'DOCTOR', patientId, doctorId }` ni chaqiradi va raqamni koʻrsatadi.
 */

export const appointmentInclude = {
  patient: {
    select: {
      id: true,
      fullName: true,
      cardNumber: true,
      phone: true,
      birthDate: true,
      gender: true,
      smsConsent: true,
    },
  },
  doctor: { select: { id: true, fullName: true, room: true, color: true, specialty: true } },
  createdBy: { select: { id: true, fullName: true } },
  visit: { select: { id: true, status: true } },
} satisfies Prisma.AppointmentInclude;

export type AppointmentWithRelations = Prisma.AppointmentGetPayload<{ include: typeof appointmentInclude }>;

const BLOCKING = BLOCKING_STATUSES as readonly AppointmentStatus[];

interface ClinicInfo {
  id: string;
  name: string;
  phone: string;
  workStart: string;
  workEnd: string;
  slotMinutes: number;
  settings: ClinicSettings;
}

interface DoctorInfo {
  id: string;
  fullName: string;
  schedule: WeeklySchedule;
}

interface PatientInfo {
  id: string;
  fullName: string;
  phone: string;
  smsConsent: boolean;
}

type Db = Tx | typeof prisma;

function validationError(msg: string, details: AppointmentErrorDetails): ApiError {
  return new ApiError(400, 'VALIDATION', msg, details);
}

function conflictError(msg: string, details: AppointmentErrorDetails): ApiError {
  return new ApiError(409, 'CONFLICT', msg, details);
}

async function loadClinic(db: Db, clinicId: string): Promise<ClinicInfo> {
  const c = await db.clinic.findFirst({
    where: { id: clinicId },
    select: {
      id: true,
      name: true,
      phone: true,
      workStart: true,
      workEnd: true,
      slotMinutes: true,
      settings: true,
    },
  });
  if (!c) throw ApiError.notFound('Klinika topilmadi');
  return { ...c, settings: parseClinicSettings(c.settings) };
}

async function loadDoctor(db: Db, clinicId: string, doctorId: string): Promise<DoctorInfo> {
  const d = await db.user.findFirst({
    where: { id: doctorId, clinicId, role: 'DOCTOR', isActive: true },
    select: { id: true, fullName: true, schedule: true },
  });
  if (!d) throw validationError('Shifokor topilmadi yoki faol emas', { reason: 'DOCTOR' });
  return { id: d.id, fullName: d.fullName, schedule: parseWeeklySchedule(d.schedule) };
}

async function loadPatient(db: Db, clinicId: string, patientId: string): Promise<PatientInfo> {
  const p = await db.patient.findFirst({
    where: { id: patientId, clinicId },
    select: { id: true, fullName: true, phone: true, smsConsent: true },
  });
  if (!p) throw validationError('Bemor topilmadi', { reason: 'PATIENT' });
  return p;
}

/** Shifokorda shu oraliq bilan kesishadigan faol yozilish */
async function findOverlap(
  db: Db,
  clinicId: string,
  doctorId: string,
  startAt: Date,
  endAt: Date,
  excludeId?: string,
): Promise<{ id: string; startAt: Date; endAt: Date } | null> {
  return db.appointment.findFirst({
    where: {
      clinicId,
      doctorId,
      status: { in: [...BLOCKING] },
      ...(excludeId ? { id: { not: excludeId } } : {}),
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
    select: { id: true, startAt: true, endAt: true },
    orderBy: { startAt: 'asc' },
  });
}

async function assertNoOverlap(
  db: Db,
  clinicId: string,
  doctorId: string,
  startAt: Date,
  endAt: Date,
  excludeId?: string,
): Promise<void> {
  const c = await findOverlap(db, clinicId, doctorId, startAt, endAt, excludeId);
  if (c) {
    throw conflictError('Bu vaqt band — shifokorda boshqa yozilish bor', {
      reason: 'OVERLAP',
      conflictId: c.id,
      conflictStartAt: c.startAt.toISOString(),
      conflictEndAt: c.endAt.toISOString(),
    });
  }
}

/**
 * Mavjudlik tekshiruvi: oʻtgan kun emas, shifokor jadvali (kun/ish vaqti/tanaffus), kesishuv yoʻq.
 */
export async function assertAvailable(
  db: Db,
  o: { clinicId: string; doctor: DoctorInfo; startAt: Date; endAt: Date; excludeId?: string; now?: Date },
): Promise<void> {
  const now = o.now ?? new Date();
  if (o.startAt.getTime() < dayRangeTz(todayKey(now)).start.getTime()) {
    throw validationError('Oʻtgan sanaga yozib boʻlmaydi', { reason: 'PAST' });
  }
  const reason = checkSchedule(o.doctor.schedule, o.startAt, o.endAt);
  if (reason) {
    const msg =
      reason === 'DAY_OFF'
        ? 'Shifokor bu kuni ishlamaydi'
        : reason === 'BREAK'
          ? 'Bu vaqt shifokor tanaffusiga toʻgʻri keladi'
          : 'Shifokorning ish vaqtidan tashqari';
    throw validationError(msg, { reason });
  }
  await assertNoOverlap(db, o.clinicId, o.doctor.id, o.startAt, o.endAt, o.excludeId);
}

/** SMS yoqilgan va bemor rozi boʻlsa — PENDING SmsLog (yetkazishni settings modulining cron i bajaradi) */
async function enqueueConfirmSms(
  db: Db,
  o: { clinic: ClinicInfo; patient: PatientInfo; doctor: DoctorInfo; startAt: Date },
): Promise<boolean> {
  const sms = o.clinic.settings.sms;
  if (!sms.enabled || !o.patient.smsConsent || !o.patient.phone) return false;
  const text = renderAppointmentSms(sms.confirmTemplate, {
    clinic: o.clinic.name,
    phone: o.clinic.phone,
    patientName: o.patient.fullName,
    doctorName: o.doctor.fullName,
    startAt: o.startAt,
  });
  await db.smsLog.create({
    data: {
      clinicId: o.clinic.id,
      patientId: o.patient.id,
      phone: o.patient.phone,
      text,
      kind: 'APPOINTMENT_CONFIRM',
      status: 'PENDING',
      provider: sms.provider,
    },
  });
  return true;
}

function auditSnapshot(
  a:
    | AppointmentWithRelations
    | {
        startAt: Date;
        endAt: Date;
        doctorId: string;
        patientId: string;
        status: AppointmentStatus;
        note: string | null;
      },
) {
  return {
    patientId: a.patientId,
    doctorId: a.doctorId,
    startAt: a.startAt.toISOString(),
    endAt: a.endAt.toISOString(),
    status: a.status,
    note: a.note,
  };
}

// ───────────────────────── Oʻqish ─────────────────────────

export async function listAppointments(
  clinicId: string,
  q: RangeQueryInput,
): Promise<AppointmentWithRelations[]> {
  const from = new Date(q.from);
  const to = new Date(q.to);
  return prisma.appointment.findMany({
    where: {
      clinicId,
      startAt: { lt: to },
      endAt: { gt: from },
      ...(q.doctorId ? { doctorId: q.doctorId } : {}),
      ...(q.patientId ? { patientId: q.patientId } : {}),
      ...(q.status ? { status: q.status } : {}),
    },
    include: appointmentInclude,
    orderBy: [{ startAt: 'asc' }, { createdAt: 'asc' }],
    take: 2000,
  });
}

export async function getAppointment(clinicId: string, id: string): Promise<AppointmentWithRelations> {
  const row = await prisma.appointment.findFirst({ where: { id, clinicId }, include: appointmentInclude });
  if (!row) throw ApiError.notFound('Yozilish topilmadi');
  return row;
}

// ───────────────────────── Yozish ─────────────────────────

export interface ActorContext {
  clinicId: string;
  userId: string;
  ip?: string | null;
}

export async function createAppointment(
  ctx: ActorContext,
  input: CreateAppointmentInput,
): Promise<{ appointment: AppointmentWithRelations; smsQueued: boolean }> {
  return prisma.$transaction(async (tx) => {
    const clinic = await loadClinic(tx, ctx.clinicId);
    const doctor = await loadDoctor(tx, ctx.clinicId, input.doctorId);
    const patient = await loadPatient(tx, ctx.clinicId, input.patientId);
    const durationMin = input.durationMin ?? clinic.slotMinutes;
    const startAt = new Date(input.startAt);
    const endAt = new Date(startAt.getTime() + durationMin * 60000);

    await assertAvailable(tx, { clinicId: ctx.clinicId, doctor, startAt, endAt });

    const row = await tx.appointment.create({
      data: {
        clinicId: ctx.clinicId,
        patientId: patient.id,
        doctorId: doctor.id,
        createdById: ctx.userId,
        startAt,
        endAt,
        status: 'SCHEDULED',
        note: input.note ?? null,
      },
      include: appointmentInclude,
    });

    await audit(
      {
        clinicId: ctx.clinicId,
        userId: ctx.userId,
        action: 'CREATE',
        entity: 'Appointment',
        entityId: row.id,
        after: auditSnapshot(row),
        ip: ctx.ip,
      },
      tx,
    );
    const smsQueued = await enqueueConfirmSms(tx, { clinic, patient, doctor, startAt });
    return { appointment: row, smsQueued };
  });
}

export async function updateAppointment(
  ctx: ActorContext,
  id: string,
  input: UpdateAppointmentInput,
): Promise<{ appointment: AppointmentWithRelations; smsQueued: boolean }> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.appointment.findFirst({
      where: { id, clinicId: ctx.clinicId },
      include: appointmentInclude,
    });
    if (!existing) throw ApiError.notFound('Yozilish topilmadi');

    const timeChange =
      input.startAt !== undefined || input.doctorId !== undefined || input.durationMin !== undefined;
    if (timeChange && isLockedForMove(existing.status as AppointmentStatusCode)) {
      throw conflictError('Bu holatdagi yozilishni koʻchirib boʻlmaydi', { reason: 'LOCKED' });
    }

    const targetDoctorId = input.doctorId ?? existing.doctorId;
    const durationMin = input.durationMin ?? durationMinutes(existing.startAt, existing.endAt);
    const startAt = input.startAt !== undefined ? new Date(input.startAt) : existing.startAt;
    const endAt = new Date(startAt.getTime() + durationMin * 60000);

    const actuallyMoved =
      timeChange &&
      (startAt.getTime() !== existing.startAt.getTime() ||
        endAt.getTime() !== existing.endAt.getTime() ||
        targetDoctorId !== existing.doctorId);

    let doctor: DoctorInfo | null = null;
    if (actuallyMoved) {
      doctor = await loadDoctor(tx, ctx.clinicId, targetDoctorId);
      await assertAvailable(tx, { clinicId: ctx.clinicId, doctor, startAt, endAt, excludeId: id });
    }

    const row = await tx.appointment.update({
      where: { id },
      data: {
        ...(actuallyMoved ? { startAt, endAt, doctorId: targetDoctorId } : {}),
        ...(input.note !== undefined ? { note: input.note ?? null } : {}),
      },
      include: appointmentInclude,
    });

    await audit(
      {
        clinicId: ctx.clinicId,
        userId: ctx.userId,
        action: 'UPDATE',
        entity: 'Appointment',
        entityId: id,
        before: auditSnapshot(existing),
        after: auditSnapshot(row),
        ip: ctx.ip,
      },
      tx,
    );

    let smsQueued = false;
    if (actuallyMoved && doctor) {
      const clinic = await loadClinic(tx, ctx.clinicId);
      const patient = await loadPatient(tx, ctx.clinicId, existing.patientId);
      smsQueued = await enqueueConfirmSms(tx, { clinic, patient, doctor, startAt });
    }
    return { appointment: row, smsQueued };
  });
}

export async function setAppointmentStatus(
  ctx: ActorContext,
  id: string,
  status: AppointmentStatusCode,
): Promise<AppointmentWithRelations> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.appointment.findFirst({
      where: { id, clinicId: ctx.clinicId },
      include: appointmentInclude,
    });
    if (!existing) throw ApiError.notFound('Yozilish topilmadi');
    const from = existing.status as AppointmentStatusCode;
    if (from === status) return existing;
    if (!canTransition(from, status)) {
      throw conflictError('Bu holatga oʻtkazib boʻlmaydi', { reason: 'TRANSITION', from, to: status });
    }
    // Bekor qilingan / kelmagan yozilishni qayta faollashtirish — vaqt band boʻlmaganini tekshiramiz
    if (!isBlockingStatus(from) && isBlockingStatus(status)) {
      await assertNoOverlap(tx, ctx.clinicId, existing.doctorId, existing.startAt, existing.endAt, id);
    }
    const row = await tx.appointment.update({ where: { id }, data: { status }, include: appointmentInclude });
    await audit(
      {
        clinicId: ctx.clinicId,
        userId: ctx.userId,
        action: 'UPDATE',
        entity: 'Appointment',
        entityId: id,
        before: { status: from },
        after: { status },
        ip: ctx.ip,
      },
      tx,
    );
    return row;
  });
}

export async function deleteAppointment(ctx: ActorContext, id: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.appointment.findFirst({
      where: { id, clinicId: ctx.clinicId },
      include: appointmentInclude,
    });
    if (!existing) throw ApiError.notFound('Yozilish topilmadi');
    if (existing.status !== 'SCHEDULED') {
      throw conflictError('Faqat rejalashtirilgan yozilishni oʻchirish mumkin', { reason: 'STATUS' });
    }
    if (existing.visit) {
      throw conflictError('Yozilishga qabul bogʻlangan', { reason: 'HAS_VISIT' });
    }
    await tx.appointment.delete({ where: { id } });
    await audit(
      {
        clinicId: ctx.clinicId,
        userId: ctx.userId,
        action: 'DELETE',
        entity: 'Appointment',
        entityId: id,
        before: auditSnapshot(existing),
        ip: ctx.ip,
      },
      tx,
    );
  });
}

// ───────────────────────── Slotlar ─────────────────────────

export async function getFreeSlots(clinicId: string, q: SlotsQueryInput, now: Date = new Date()) {
  const clinic = await loadClinic(prisma, clinicId);
  const doctor = await loadDoctor(prisma, clinicId, q.doctorId);
  const durationMin = q.durationMin ?? clinic.slotMinutes;
  const { start, end } = dayRangeTz(q.date);
  const busy = await prisma.appointment.findMany({
    where: {
      clinicId,
      doctorId: doctor.id,
      status: { in: [...BLOCKING] },
      startAt: { lte: end },
      endAt: { gte: start },
    },
    select: { id: true, startAt: true, endAt: true, status: true },
  });
  const slots = buildSlots({
    dateKey: q.date,
    workStart: clinic.workStart,
    workEnd: clinic.workEnd,
    slotMinutes: clinic.slotMinutes,
    durationMin,
    schedule: doctor.schedule,
    busy,
    excludeId: q.excludeId,
    now,
  });
  return {
    doctorId: doctor.id,
    date: q.date,
    slotMinutes: clinic.slotMinutes,
    durationMin,
    day: dayScheduleFor(doctor.schedule, q.date),
    slots,
  };
}
