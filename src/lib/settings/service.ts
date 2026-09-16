import { randomBytes } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { ApiError } from '@/lib/api/errors';
import { audit } from '@/lib/api/audit';
import { PERMISSIONS, CLINIC_ROLES } from '@/lib/permissions';
import { dayRangeTz } from '@/lib/date';
import type { SessionUser } from '@/lib/auth/session';
import { parseClinicSettings, type ClinicSettings } from './types';
import {
  SECTION_SCHEMAS,
  type AuditItemDTO,
  type AuditListDTO,
  type AuditQuery,
  type ClinicProfileDTO,
  type ClinicProfilePatch,
  type KioskKeyDTO,
  type RolesMatrixDTO,
  type SectionValues,
  type SettingsSection,
  kioskLinks,
} from './schemas';

/**
 * Sozlamalar xizmati (FAQAT SERVER — prisma).
 *  - getClinicProfile / updateClinicProfile — Clinic ustunlari (nom, telefon, ish vaqti …)
 *  - getClinicSettings / updateSection — Clinic.settings Json boʻlimlari (printer/sms/telegram/queue): merge → validate → audit
 *  - regenerateKioskKey — kiosk/tablo kaliti
 *  - listAudit — audit jurnali (foydalanuvchi nomlari bilan)
 * Har bir oʻzgarish AuditLog ga SETTINGS harakati bilan (before/after — faqat oʻzgargan kalitlar) yoziladi.
 */

type Actor = Pick<SessionUser, 'id'>;

const PROFILE_SELECT = {
  id: true,
  slug: true,
  name: true,
  phone: true,
  email: true,
  address: true,
  city: true,
  logoUrl: true,
  timezone: true,
  childAgeLimit: true,
  currency: true,
  roundTo: true,
  workStart: true,
  workEnd: true,
  slotMinutes: true,
  ticketFooter: true,
  kioskKey: true,
  plan: true,
  createdAt: true,
  updatedAt: true,
} as const;

type ProfileRow = Prisma.ClinicGetPayload<{ select: typeof PROFILE_SELECT }>;

function toProfileDTO(c: ProfileRow): ClinicProfileDTO {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name,
    phone: c.phone,
    email: c.email ?? '',
    address: c.address ?? '',
    city: c.city ?? '',
    logoUrl: c.logoUrl ?? '',
    timezone: c.timezone,
    childAgeLimit: c.childAgeLimit,
    currency: c.currency,
    roundTo: c.roundTo,
    workStart: c.workStart,
    workEnd: c.workEnd,
    slotMinutes: c.slotMinutes,
    ticketFooter: c.ticketFooter,
    kioskKey: c.kioskKey,
    plan: c.plan,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export async function getClinicProfile(clinicId: string): Promise<ClinicProfileDTO> {
  const c = await prisma.clinic.findFirst({ where: { id: clinicId }, select: PROFILE_SELECT });
  if (!c) throw ApiError.notFound('Klinika topilmadi');
  return toProfileDTO(c);
}

/** Oʻzgargan kalitlar: { before: {k: old}, after: {k: new} } */
export function diffObjects<T extends Record<string, unknown>>(before: T, after: T): { before: Partial<T>; after: Partial<T>; changed: (keyof T)[] } {
  const b: Partial<T> = {};
  const a: Partial<T> = {};
  const changed: (keyof T)[] = [];
  const keys = new Set<keyof T>([...Object.keys(before), ...Object.keys(after)] as (keyof T)[]);
  for (const k of keys) {
    const bv = before[k];
    const av = after[k];
    if (JSON.stringify(bv) !== JSON.stringify(av)) {
      b[k] = bv;
      a[k] = av;
      changed.push(k);
    }
  }
  return { before: b, after: a, changed };
}

export interface UpdateContext {
  user: Actor;
  ip?: string | null;
  userAgent?: string | null;
}

/** Klinika profilini qisman yangilash (faqat oʻzgargan maydonlar yoziladi va auditlanadi) */
export async function updateClinicProfile(clinicId: string, patch: ClinicProfilePatch, ctx: UpdateContext): Promise<ClinicProfileDTO> {
  const current = await prisma.clinic.findFirst({ where: { id: clinicId }, select: PROFILE_SELECT });
  if (!current) throw ApiError.notFound('Klinika topilmadi');
  const before = toProfileDTO(current);

  const data: Prisma.ClinicUpdateInput = {};
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.phone !== undefined) data.phone = patch.phone;
  if (patch.email !== undefined) data.email = patch.email || null;
  if (patch.address !== undefined) data.address = patch.address || null;
  if (patch.city !== undefined) data.city = patch.city || null;
  if (patch.logoUrl !== undefined) data.logoUrl = patch.logoUrl || null;
  if (patch.childAgeLimit !== undefined) data.childAgeLimit = patch.childAgeLimit;
  if (patch.roundTo !== undefined) data.roundTo = patch.roundTo;
  if (patch.workStart !== undefined) data.workStart = patch.workStart;
  if (patch.workEnd !== undefined) data.workEnd = patch.workEnd;
  if (patch.slotMinutes !== undefined) data.slotMinutes = patch.slotMinutes;
  if (patch.ticketFooter !== undefined) data.ticketFooter = patch.ticketFooter;
  if (patch.timezone !== undefined) data.timezone = patch.timezone;

  // Ish vaqti: faqat bittasi kelsa — mavjud qiymat bilan tekshirish
  const workStart = patch.workStart ?? before.workStart;
  const workEnd = patch.workEnd ?? before.workEnd;
  if (toMinutes(workEnd) <= toMinutes(workStart)) {
    throw ApiError.validation({ fieldErrors: { workEnd: ['settings.validation.endAfterStart'] } });
  }

  if (Object.keys(data).length === 0) return before;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.clinic.update({ where: { id: clinicId }, data, select: PROFILE_SELECT });
    const after = toProfileDTO(updated);
    const diff = diffObjects(profileAuditView(before), profileAuditView(after));
    if (diff.changed.length > 0) {
      await audit(
        {
          clinicId,
          userId: ctx.user.id,
          action: 'SETTINGS',
          entity: 'Clinic',
          entityId: clinicId,
          before: diff.before,
          after: diff.after,
          ip: ctx.ip ?? null,
          userAgent: ctx.userAgent ?? null,
        },
        tx,
      );
    }
    return after;
  });
}

