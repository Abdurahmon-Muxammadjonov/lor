import { Prisma, type AppointmentStatus, type Gender, type Patient, type PayMethod } from '@prisma/client';
import { prisma, type Tx } from '@/lib/prisma';
import { ApiError } from '@/lib/api/errors';
import { audit } from '@/lib/api/audit';
import { formatCardNumber } from '@/lib/queue-number';
import { todayKey } from '@/lib/date';
import { normalizePhone, normalizeSearch } from '@/lib/utils';
import { D, moneyToJson } from '@/lib/money';
import { childCutoffKey, patientAge, patientTypeFor } from './age';
import type { PatientInput, PatientListQueryParsed, PatientPatchInput } from './schemas';
import type { DuplicatePhoneDetails, PatientStatsDTO } from './types';

/**
 * Bemorlar xizmati (faqat server). Barcha soʻrovlar `clinicId` boʻyicha chegaralangan.
 * Qidiruv apostrofga sezgir emas: "oktam" → "Oʻktam" (DB tomonida regexp_replace bilan).
 */

export interface PatientActor {
  clinicId: string;
  userId: string;
  ip?: string | null;
}

export const DOCTOR_SELECT = { id: true, fullName: true, color: true, specialty: true, room: true } as const;
const DOCTOR_SHORT_SELECT = { id: true, fullName: true } as const;

const ACTIVE_APPOINTMENT: AppointmentStatus[] = ['SCHEDULED', 'CONFIRMED', 'ARRIVED'];

/** Oʻzbek apostroflari va tutuq belgilari (Postgres regexp uchun) */
const APOSTROPHES = "[ʻʼ'’`‘]";
const nameNorm = () => Prisma.sql`regexp_replace(p."fullName", ${APOSTROPHES}, '', 'g')`;

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Qidiruv sharti (WHERE qismi): ism tokenlari (apostrofsiz, katta-kichik harfsiz, hammasi mos kelishi shart)
 * YOKI telefon raqamlari (phone/phone2) YOKI karta raqami. Boʻsh soʻrov → null.
 */
export function buildSearchWhere(q: string): Prisma.Sql | null {
  const raw = q.trim();
  if (!raw) return null;
  const tokens = normalizeSearch(raw).split(' ').filter(Boolean);
  const digits = raw.replace(/\D/g, '');
  const parts: Prisma.Sql[] = [];
  if (tokens.length > 0) {
    const tokenConds = tokens.map((t) => Prisma.sql`${nameNorm()} ILIKE ${`%${escapeLike(t)}%`}`);
    parts.push(Prisma.sql`(${Prisma.join(tokenConds, ' AND ')})`);
  }
  if (digits.length >= 3) {
    const pat = `%${digits}%`;
    parts.push(Prisma.sql`(p."phone" LIKE ${pat} OR p."phone2" LIKE ${pat})`);
  }
  parts.push(Prisma.sql`p."cardNumber" ILIKE ${`%${escapeLike(raw)}%`}`);
  return Prisma.sql`(${Prisma.join(parts, ' OR ')})`;
}

/** Relevantlik: aniq karta raqami → ism boshlanishi → qolganlar */
function buildRank(q: string): Prisma.Sql {
  const raw = q.trim();
  const norm = normalizeSearch(raw);
  if (!norm) return Prisma.sql`0`;
  return Prisma.sql`CASE WHEN p."cardNumber" = ${raw} THEN 0 WHEN ${nameNorm()} ILIKE ${`${escapeLike(norm)}%`} THEN 1 ELSE 2 END`;
}

// ───────────────────────────── Karta raqami ─────────────────────────────

/**
 * Keyingi karta raqami: YYYY-NNNNN (yil boʻyicha ketma-ket). Tranzaksiya ichida chaqiriladi —
 * `pg_advisory_xact_lock` bir klinika uchun parallel yaratishni ketma-ketlashtiradi.
 */
