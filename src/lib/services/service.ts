import { Prisma } from '@prisma/client';
import { prisma, type Tx } from '@/lib/prisma';
import { ApiError, audit } from '@/lib/api';
import { D, toMoneyString } from '@/lib/money';
import { applyBulkRule, pricesToNumbers, type PriceRecord } from './pricing';
import {
  PRICE_FIELDS,
  type BulkOutput,
  type CategoryOutput,
  type CategoryUpdateOutput,
  type ServiceOutput,
  type ServiceUpdateOutput,
  type ServicesQuery,
} from './schemas';
import type { BulkPreviewRow, BulkResultDTO, ServiceHistoryItemDTO } from './types';

/**
 * Xizmatlar va kategoriyalar — server xizmat qatlami. Har bir soʻrov `clinicId` bilan cheklangan.
 * Narx/kategoriya oʻzgarishlari `audit()` ga yoziladi (PRICE_CHANGE / CREATE / UPDATE / DELETE).
 */

export interface ActorCtx {
  clinicId: string;
  userId: string;
  ip?: string | null;
  userAgent?: string | null;
}

const serviceInclude = {
  category: { select: { id: true, name: true, nameRu: true, icon: true, order: true } },
  _count: { select: { lines: true } },
} satisfies Prisma.ServiceInclude;

type ServiceWithRelations = Prisma.ServiceGetPayload<{ include: typeof serviceInclude }>;

/** Prisma qatori → API qatori (`_count` → `linesCount`) */
export function toServiceRow(s: ServiceWithRelations) {
  const { _count, ...rest } = s;
  return { ...rest, linesCount: _count.lines };
}
export type ServiceRow = ReturnType<typeof toServiceRow>;

const serviceOrder: Prisma.ServiceOrderByWithRelationInput[] = [
  { category: { order: 'asc' } },
  { order: 'asc' },
  { code: 'asc' },
];

const dbMoney = (v: Prisma.Decimal | number | string) => new Prisma.Decimal(toMoneyString(v));

function pricesOf(s: PriceRecord): Record<(typeof PRICE_FIELDS)[number], number> {
  return pricesToNumbers(s);
}

// ───────────────────────────── Xizmatlar ─────────────────────────────

export async function listServices(clinicId: string, query: ServicesQuery): Promise<ServiceRow[]> {
  const where: Prisma.ServiceWhereInput = { clinicId };
  if (!query.all) where.isActive = true;
  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.q) {
    const q = query.q;
    where.OR = [
      { code: { contains: q, mode: 'insensitive' } },
      { name: { contains: q, mode: 'insensitive' } },
      { nameRu: { contains: q, mode: 'insensitive' } },
    ];
  }
  const rows = await prisma.service.findMany({ where, include: serviceInclude, orderBy: serviceOrder });
  return rows.map(toServiceRow);
}

export async function getService(clinicId: string, id: string): Promise<ServiceRow> {
  const row = await prisma.service.findFirst({ where: { id, clinicId }, include: serviceInclude });
  if (!row) throw ApiError.notFound('Xizmat topilmadi');
  return toServiceRow(row);
}

async function assertCategory(clinicId: string, categoryId: string, db: Tx | typeof prisma = prisma) {
  const cat = await db.serviceCategory.findFirst({ where: { id: categoryId, clinicId }, select: { id: true } });
  if (!cat) {
    throw ApiError.validation({ fieldErrors: { categoryId: ['services.validation.category'] } }, 'Kategoriya topilmadi');
  }
}

