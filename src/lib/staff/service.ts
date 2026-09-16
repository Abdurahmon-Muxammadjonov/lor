import type { Prisma, Role, SalaryType } from '@prisma/client';
import Decimal from 'decimal.js';
import { prisma, type Tx } from '@/lib/prisma';
import { ApiError } from '@/lib/api/errors';
import { audit } from '@/lib/api/audit';
import { hashPassword } from '@/lib/auth/password';
import { D, moneyToJson, sumMoney } from '@/lib/money';
import { todayKey } from '@/lib/date';
import { parseWeeklySchedule } from '@/lib/settings/types';
import { normalizeSearch } from '@/lib/utils';
import { calcSalary, monthRange } from './salary';
import type { UserCreateOutput, UserUpdateOutput, UsersQuery } from './schemas';
import type {
  ClinicRole,
  SalaryDayDTO,
  SalaryDoctorDTO,
  SalaryReportDTO,
  SalaryServiceDTO,
  StaffUserDTO,
} from './types';

/**
 * Xodimlar xizmat qatlami — faqat serverda (prisma, bcrypt).
 * Har bir soʻrov `clinicId` bilan cheklanadi; parol xeshi hech qachon qaytarilmaydi.
 */

export interface StaffActor {
  id: string;
  role: Role;
  clinicId: string;
  ip?: string | null;
  userAgent?: string | null;
}

export const USER_SAFE_SELECT = {
  id: true,
  clinicId: true,
  login: true,
  email: true,
  fullName: true,
  role: true,
  phone: true,
  specialty: true,
  room: true,
  color: true,
  salaryType: true,
  salaryValue: true,
  schedule: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

type SafeUserRow = Prisma.UserGetPayload<{ select: typeof USER_SAFE_SELECT }>;

const ROLE_RANK: Record<Role, number> = { SUPER_ADMIN: -1, ADMIN: 0, DOCTOR: 1, RECEPTION: 2, CASHIER: 3 };

function isClinicRole(role: Role): role is ClinicRole {
  return role !== 'SUPER_ADMIN';
}

export function toStaffDTO(row: SafeUserRow): StaffUserDTO {
  return {
    id: row.id,
    clinicId: row.clinicId,
    login: row.login,
    email: row.email,
    fullName: row.fullName,
    role: isClinicRole(row.role) ? row.role : 'ADMIN',
    phone: row.phone,
    specialty: row.specialty,
    room: row.room,
    color: row.color,
    salaryType: row.salaryType,
    salaryValue: moneyToJson(row.salaryValue),
    schedule: parseWeeklySchedule(row.schedule),
    isActive: row.isActive,
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const orNull = (v: string | undefined): string | null => (v && v.trim() ? v.trim() : null);

/** Audit uchun xavfsiz snapshot (parolsiz, Decimal → number) */
function auditSnapshot(row: SafeUserRow): Record<string, unknown> {
  return {
    login: row.login,
    email: row.email,
    fullName: row.fullName,
    role: row.role,
    phone: row.phone,
    specialty: row.specialty,
    room: row.room,
    color: row.color,
    salaryType: row.salaryType,
    salaryValue: moneyToJson(row.salaryValue),
    schedule: row.schedule,
    isActive: row.isActive,
  };
}

// ───────────────────────────── Roʻyxat / bitta ─────────────────────────────

export async function listUsers(clinicId: string, q: UsersQuery): Promise<StaffUserDTO[]> {
  const rows = await prisma.user.findMany({
    where: {
      clinicId,
      role: q.role ?? { not: 'SUPER_ADMIN' },
      ...(q.active === '1' ? { isActive: true } : q.active === '0' ? { isActive: false } : {}),
    },
    select: USER_SAFE_SELECT,
    orderBy: [{ fullName: 'asc' }],
  });
  const needle = q.search ? normalizeSearch(q.search) : '';
  const filtered = needle
    ? rows.filter((r) =>
        [r.fullName, r.login, r.specialty ?? '', r.room ?? '', r.phone ?? '']
          .map(normalizeSearch)
          .some((s) => s.includes(needle)),
      )
    : rows;
  return filtered
    .sort((a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role] || a.fullName.localeCompare(b.fullName))
    .map(toStaffDTO);
}

async function findClinicUser(clinicId: string, id: string, db: Tx | typeof prisma = prisma): Promise<SafeUserRow> {
  const row = await db.user.findFirst({ where: { id, clinicId, role: { not: 'SUPER_ADMIN' } }, select: USER_SAFE_SELECT });
  if (!row) throw ApiError.notFound('staff.errors.notFound');
  return row;
}

export async function getUser(clinicId: string, id: string): Promise<StaffUserDTO> {
  return toStaffDTO(await findClinicUser(clinicId, id));
}

// ───────────────────────────── Yaratish ─────────────────────────────

async function assertUniqueIdentity(login: string | undefined, email: string | null | undefined, excludeId?: string) {
  const or: Prisma.UserWhereInput[] = [];
  if (login) or.push({ login });
  if (email) or.push({ email });
  if (or.length === 0) return;
  const dup = await prisma.user.findFirst({
    where: { OR: or, ...(excludeId ? { NOT: { id: excludeId } } : {}) },
    select: { login: true, email: true },
  });
  if (!dup) return;
  if (login && dup.login === login) throw ApiError.conflict('staff.errors.loginTaken');
  throw ApiError.conflict('staff.errors.emailTaken');
}

export async function createUser(actor: StaffActor, clinicId: string, input: UserCreateOutput): Promise<StaffUserDTO> {
  const email = orNull(input.email);
  await assertUniqueIdentity(input.login, email);
  const password = await hashPassword(input.password);

  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        clinicId,
        login: input.login,
        email,
        password,
        fullName: input.fullName,
        role: input.role,
        phone: orNull(input.phone),
        specialty: orNull(input.specialty),
        room: orNull(input.room),
        color: input.color.toUpperCase(),
        salaryType: input.salaryType,
        salaryValue: new Decimal(input.salaryValue).toFixed(2),
        schedule: input.schedule as Prisma.InputJsonValue,
        sessionVersion: 1,
        isActive: true,
      },
      select: USER_SAFE_SELECT,
    });
    await audit(
      {
        clinicId,
        userId: actor.id,
        action: 'CREATE',
        entity: 'User',
        entityId: created.id,
        after: auditSnapshot(created),
        ip: actor.ip,
        userAgent: actor.userAgent,
      },
      tx,
    );
    return created;
  });
  return toStaffDTO(row);
}