function profileAuditView(p: ClinicProfileDTO): Record<string, unknown> {
  const { id: _id, slug: _slug, kioskKey: _k, createdAt: _c, updatedAt: _u, plan: _p, currency: _cur, ...rest } = p;
  return rest;
}

function toMinutes(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Clinic.settings (toʻliq, defaultlar bilan) */
export async function getClinicSettings(clinicId: string): Promise<ClinicSettings> {
  const c = await prisma.clinic.findFirst({ where: { id: clinicId }, select: { settings: true } });
  if (!c) throw ApiError.notFound('Klinika topilmadi');
  return parseClinicSettings(c.settings);
}

export async function getSection<S extends SettingsSection>(clinicId: string, section: S): Promise<SectionValues[S]> {
  const all = await getClinicSettings(clinicId);
  return all[section] as SectionValues[S];
}

/**
 * Boʻlimni qisman yangilash: joriy qiymat + patch → boʻlim sxemasi bilan tekshirish → butun Json ni yozish → audit.
 * Qaytadi: boʻlimning yangi (tekshirilgan) qiymati.
 */
export async function updateSection<S extends SettingsSection>(
  clinicId: string,
  section: S,
  patch: Partial<SectionValues[S]>,
  ctx: UpdateContext,
): Promise<SectionValues[S]> {
  const c = await prisma.clinic.findFirst({ where: { id: clinicId }, select: { settings: true } });
  if (!c) throw ApiError.notFound('Klinika topilmadi');
  const current = parseClinicSettings(c.settings);
  const before = current[section] as SectionValues[S];

  const merged: Record<string, unknown> = { ...(before as Record<string, unknown>) };
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) merged[k] = v;
  }
  const schema = SECTION_SCHEMAS[section];
  const parsed = schema.safeParse(merged);
  if (!parsed.success) throw ApiError.validation(parsed.error.flatten());
  const after = parsed.data as SectionValues[S];

  const next: ClinicSettings = { ...current, [section]: after };
  const diff = diffObjects(before as Record<string, unknown>, after as Record<string, unknown>);

  await prisma.$transaction(async (tx) => {
    await tx.clinic.update({ where: { id: clinicId }, data: { settings: next as unknown as Prisma.InputJsonValue } });
    if (diff.changed.length > 0) {
      await audit(
        {
          clinicId,
          userId: ctx.user.id,
          action: 'SETTINGS',
          entity: 'ClinicSettings',
          entityId: section,
          before: diff.before,
          after: diff.after,
          ip: ctx.ip ?? null,
          userAgent: ctx.userAgent ?? null,
        },
        tx,
      );
    }
  });
  return after;
}