async function assertCodeFree(clinicId: string, code: string, exceptId?: string, db: Tx | typeof prisma = prisma) {
  const dup = await db.service.findFirst({
    where: { clinicId, code, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    select: { id: true },
  });
  if (dup) throw new ApiError(409, 'CONFLICT', `"${code}" kodi allaqachon mavjud`, { field: 'code' });
}

function serviceSnapshot(s: ServiceWithRelations | ServiceRow) {
  return {
    code: s.code,
    categoryId: s.categoryId,
    name: s.name,
    nameRu: s.nameRu,
    unit: s.unit,
    ...pricesOf(s),
    allowHalf: s.allowHalf,
    medicineOptional: s.medicineOptional,
    durationMin: s.durationMin,
    defaultOrgan: s.defaultOrgan,
    isActive: s.isActive,
  };
}

export async function createService(ctx: ActorCtx, input: ServiceOutput): Promise<ServiceRow> {
  await assertCategory(ctx.clinicId, input.categoryId);
  await assertCodeFree(ctx.clinicId, input.code);

  const row = await prisma.$transaction(async (tx) => {
    const last = await tx.service.aggregate({
      where: { clinicId: ctx.clinicId, categoryId: input.categoryId },
      _max: { order: true },
    });
    const created = await tx.service.create({
      data: {
        clinicId: ctx.clinicId,
        categoryId: input.categoryId,
        code: input.code,
        name: input.name,
        nameRu: input.nameRu,
        unit: input.unit,
        priceAdultNoMed: dbMoney(input.priceAdultNoMed),
        priceAdultMed: dbMoney(input.priceAdultMed),
        priceChildNoMed: dbMoney(input.priceChildNoMed),
        priceChildMed: dbMoney(input.priceChildMed),
        allowHalf: input.allowHalf,
        medicineOptional: input.medicineOptional,
        durationMin: input.durationMin,
        defaultOrgan: input.defaultOrgan ?? null,
        isActive: input.isActive,
        order: (last._max.order ?? 0) + 1,
      },
      include: serviceInclude,
    });
    await audit(
      {
        clinicId: ctx.clinicId,
        userId: ctx.userId,
        action: 'CREATE',
        entity: 'Service',
        entityId: created.id,
        after: serviceSnapshot(created),
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
      tx,
    );
    return created;
  });
  return toServiceRow(row);
}

export async function updateService(ctx: ActorCtx, id: string, input: ServiceUpdateOutput): Promise<ServiceRow> {
  const current = await prisma.service.findFirst({ where: { id, clinicId: ctx.clinicId }, include: serviceInclude });
  if (!current) throw ApiError.notFound('Xizmat topilmadi');

  if (input.categoryId && input.categoryId !== current.categoryId) await assertCategory(ctx.clinicId, input.categoryId);
  if (input.code && input.code !== current.code) await assertCodeFree(ctx.clinicId, input.code, id);

  const data: Prisma.ServiceUncheckedUpdateInput = {};
  const beforeOther: Record<string, unknown> = {};
  const afterOther: Record<string, unknown> = {};
  let priceChanged = false;

  const setIfChanged = <K extends keyof typeof current>(key: K, next: (typeof current)[K] | undefined) => {
    if (next === undefined || next === current[key]) return;
    (data as Record<string, unknown>)[key] = next;
    beforeOther[key] = current[key];
    afterOther[key] = next;
  };

  setIfChanged('categoryId', input.categoryId);
  setIfChanged('code', input.code);
  setIfChanged('name', input.name);
  setIfChanged('nameRu', input.nameRu);
  setIfChanged('unit', input.unit);
  setIfChanged('allowHalf', input.allowHalf);
  setIfChanged('medicineOptional', input.medicineOptional);
  setIfChanged('durationMin', input.durationMin);
  setIfChanged('isActive', input.isActive);
  if (input.defaultOrgan !== undefined && (input.defaultOrgan ?? null) !== current.defaultOrgan) {
    data.defaultOrgan = input.defaultOrgan ?? null;
    beforeOther.defaultOrgan = current.defaultOrgan;
    afterOther.defaultOrgan = input.defaultOrgan ?? null;
  }

  for (const f of PRICE_FIELDS) {
    const next = input[f];
    if (next === undefined) continue;
    if (!D(next).eq(D(current[f].toString()))) {
      data[f] = dbMoney(next);
      priceChanged = true;
    }
  }

  if (Object.keys(data).length === 0) return toServiceRow(current);

  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.service.update({ where: { id }, data, include: serviceInclude });
    if (priceChanged) {
      await audit(
        {
          clinicId: ctx.clinicId,
          userId: ctx.userId,
          action: 'PRICE_CHANGE',
          entity: 'Service',
          entityId: id,
          before: { code: current.code, ...pricesOf(current) },
          after: { code: updated.code, ...pricesOf(updated) },
          ip: ctx.ip,
          userAgent: ctx.userAgent,
        },
        tx,
      );
    }
    if (Object.keys(afterOther).length > 0) {
      await audit(
        {
          clinicId: ctx.clinicId,
          userId: ctx.userId,
          action: 'UPDATE',
          entity: 'Service',
          entityId: id,
          before: { code: current.code, ...beforeOther },
          after: { code: updated.code, ...afterOther },
          ip: ctx.ip,
          userAgent: ctx.userAgent,
        },
        tx,
      );
    }
    return updated;
  });
  return toServiceRow(row);
}