// ───────────────────────────── Yangilash ─────────────────────────────

/** Klinikada boshqa faol ADMIN bormi (targetdan tashqari) */
async function hasAnotherActiveAdmin(clinicId: string, excludeId: string, db: Tx | typeof prisma = prisma): Promise<boolean> {
  const n = await db.user.count({ where: { clinicId, role: 'ADMIN', isActive: true, NOT: { id: excludeId } } });
  return n > 0;
}

export async function updateUser(
  actor: StaffActor,
  clinicId: string,
  id: string,
  input: UserUpdateOutput,
): Promise<StaffUserDTO> {
  const before = await findClinicUser(clinicId, id);

  const nextLogin = input.login !== undefined ? input.login : undefined;
  const nextEmail = input.email !== undefined ? orNull(input.email) : undefined;
  if ((nextLogin && nextLogin !== before.login) || (nextEmail !== undefined && nextEmail !== before.email)) {
    await assertUniqueIdentity(nextLogin && nextLogin !== before.login ? nextLogin : undefined, nextEmail ?? undefined, id);
  }

  const roleChanged = input.role !== undefined && input.role !== before.role;
  const activeChanged = input.isActive !== undefined && input.isActive !== before.isActive;
  const isSelf = before.id === actor.id;

  if (isSelf && (roleChanged || (activeChanged && input.isActive === false))) {
    throw ApiError.conflict('staff.errors.self');
  }
  const losesAdmin = before.role === 'ADMIN' && before.isActive && ((roleChanged && input.role !== 'ADMIN') || (activeChanged && input.isActive === false));
  if (losesAdmin && !(await hasAnotherActiveAdmin(clinicId, id))) {
    throw ApiError.conflict('staff.errors.lastAdmin');
  }

  const salaryType: SalaryType = input.salaryType ?? before.salaryType;
  const salaryValue = input.salaryValue !== undefined ? input.salaryValue : moneyToJson(before.salaryValue);
  if (salaryType === 'PERCENT' && salaryValue > 100) throw ApiError.validation({ salaryValue: ['staff.validation.percentMax'] });

  const data: Prisma.UserUpdateInput = {};
  if (nextLogin !== undefined) data.login = nextLogin;
  if (nextEmail !== undefined) data.email = nextEmail;
  if (input.fullName !== undefined) data.fullName = input.fullName;
  if (input.role !== undefined) data.role = input.role;
  if (input.phone !== undefined) data.phone = orNull(input.phone);
  if (input.specialty !== undefined) data.specialty = orNull(input.specialty);
  if (input.room !== undefined) data.room = orNull(input.room);
  if (input.color !== undefined) data.color = input.color.toUpperCase();
  if (input.salaryType !== undefined) data.salaryType = input.salaryType;
  if (input.salaryValue !== undefined) data.salaryValue = new Decimal(input.salaryValue).toFixed(2);
  if (input.schedule !== undefined) data.schedule = input.schedule as Prisma.InputJsonValue;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (roleChanged || activeChanged) data.sessionVersion = { increment: 1 };

  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({ where: { id }, data, select: USER_SAFE_SELECT });
    const b = auditSnapshot(before);
    const a = auditSnapshot(updated);
    const changed = Object.keys(a).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
    if (changed.length > 0) {
      await audit(
        {
          clinicId,
          userId: actor.id,
          action: 'UPDATE',
          entity: 'User',
          entityId: id,
          before: Object.fromEntries(changed.map((k) => [k, b[k]])),
          after: Object.fromEntries(changed.map((k) => [k, a[k]])),
          ip: actor.ip,
          userAgent: actor.userAgent,
        },
        tx,
      );
    }
    return updated;
  });
  return toStaffDTO(row);
}