export async function nextCardNumber(
  tx: Tx,
  clinicId: string,
  year: number = Number(todayKey().slice(0, 4)),
): Promise<string> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`patient-card:${clinicId}`}))`;
  const rows = await tx.$queryRaw<{ seq: number | null }[]>`
    SELECT MAX(CAST(split_part("cardNumber", '-', 2) AS INTEGER)) AS seq
    FROM "Patient"
    WHERE "clinicId" = ${clinicId}
      AND "cardNumber" LIKE ${`${year}-%`}
      AND "cardNumber" ~ '^[0-9]{4}-[0-9]+$'`;
  const last = rows[0]?.seq ?? 0;
  return formatCardNumber(year, Number(last) + 1);
}

// ───────────────────────────── Yaratish / oʻzgartirish / oʻchirish ─────────────────────────────

async function assertNoDuplicatePhone(clinicId: string, phone: string, exceptId?: string): Promise<void> {
  const existing = await prisma.patient.findFirst({
    where: { clinicId, phone, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true, fullName: true, cardNumber: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!existing) return;
  const details: DuplicatePhoneDetails = {
    existingId: existing.id,
    existingName: existing.fullName,
    existingCard: existing.cardNumber,
    phone,
  };
  throw new ApiError(409, 'CONFLICT', 'Bu telefon raqami bilan bemor allaqachon mavjud', details);
}

export async function createPatient(actor: PatientActor, input: PatientInput): Promise<Patient> {
  const phone = normalizePhone(input.phone);
  if (!phone) throw ApiError.validation({ fieldErrors: { phone: ['common.validation.phone'] } });
  const phone2 = input.phone2 ? normalizePhone(input.phone2) || null : null;
  if (!input.force) await assertNoDuplicatePhone(actor.clinicId, phone);

  return prisma.$transaction(async (tx) => {
    const cardNumber = await nextCardNumber(tx, actor.clinicId);
    const row = await tx.patient.create({
      data: {
        clinicId: actor.clinicId,
        cardNumber,
        fullName: input.fullName,
        birthDate: input.birthDate,
        gender: input.gender,
        phone,
        phone2,
        address: input.address,
        allergies: input.allergies,
        chronic: input.chronic,
        notes: input.notes,
        source: input.source,
        smsConsent: input.smsConsent,
      },
    });
    await audit(
      {
        clinicId: actor.clinicId,
        userId: actor.userId,
        action: 'CREATE',
        entity: 'Patient',
        entityId: row.id,
        after: row,
        ip: actor.ip,
      },
      tx,
    );
    return row;
  });
}

type PatientField = keyof Prisma.PatientUncheckedUpdateInput;

function sameValue(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return a === b;
}

export async function updatePatient(
  actor: PatientActor,
  id: string,
  patch: PatientPatchInput,
): Promise<Patient> {
  const existing = await prisma.patient.findFirst({ where: { id, clinicId: actor.clinicId } });
  if (!existing) throw ApiError.notFound('Bemor topilmadi');

  const data: Prisma.PatientUncheckedUpdateInput = {};
  if (patch.fullName !== undefined) data.fullName = patch.fullName;
  if (patch.birthDate !== undefined) data.birthDate = patch.birthDate;
  if (patch.gender !== undefined) data.gender = patch.gender;
  if (patch.phone !== undefined) {
    const phone = normalizePhone(patch.phone);
    if (!phone) throw ApiError.validation({ fieldErrors: { phone: ['common.validation.phone'] } });
    if (phone !== existing.phone && !patch.force) await assertNoDuplicatePhone(actor.clinicId, phone, id);
    data.phone = phone;
  }
  if (patch.phone2 !== undefined) data.phone2 = patch.phone2 ? normalizePhone(patch.phone2) || null : null;
  if (patch.address !== undefined) data.address = patch.address;
  if (patch.allergies !== undefined) data.allergies = patch.allergies;
  if (patch.chronic !== undefined) data.chronic = patch.chronic;
  if (patch.notes !== undefined) data.notes = patch.notes;
  if (patch.source !== undefined) data.source = patch.source;
  if (patch.smsConsent !== undefined) data.smsConsent = patch.smsConsent;

  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  for (const key of Object.keys(data) as PatientField[]) {
    const prev = existing[key as keyof Patient];
    const next = data[key];
    if (!sameValue(prev, next)) {
      before[key] = prev;
      after[key] = next;
    }
  }
  if (Object.keys(after).length === 0) return existing;

  return prisma.$transaction(async (tx) => {
    const row = await tx.patient.update({ where: { id: existing.id }, data });
    await audit(
      {
        clinicId: actor.clinicId,
        userId: actor.userId,
        action: 'UPDATE',
        entity: 'Patient',
        entityId: row.id,
        before,
        after,
        ip: actor.ip,
      },
      tx,
    );
    return row;
  });
}

export async function deletePatient(actor: PatientActor, id: string): Promise<{ id: string }> {
  const existing = await prisma.patient.findFirst({ where: { id, clinicId: actor.clinicId } });
  if (!existing) throw ApiError.notFound('Bemor topilmadi');
  const visits = await prisma.visit.count({ where: { clinicId: actor.clinicId, patientId: id } });
  if (visits > 0) {
    throw new ApiError(409, 'CONFLICT', 'Tashriflari bor bemorni oʻchirib boʻlmaydi', { visits });
  }
  await prisma.$transaction(async (tx) => {
    await tx.appointment.deleteMany({ where: { clinicId: actor.clinicId, patientId: id } });
    await tx.queue.updateMany({
      where: { clinicId: actor.clinicId, patientId: id },
      data: { patientId: null },
    });
    await tx.smsLog.updateMany({
      where: { clinicId: actor.clinicId, patientId: id },
      data: { patientId: null },
    });
    await tx.patient.delete({ where: { id: existing.id } });
    await audit(
      {
        clinicId: actor.clinicId,
        userId: actor.userId,
        action: 'DELETE',
        entity: 'Patient',
        entityId: id,
        before: existing,
        ip: actor.ip,
      },
      tx,
    );
  });
  return { id };
}

// ───────────────────────────── Qidiruv ─────────────────────────────

export interface PatientSearchRow {
  id: string;
  fullName: string;
  cardNumber: string;
  phone: string;
  birthDate: Date;
  gender: Gender;
}

/** Tez qidiruv (paletka/pickerlar). Boʻsh soʻrov — eng soʻnggi qoʻshilganlar. */
export async function searchPatients(clinicId: string, q: string, limit = 8): Promise<PatientSearchRow[]> {
  const where = buildSearchWhere(q);
  if (!where) {
    return prisma.patient.findMany({
      where: { clinicId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { id: true, fullName: true, cardNumber: true, phone: true, birthDate: true, gender: true },
    });
  }
  return prisma.$queryRaw<PatientSearchRow[]>`
    SELECT p."id", p."fullName", p."cardNumber", p."phone", p."birthDate", p."gender"
    FROM "Patient" p
    WHERE p."clinicId" = ${clinicId} AND ${where}
    ORDER BY ${buildRank(q)}, p."fullName" ASC
    LIMIT ${limit}`;
}

// ───────────────────────────── Roʻyxat ─────────────────────────────

interface RawListRow extends Patient {
  lastVisitAt: Date | null;
  debt: Prisma.Decimal | number | string | null;
  visitsCount: bigint | number;
}

export type PatientListRow = Patient & {
  age: number;
  patientType: 'ADULT' | 'CHILD';
  visitsCount: number;
  lastVisitAt: Date | null;
  debt: number;
};

function orderBySql(sort: PatientListQueryParsed['sort'], dir: PatientListQueryParsed['dir']): Prisma.Sql {
  switch (sort) {
    case 'name':
      return dir === 'desc'
        ? Prisma.sql`p."fullName" DESC, p."createdAt" DESC`
        : Prisma.sql`p."fullName" ASC, p."createdAt" DESC`;
    case 'lastVisit':
      return dir === 'asc'
        ? Prisma.sql`a.last_visit ASC NULLS FIRST, p."fullName" ASC`
        : Prisma.sql`a.last_visit DESC NULLS LAST, p."fullName" ASC`;
    case 'created':
    default:
      return dir === 'asc'
        ? Prisma.sql`p."createdAt" ASC, p."id" ASC`
        : Prisma.sql`p."createdAt" DESC, p."id" DESC`;
  }
}

export interface PatientListOptions {
  limit: number;
  offset: number;
}

/**
 * Roʻyxat + agregatlar (oxirgi tashrif, qarz, tashriflar soni) bitta SQL da — filtr va saralash
 * agregatlar boʻyicha ham ishlaydi (qarzdorlar, oxirgi tashrif).
 */
export async function queryPatients(
  clinicId: string,
  query: Omit<PatientListQueryParsed, 'page' | 'pageSize'>,
  childAgeLimit: number,
  opts: PatientListOptions,
): Promise<{ rows: PatientListRow[]; total: number }> {
  const today = todayKey();
  const conds: Prisma.Sql[] = [Prisma.sql`p."clinicId" = ${clinicId}`];
  const search = buildSearchWhere(query.q ?? '');
  if (search) conds.push(search);
  if (query.gender) conds.push(Prisma.sql`p."gender" = CAST(${query.gender} AS "Gender")`);
  if (query.type) {
    const cutoff = childCutoffKey(childAgeLimit, today);
    conds.push(
      query.type === 'CHILD'
        ? Prisma.sql`p."birthDate" > CAST(${cutoff} AS date)`
        : Prisma.sql`p."birthDate" <= CAST(${cutoff} AS date)`,
    );
  }
  if (query.hasDebt === '1') conds.push(Prisma.sql`COALESCE(a.debt, 0) > 0`);
  const where = Prisma.join(conds, ' AND ');

  const agg = Prisma.sql`LEFT JOIN (
      SELECT v."patientId",
             MAX(v."createdAt") AS last_visit,
             SUM(v."totalNet" - v."paidAmount") AS debt,
             COUNT(*) AS visits
      FROM "Visit" v
      WHERE v."clinicId" = ${clinicId} AND v."status" <> 'CANCELLED'
      GROUP BY v."patientId"
    ) a ON a."patientId" = p."id"`;

  const [countRows, rows] = await Promise.all([
    prisma.$queryRaw<
      { count: bigint | number }[]
    >`SELECT COUNT(*) AS count FROM "Patient" p ${agg} WHERE ${where}`,
    prisma.$queryRaw<RawListRow[]>`
      SELECT p.*, a.last_visit AS "lastVisitAt", COALESCE(a.debt, 0) AS debt, COALESCE(a.visits, 0) AS "visitsCount"
      FROM "Patient" p ${agg}
      WHERE ${where}
      ORDER BY ${orderBySql(query.sort, query.dir)}
      LIMIT ${opts.limit} OFFSET ${opts.offset}`,
  ]);

  const total = Number(countRows[0]?.count ?? 0);
  const items: PatientListRow[] = rows.map((r) => {
    const { lastVisitAt, debt, visitsCount, ...patient } = r;
    return {
      ...patient,
      age: patientAge(patient.birthDate, today),
      patientType: patientTypeFor(patient.birthDate, childAgeLimit, today),
      visitsCount: Number(visitsCount),
      lastVisitAt: lastVisitAt ?? null,
      debt: moneyToJson(debt === null ? 0 : String(debt)),
    };
  });
  return { rows: items, total };
}

export async function listPatients(clinicId: string, query: PatientListQueryParsed, childAgeLimit: number) {
  const { rows, total } = await queryPatients(clinicId, query, childAgeLimit, {
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  });
  return { items: rows, total, page: query.page, pageSize: query.pageSize };
}

export const EXPORT_LIMIT = 100_000;

export async function exportPatients(
  clinicId: string,
  query: Omit<PatientListQueryParsed, 'page' | 'pageSize'>,
  childAgeLimit: number,
) {
  const { rows } = await queryPatients(clinicId, query, childAgeLimit, { limit: EXPORT_LIMIT, offset: 0 });
  return rows;
}

// ───────────────────────────── Karta ─────────────────────────────

export async function getClinicChildAgeLimit(clinicId: string): Promise<number> {
  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { childAgeLimit: true } });
  return clinic?.childAgeLimit ?? 14;
}

export async function getPatient(clinicId: string, id: string, childAgeLimit: number) {
  const patient = await prisma.patient.findFirst({ where: { id, clinicId } });
  if (!patient) return null;
  const visitWhere = { clinicId, patientId: id, status: { not: 'CANCELLED' as const } };
  const [agg, openVisits, lastVisit] = await Promise.all([
    prisma.visit.aggregate({
      where: visitWhere,
      _count: { _all: true },
      _sum: { totalNet: true, paidAmount: true },
      _max: { createdAt: true },
    }),
    prisma.visit.count({ where: { clinicId, patientId: id, status: 'OPEN' } }),
    prisma.visit.findFirst({
      where: visitWhere,
      orderBy: { createdAt: 'desc' },
      select: { id: true, createdAt: true, status: true, diagnosis: true, doctor: { select: DOCTOR_SELECT } },
    }),
  ]);
  const totalNet = D(agg._sum.totalNet?.toString() ?? 0);
  const totalPaid = D(agg._sum.paidAmount?.toString() ?? 0);
  const today = todayKey();
  const stats: Omit<PatientStatsDTO, 'lastVisitAt'> & { lastVisitAt: Date | null } = {
    visits: agg._count._all,
    openVisits,
    lastVisitAt: agg._max.createdAt ?? null,
    totalNet: moneyToJson(totalNet),
    totalPaid: moneyToJson(totalPaid),
    debt: moneyToJson(totalNet.minus(totalPaid)),
  };
  return {
    ...patient,
    age: patientAge(patient.birthDate, today),
    patientType: patientTypeFor(patient.birthDate, childAgeLimit, today),
    stats,
    lastVisit,
  };
}

/** Bemor mavjudligini tekshirish (404 uchun) */
export async function assertPatient(clinicId: string, id: string): Promise<{ id: string }> {
  const p = await prisma.patient.findFirst({ where: { id, clinicId }, select: { id: true } });
  if (!p) throw ApiError.notFound('Bemor topilmadi');
  return p;
}

// ───────────────────────────── Tashriflar ─────────────────────────────

export async function getPatientVisits(clinicId: string, patientId: string, page: number, pageSize: number) {
  await assertPatient(clinicId, patientId);
  const where = { clinicId, patientId };
  const [total, visits] = await Promise.all([
    prisma.visit.count({ where }),
    prisma.visit.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        doctor: { select: DOCTOR_SELECT },
        lines: { orderBy: { order: 'asc' } },
        payments: {
          select: { id: true, amount: true, method: true, createdAt: true, receiptNo: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    }),
  ]);
  const items = visits.map((v) => {
    const { payments, ...rest } = v;
    const paid = payments.reduce((s, p) => s.plus(D(p.amount.toString())), D(0));
    const methods = Array.from(new Set<PayMethod>(payments.map((p) => p.method)));
    const receiptNos = Array.from(new Set(payments.map((p) => p.receiptNo).filter((r): r is string => !!r)));
    const lastAt = payments.length > 0 ? (payments[payments.length - 1]?.createdAt ?? null) : null;
    return {
      ...rest,
      payments: { count: payments.length, paid: moneyToJson(paid), lastAt, methods, receiptNos },
      balance: moneyToJson(D(v.totalNet.toString()).minus(v.paidAmount.toString())),
    };
  });
  return { items, total, page, pageSize };
}

// ───────────────────────────── Moliya ─────────────────────────────

export async function getPatientPayments(clinicId: string, patientId: string) {
  await assertPatient(clinicId, patientId);
  const [payments, visits] = await Promise.all([
    prisma.payment.findMany({
      where: { clinicId, visit: { patientId } },
      orderBy: { createdAt: 'desc' },
      include: {
        cashier: { select: DOCTOR_SHORT_SELECT },
        visit: {
          select: { id: true, createdAt: true, status: true, doctor: { select: DOCTOR_SHORT_SELECT } },
        },
      },
    }),
    prisma.visit.findMany({
      where: { clinicId, patientId, status: { not: 'CANCELLED' } },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        createdAt: true,
        status: true,
        totalNet: true,
        paidAmount: true,
        doctor: { select: DOCTOR_SHORT_SELECT },
      },
    }),
  ]);
  let totalNet = D(0);
  let totalPaid = D(0);
  const debts: {
    visitId: string;
    createdAt: Date;
    status: (typeof visits)[number]['status'];
    doctor: { id: string; fullName: string };
    totalNet: number;
    paidAmount: number;
    balance: number;
  }[] = [];
  for (const v of visits) {
    const net = D(v.totalNet.toString());
    const paid = D(v.paidAmount.toString());
    totalNet = totalNet.plus(net);
    totalPaid = totalPaid.plus(paid);
    const balance = net.minus(paid);
    if (balance.gt(0)) {
      debts.push({
        visitId: v.id,
        createdAt: v.createdAt,
        status: v.status,
        doctor: v.doctor,
        totalNet: moneyToJson(net),
        paidAmount: moneyToJson(paid),
        balance: moneyToJson(balance),
      });
    }
  }
  return {
    items: payments,
    summary: {
      visits: visits.length,
      totalNet: moneyToJson(totalNet),
      totalPaid: moneyToJson(totalPaid),
      debt: moneyToJson(totalNet.minus(totalPaid)),
      debtVisits: debts.length,
    },
    debts,
  };
}

// ───────────────────────────── Yozilishlar ─────────────────────────────

export async function getPatientAppointments(clinicId: string, patientId: string, now: Date = new Date()) {
  await assertPatient(clinicId, patientId);
  const all = await prisma.appointment.findMany({
    where: { clinicId, patientId },
    orderBy: { startAt: 'desc' },
    take: 100,
    include: { doctor: { select: DOCTOR_SELECT }, visit: { select: { id: true } } },
  });
  const mapped = all.map((a) => {
    const { visit, ...rest } = a;
    return { ...rest, visitId: visit?.id ?? null };
  });
  const isUpcoming = (a: (typeof mapped)[number]) =>
    a.endAt.getTime() >= now.getTime() && ACTIVE_APPOINTMENT.includes(a.status);
  const upcoming = mapped.filter(isUpcoming).sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  const past = mapped.filter((a) => !isUpcoming(a));
  return { upcoming, past };
}