export async function deleteService(ctx: ActorCtx, id: string): Promise<void> {
  const current = await prisma.service.findFirst({ where: { id, clinicId: ctx.clinicId }, include: serviceInclude });
  if (!current) throw ApiError.notFound('Xizmat topilmadi');
  if (current._count.lines > 0) {
    throw new ApiError(
      409,
      'CONFLICT',
      'Bu xizmat qabullarda ishlatilgan — oʻchirib boʻlmaydi. Uni nofaol qiling.',
      { linesCount: current._count.lines },
    );
  }
  await prisma.$transaction(async (tx) => {
    await tx.service.delete({ where: { id } });
    await audit(
      {
        clinicId: ctx.clinicId,
        userId: ctx.userId,
        action: 'DELETE',
        entity: 'Service',
        entityId: id,
        before: serviceSnapshot(current),
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
      tx,
    );
  });
}

export async function reorderServices(ctx: ActorCtx, ids: string[]): Promise<number> {
  const unique = Array.from(new Set(ids));
  const owned = await prisma.service.count({ where: { clinicId: ctx.clinicId, id: { in: unique } } });
  if (owned !== unique.length) throw ApiError.notFound('Baʼzi xizmatlar topilmadi');
  await prisma.$transaction(
    unique.map((id, i) => prisma.service.updateMany({ where: { id, clinicId: ctx.clinicId }, data: { order: i + 1 } })),
  );
  return unique.length;
}

/**
 * Ommaviy narx oʻzgartirish. `preview=true` — faqat hisob (DB oʻzgarmaydi).
 * Aks holda bitta tranzaksiyada har bir oʻzgargan xizmat yangilanadi va PRICE_CHANGE auditi yoziladi.
 */
export async function bulkUpdateServices(ctx: ActorCtx, input: BulkOutput): Promise<BulkResultDTO> {
  const where: Prisma.ServiceWhereInput = { clinicId: ctx.clinicId };
  if (input.categoryId) where.categoryId = input.categoryId;
  const uniqueIds = input.serviceIds ? Array.from(new Set(input.serviceIds)) : null;
  if (uniqueIds) where.id = { in: uniqueIds };

  if (input.categoryId) await assertCategory(ctx.clinicId, input.categoryId);
  const services = await prisma.service.findMany({ where, orderBy: serviceOrder });
  if (uniqueIds && services.length !== uniqueIds.length) throw ApiError.notFound('Baʼzi xizmatlar topilmadi');

  const rule = { mode: input.mode, value: input.value, roundTo: input.roundTo };
  const rows: BulkPreviewRow[] = services.map((s) => {
    const { changes } = applyBulkRule(s, input.fields, rule);
    return { id: s.id, code: s.code, name: s.name, nameRu: s.nameRu, categoryId: s.categoryId, changes };
  });
  const changed = rows.filter((r) => r.changes.length > 0);

  if (input.preview || changed.length === 0) {
    return { preview: input.preview, total: rows.length, updated: changed.length, rows };
  }

  const byId = new Map(services.map((s) => [s.id, s]));
  await prisma.$transaction(async (tx) => {
    for (const row of changed) {
      const s = byId.get(row.id);
      if (!s) continue;
      const { next } = applyBulkRule(s, input.fields, rule);
      const data: Prisma.ServiceUncheckedUpdateInput = {};
      for (const c of row.changes) data[c.field] = dbMoney(c.to);
      await tx.service.update({ where: { id: s.id }, data });
      await audit(
        {
          clinicId: ctx.clinicId,
          userId: ctx.userId,
          action: 'PRICE_CHANGE',
          entity: 'Service',
          entityId: s.id,
          before: { code: s.code, ...pricesOf(s) },
          after: { code: s.code, ...next, bulk: { mode: input.mode, value: input.value, roundTo: input.roundTo } },
          ip: ctx.ip,
          userAgent: ctx.userAgent,
        },
        tx,
      );
    }
  });

  return { preview: false, total: rows.length, updated: changed.length, rows };
}

// ───────────────────────────── Narx tarixi ─────────────────────────────

function asRecord(v: Prisma.JsonValue | null): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export async function getServiceHistory(clinicId: string, id: string, limit: number): Promise<ServiceHistoryItemDTO[]> {
  const exists = await prisma.service.findFirst({ where: { id, clinicId }, select: { id: true } });
  if (!exists) throw ApiError.notFound('Xizmat topilmadi');
  const logs = await prisma.auditLog.findMany({
    where: { clinicId, entity: 'Service', entityId: id },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { user: { select: { id: true, fullName: true } } },
  });
  return logs.map((l) => ({
    id: l.id,
    action: l.action,
    before: asRecord(l.before),
    after: asRecord(l.after),
    createdAt: l.createdAt.toISOString(),
    user: l.user ? { id: l.user.id, fullName: l.user.fullName } : null,
  }));
}

// ───────────────────────────── Kategoriyalar ─────────────────────────────

export async function listCategories(clinicId: string) {
  const [cats, active] = await Promise.all([
    prisma.serviceCategory.findMany({
      where: { clinicId },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { services: true } } },
    }),
    prisma.service.groupBy({ by: ['categoryId'], where: { clinicId, isActive: true }, _count: { _all: true } }),
  ]);
  const activeMap = new Map(active.map((a) => [a.categoryId, a._count._all]));
  return cats.map(({ _count, ...c }) => ({
    ...c,
    servicesCount: _count.services,
    activeCount: activeMap.get(c.id) ?? 0,
  }));
}
export type CategoryRow = Awaited<ReturnType<typeof listCategories>>[number];