// ───────────────────────────── Parol ─────────────────────────────

export async function setPassword(actor: StaffActor, clinicId: string, id: string, plain: string): Promise<{ id: string }> {
  await findClinicUser(clinicId, id);
  const password = await hashPassword(plain);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { password, sessionVersion: { increment: 1 } } });
    await audit(
      {
        clinicId,
        userId: actor.id,
        action: 'UPDATE',
        entity: 'User',
        entityId: id,
        after: { field: 'password', bySelf: actor.id === id },
        ip: actor.ip,
        userAgent: actor.userAgent,
      },
      tx,
    );
  });
  return { id };
}

// ───────────────────────────── Nofaol qilish ─────────────────────────────

export async function deactivateUser(actor: StaffActor, clinicId: string, id: string): Promise<StaffUserDTO> {
  const before = await findClinicUser(clinicId, id);
  if (before.id === actor.id) throw ApiError.conflict('staff.errors.deactivateSelf');
  if (before.role === 'ADMIN' && before.isActive && !(await hasAnotherActiveAdmin(clinicId, id))) {
    throw ApiError.conflict('staff.errors.lastAdmin');
  }
  if (!before.isActive) return toStaffDTO(before);

  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id },
      data: { isActive: false, sessionVersion: { increment: 1 } },
      select: USER_SAFE_SELECT,
    });
    await audit(
      {
        clinicId,
        userId: actor.id,
        action: 'DELETE',
        entity: 'User',
        entityId: id,
        before: { isActive: true },
        after: { isActive: false },
        ip: actor.ip,
        userAgent: actor.userAgent,
      },
      tx,
    );
    return updated;
  });
  return toStaffDTO(row);
}

// ───────────────────────────── Ish haqi ─────────────────────────────

interface VisitRow {
  id: string;
  doctorId: string;
  patientId: string;
  totalNet: Prisma.Decimal;
  completedAt: Date | null;
}

interface LineRow {
  visitId: string;
  serviceCode: string;
  serviceName: string;
  serviceNameRu: string;
  quantity: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
}

function buildDays(salaryType: SalaryType, salaryValue: Prisma.Decimal, visits: VisitRow[]): SalaryDayDTO[] {
  const byDay = new Map<string, VisitRow[]>();
  for (const v of visits) {
    const key = todayKey(v.completedAt ?? new Date(0));
    const arr = byDay.get(key);
    if (arr) arr.push(v);
    else byDay.set(key, [v]);
  }
  return [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, rows]) => {
      const revenue = sumMoney(rows.map((r) => r.totalNet.toString()));
      return {
        date,
        visits: rows.length,
        patients: new Set(rows.map((r) => r.patientId)).size,
        revenue: revenue.toNumber(),
        salary: salaryType === 'PERCENT' ? calcSalary('PERCENT', salaryValue.toString(), revenue).toNumber() : null,
      };
    });
}