/** Yangi kiosk kaliti: 24 baytli URL-xavfsiz tasodifiy satr */
export function generateKioskKey(): string {
  return randomBytes(24).toString('base64url');
}

export async function regenerateKioskKey(clinicId: string, ctx: UpdateContext, origin = ''): Promise<KioskKeyDTO> {
  const c = await prisma.clinic.findFirst({ where: { id: clinicId }, select: { kioskKey: true } });
  if (!c) throw ApiError.notFound('Klinika topilmadi');
  const key = generateKioskKey();
  await prisma.$transaction(async (tx) => {
    await tx.clinic.update({ where: { id: clinicId }, data: { kioskKey: key } });
    await audit(
      {
        clinicId,
        userId: ctx.user.id,
        action: 'SETTINGS',
        entity: 'Clinic',
        entityId: clinicId,
        before: { kioskKey: maskKey(c.kioskKey) },
        after: { kioskKey: maskKey(key) },
        ip: ctx.ip ?? null,
        userAgent: ctx.userAgent ?? null,
      },
      tx,
    );
  });
  return { kioskKey: key, ...kioskLinks(key, origin) };
}

function maskKey(k: string): string {
  if (k.length <= 8) return '••••';
  return `${k.slice(0, 4)}…${k.slice(-4)}`;
}

/** Kiosk kaliti boʻyicha klinika (ochiq endpointlar uchun) */
export async function findClinicByKioskKey(key: string): Promise<{ id: string; settings: ClinicSettings } | null> {
  if (!key || key.length > 128) return null;
  const c = await prisma.clinic.findFirst({ where: { kioskKey: key, isActive: true }, select: { id: true, settings: true } });
  if (!c) return null;
  return { id: c.id, settings: parseClinicSettings(c.settings) };
}

// ── Audit jurnali ──

const AUDIT_USER_SELECT = { id: true, fullName: true, role: true, login: true } as const;

export async function listAudit(clinicId: string, q: AuditQuery): Promise<AuditListDTO> {
  const where: Prisma.AuditLogWhereInput = { clinicId };
  if (q.entity) where.entity = q.entity;
  if (q.entityId) where.entityId = q.entityId;
  if (q.userId) where.userId = q.userId;
  if (q.action) where.action = q.action;
  if (q.from || q.to) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (q.from) createdAt.gte = dayRangeTz(q.from).start;
    if (q.to) createdAt.lte = dayRangeTz(q.to).end;
    where.createdAt = createdAt;
  }

  const [total, rows, entityRows, users] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      select: {
        id: true,
        action: true,
        entity: true,
        entityId: true,
        before: true,
        after: true,
        ip: true,
        userAgent: true,
        createdAt: true,
        user: { select: AUDIT_USER_SELECT },
      },
    }),
    prisma.auditLog.findMany({ where: { clinicId }, distinct: ['entity'], select: { entity: true }, orderBy: { entity: 'asc' } }),
    prisma.user.findMany({ where: { clinicId }, select: { id: true, fullName: true, role: true }, orderBy: { fullName: 'asc' } }),
  ]);

  const items: AuditItemDTO[] = rows.map((r) => ({
    id: r.id,
    action: r.action,
    entity: r.entity,
    entityId: r.entityId,
    before: r.before,
    after: r.after,
    ip: r.ip,
    userAgent: r.userAgent,
    createdAt: r.createdAt.toISOString(),
    user: r.user ? { id: r.user.id, fullName: r.user.fullName, role: r.user.role, login: r.user.login } : null,
  }));

  return {
    items,
    total,
    page: q.page,
    pageSize: q.pageSize,
    entities: entityRows.map((e) => e.entity),
    users: users.map((u) => ({ id: u.id, fullName: u.fullName, role: u.role })),
  };
}

/** Rollar matritsasi (permissions.ts dan) */
export function rolesMatrix(): RolesMatrixDTO {
  return {
    roles: [...CLINIC_ROLES],
    permissions: Object.entries(PERMISSIONS).map(([key, roles]) => ({ key, roles: [...roles] })),
  };
}