async function assertCategoryNameFree(clinicId: string, name: string, exceptId?: string) {
  const dup = await prisma.serviceCategory.findFirst({
    where: { clinicId, name, ...(exceptId ? { NOT: { id: exceptId } } : {}) },
    select: { id: true },
  });
  if (dup) throw new ApiError(409, 'CONFLICT', `"${name}" kategoriyasi allaqachon mavjud`, { field: 'name' });
}

export async function createCategory(ctx: ActorCtx, input: CategoryOutput): Promise<CategoryRow> {
  await assertCategoryNameFree(ctx.clinicId, input.name);
  const row = await prisma.$transaction(async (tx) => {
    const last = await tx.serviceCategory.aggregate({ where: { clinicId: ctx.clinicId }, _max: { order: true } });
    const order = input.order > 0 ? input.order : (last._max.order ?? 0) + 1;
    const created = await tx.serviceCategory.create({
      data: { clinicId: ctx.clinicId, name: input.name, nameRu: input.nameRu, icon: input.icon ?? null, order },
    });
    await audit(
      {
        clinicId: ctx.clinicId,
        userId: ctx.userId,
        action: 'CREATE',
        entity: 'ServiceCategory',
        entityId: created.id,
        after: { name: created.name, nameRu: created.nameRu, icon: created.icon, order: created.order },
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
      tx,
    );
    return created;
  });
  return { ...row, servicesCount: 0, activeCount: 0 };
}

export async function updateCategory(ctx: ActorCtx, id: string, input: CategoryUpdateOutput): Promise<CategoryRow> {
  const current = await prisma.serviceCategory.findFirst({ where: { id, clinicId: ctx.clinicId } });
  if (!current) throw ApiError.notFound('Kategoriya topilmadi');
  if (input.name && input.name !== current.name) await assertCategoryNameFree(ctx.clinicId, input.name, id);

  const data: Prisma.ServiceCategoryUncheckedUpdateInput = {};
  const before: Record<string, unknown> = {};
  const after: Record<string, unknown> = {};
  if (input.name !== undefined && input.name !== current.name) {
    data.name = input.name;
    before.name = current.name;
    after.name = input.name;
  }
  if (input.nameRu !== undefined && input.nameRu !== current.nameRu) {
    data.nameRu = input.nameRu;
    before.nameRu = current.nameRu;
    after.nameRu = input.nameRu;
  }
  if (input.icon !== undefined && (input.icon ?? null) !== current.icon) {
    data.icon = input.icon ?? null;
    before.icon = current.icon;
    after.icon = input.icon ?? null;
  }
  if (input.order !== undefined && input.order !== current.order) {
    data.order = input.order;
    before.order = current.order;
    after.order = input.order;
  }

  const counts = await countsFor(ctx.clinicId, id);
  if (Object.keys(data).length === 0) return { ...current, ...counts };

  const row = await prisma.$transaction(async (tx) => {
    const updated = await tx.serviceCategory.update({ where: { id }, data });
    await audit(
      {
        clinicId: ctx.clinicId,
        userId: ctx.userId,
        action: 'UPDATE',
        entity: 'ServiceCategory',
        entityId: id,
        before,
        after,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
      tx,
    );
    return updated;
  });
  return { ...row, ...counts };
}

async function countsFor(clinicId: string, categoryId: string) {
  const [servicesCount, activeCount] = await Promise.all([
    prisma.service.count({ where: { clinicId, categoryId } }),
    prisma.service.count({ where: { clinicId, categoryId, isActive: true } }),
  ]);
  return { servicesCount, activeCount };
}

export async function deleteCategory(ctx: ActorCtx, id: string): Promise<void> {
  const current = await prisma.serviceCategory.findFirst({
    where: { id, clinicId: ctx.clinicId },
    include: { _count: { select: { services: true } } },
  });
  if (!current) throw ApiError.notFound('Kategoriya topilmadi');
  if (current._count.services > 0) {
    throw new ApiError(409, 'CONFLICT', 'Kategoriyada xizmatlar bor — avval ularni koʻchiring yoki oʻchiring', {
      servicesCount: current._count.services,
    });
  }
  await prisma.$transaction(async (tx) => {
    await tx.serviceCategory.delete({ where: { id } });
    await audit(
      {
        clinicId: ctx.clinicId,
        userId: ctx.userId,
        action: 'DELETE',
        entity: 'ServiceCategory',
        entityId: id,
        before: { name: current.name, nameRu: current.nameRu, icon: current.icon, order: current.order },
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      },
      tx,
    );
  });
}

export async function reorderCategories(ctx: ActorCtx, ids: string[]): Promise<number> {
  const unique = Array.from(new Set(ids));
  const owned = await prisma.serviceCategory.count({ where: { clinicId: ctx.clinicId, id: { in: unique } } });
  if (owned !== unique.length) throw ApiError.notFound('Baʼzi kategoriyalar topilmadi');
  await prisma.$transaction(
    unique.map((id, i) =>
      prisma.serviceCategory.updateMany({ where: { id, clinicId: ctx.clinicId }, data: { order: i + 1 } }),
    ),
  );
  return unique.length;
}