function buildServices(lines: LineRow[], limit = 10): SalaryServiceDTO[] {
  const byCode = new Map<string, { code: string; name: string; nameRu: string; count: number; quantity: Decimal; revenue: Decimal }>();
  for (const l of lines) {
    const cur = byCode.get(l.serviceCode) ?? {
      code: l.serviceCode,
      name: l.serviceName,
      nameRu: l.serviceNameRu,
      count: 0,
      quantity: new Decimal(0),
      revenue: new Decimal(0),
    };
    cur.count += 1;
    cur.quantity = cur.quantity.plus(D(l.quantity.toString()));
    cur.revenue = cur.revenue.plus(D(l.lineTotal.toString()));
    byCode.set(l.serviceCode, cur);
  }
  return [...byCode.values()]
    .sort((a, b) => b.revenue.comparedTo(a.revenue) || b.count - a.count)
    .slice(0, limit)
    .map((s) => ({
      code: s.code,
      name: s.name,
      nameRu: s.nameRu,
      count: s.count,
      quantity: s.quantity.toNumber(),
      revenue: s.revenue.toNumber(),
    }));
}

export async function salaryReport(clinicId: string, month: string, doctorId?: string): Promise<SalaryReportDTO> {
  const { start, end } = monthRange(month);
  const doctors = await prisma.user.findMany({
    where: { clinicId, role: 'DOCTOR', ...(doctorId ? { id: doctorId } : {}) },
    select: USER_SAFE_SELECT,
    orderBy: { fullName: 'asc' },
  });
  if (doctorId && doctors.length === 0) throw ApiError.notFound('staff.errors.notFound');

  const doctorIds = doctors.map((d) => d.id);
  const visits: VisitRow[] = doctorIds.length
    ? await prisma.visit.findMany({
        where: { clinicId, status: 'COMPLETED', doctorId: { in: doctorIds }, completedAt: { gte: start, lt: end } },
        select: { id: true, doctorId: true, patientId: true, totalNet: true, completedAt: true },
      })
    : [];
  const visitIds = visits.map((v) => v.id);
  const lines: LineRow[] = visitIds.length
    ? await prisma.treatmentLine.findMany({
        where: { visitId: { in: visitIds } },
        select: { visitId: true, serviceCode: true, serviceName: true, serviceNameRu: true, quantity: true, lineTotal: true },
      })
    : [];

  const visitsByDoctor = new Map<string, VisitRow[]>();
  for (const v of visits) {
    const arr = visitsByDoctor.get(v.doctorId);
    if (arr) arr.push(v);
    else visitsByDoctor.set(v.doctorId, [v]);
  }
  const visitDoctor = new Map(visits.map((v) => [v.id, v.doctorId] as const));
  const linesByDoctor = new Map<string, LineRow[]>();
  for (const l of lines) {
    const d = visitDoctor.get(l.visitId);
    if (!d) continue;
    const arr = linesByDoctor.get(d);
    if (arr) arr.push(l);
    else linesByDoctor.set(d, [l]);
  }

  const items: SalaryDoctorDTO[] = doctors
    // Nofaol shifokor faqat shu oyda qabuli boʻlsa (yoki aniq soʻralsa) koʻrsatiladi
    .filter((d) => d.isActive || doctorId === d.id || (visitsByDoctor.get(d.id)?.length ?? 0) > 0)
    .map((d) => {
      const dv = visitsByDoctor.get(d.id) ?? [];
      const revenue = sumMoney(dv.map((v) => v.totalNet.toString()));
      const salary = calcSalary(d.salaryType, d.salaryValue.toString(), revenue);
      return {
        doctor: { id: d.id, fullName: d.fullName, specialty: d.specialty, room: d.room, color: d.color, isActive: d.isActive },
        salaryType: d.salaryType,
        salaryValue: moneyToJson(d.salaryValue),
        visits: dv.length,
        patients: new Set(dv.map((v) => v.patientId)).size,
        revenue: revenue.toNumber(),
        salary: salary.toNumber(),
        days: buildDays(d.salaryType, d.salaryValue, dv),
        services: buildServices(linesByDoctor.get(d.id) ?? []),
      };
    });

  const totals = {
    visits: items.reduce((n, it) => n + it.visits, 0),
    patients: items.reduce((n, it) => n + it.patients, 0),
    revenue: sumMoney(items.map((it) => it.revenue)).toNumber(),
    salary: sumMoney(items.map((it) => it.salary)).toNumber(),
  };

  return { month, from: start.toISOString(), to: end.toISOString(), doctors: items, totals };
}
