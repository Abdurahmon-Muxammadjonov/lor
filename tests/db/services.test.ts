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
import { GET as listGET, POST as createPOST } from '@/app/api/services/route';
import { GET as oneGET, PATCH as onePATCH, DELETE as oneDELETE } from '@/app/api/services/[id]/route';
import { POST as bulkPOST } from '@/app/api/services/bulk/route';
import { POST as reorderPOST } from '@/app/api/services/reorder/route';
import { GET as historyGET } from '@/app/api/services/[id]/history/route';
import { GET as exportGET } from '@/app/api/services/export/route';
import { GET as categoriesGET, POST as categoryPOST } from '@/app/api/categories/route';
import { PATCH as categoryPATCH, DELETE as categoryDELETE } from '@/app/api/categories/[id]/route';
import { POST as categoriesReorderPOST } from '@/app/api/categories/reorder/route';
import type { BulkResultDTO, CategoryDTO, ServiceDTO, ServiceHistoryDTO, ServicesListDTO } from '@/lib/services/types';

const HAS_DB = !!process.env.DATABASE_URL;
const dbDescribe = HAS_DB ? describe : describe.skip;

const MARKER = 'ZZTEST';
const CODE_A = 'ZT-901';
const CODE_B = 'ZT-902';
const CODE_C = 'ZT-903';

interface TestUser {
  id: string;
  login: string;
  role: Role;
  fullName: string;
  clinicId: string;
}

type PrismaModule = typeof import('@/lib/prisma');
let db: PrismaModule['prisma'];

const clinics = { demo: '', lorPlus: '' };
const users: Record<string, TestUser> = {};

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
      clinicName: u.clinicId === clinics.demo ? 'Shifo LOR' : 'LOR Plus',
      clinicSlug: u.clinicId === clinics.demo ? 'demo' : 'lor-plus',
    }),
  );
}

const ctx = (id: string) => ({ params: { id } });

async function cleanup() {
  const svc = await db.service.findMany({ where: { code: { startsWith: 'ZT-9' } }, select: { id: true } });
  const svcIds = svc.map((s) => s.id);
  const cats = await db.serviceCategory.findMany({ where: { name: { contains: MARKER } }, select: { id: true } });
  const catIds = cats.map((c) => c.id);
  if (svcIds.length > 0) {
    await db.auditLog.deleteMany({ where: { entity: 'Service', entityId: { in: svcIds } } });
    await db.service.deleteMany({ where: { id: { in: svcIds } } });
  }
  if (catIds.length > 0) {
    await db.auditLog.deleteMany({ where: { entity: 'ServiceCategory', entityId: { in: catIds } } });
    await db.serviceCategory.deleteMany({ where: { id: { in: catIds } } });
  }
}

const baseService = (categoryId: string, code: string) => ({
  categoryId,
  code,
  name: `Test muolaja ${MARKER}`,
  nameRu: `Тестовая процедура ${MARKER}`,
  unit: 'seans',
  priceAdultNoMed: 120000,
  priceAdultMed: 150000,
  priceChildNoMed: 90000,
  priceChildMed: 110000,
  allowHalf: true,
  medicineOptional: true,
  durationMin: 20,
  defaultOrgan: 'NOSE',
});

dbDescribe('services API (DB)', () => {
  beforeAll(async () => {
    db = (await import('@/lib/prisma')).prisma;
    const rows = await db.clinic.findMany({ where: { slug: { in: ['demo', 'lor-plus'] } }, select: { id: true, slug: true } });
    for (const c of rows) {
      if (c.slug === 'demo') clinics.demo = c.id;
      if (c.slug === 'lor-plus') clinics.lorPlus = c.id;
    }
    expect(clinics.demo).toBeTruthy();
    expect(clinics.lorPlus).toBeTruthy();
    const us = await db.user.findMany({
      where: { login: { in: ['admin', 'doctor', 'reception', 'cashier', 'admin2'] } },
      select: { id: true, login: true, role: true, fullName: true, clinicId: true },
    });
    for (const u of us) users[u.login] = u;
    for (const l of ['admin', 'doctor', 'reception', 'cashier', 'admin2']) expect(users[l], `seed user ${l}`).toBeTruthy();
    await cleanup();
  });

  afterAll(async () => {
    if (!db) return;
    await cleanup();
    await db.$disconnect();
  });

  let category: CategoryDTO;
  let serviceA: ServiceDTO;
  let serviceB: ServiceDTO;

  it('ADMIN creates a category; RECEPTION → 403', async () => {
    actAs('reception');
    const denied = await categoryPOST(makeRequest('POST', '/api/categories', { name: `Kat ${MARKER}`, nameRu: `Кат ${MARKER}`, icon: 'wind' }));
    expect((await readError(denied)).status).toBe(403);

    actAs('admin');
    const res = await categoryPOST(makeRequest('POST', '/api/categories', { name: `Kat ${MARKER}`, nameRu: `Кат ${MARKER}`, icon: 'wind' }));
    expect(res.status).toBe(201);
    category = await readData<CategoryDTO>(res);
    expect(category.clinicId).toBe(clinics.demo);
    expect(category.icon).toBe('wind');
    expect(category.servicesCount).toBe(0);
    expect(category.order).toBeGreaterThan(0);

    const dup = await categoryPOST(makeRequest('POST', '/api/categories', { name: `Kat ${MARKER}`, nameRu: 'Дубль', icon: null }));
    expect((await readError(dup)).status).toBe(409);
  });

  it('ADMIN creates services (201, money integers, category attached); duplicate code → 409; DOCTOR → 403', async () => {
    actAs('doctor');
    const denied = await createPOST(makeRequest('POST', '/api/services', baseService(category.id, CODE_A)));
    expect((await readError(denied)).status).toBe(403);

    actAs('admin');
    const resA = await createPOST(makeRequest('POST', '/api/services', { ...baseService(category.id, CODE_A), code: CODE_A.toLowerCase() }));
    expect(resA.status).toBe(201);
    serviceA = await readData<ServiceDTO>(resA);
    expect(serviceA.code).toBe(CODE_A);
    expect(serviceA.priceAdultNoMed).toBe(120000);
    expect(typeof serviceA.priceChildMed).toBe('number');
    expect(serviceA.category.id).toBe(category.id);
    expect(serviceA.linesCount).toBe(0);
    expect(serviceA.clinicId).toBe(clinics.demo);

    const resB = await createPOST(makeRequest('POST', '/api/services', { ...baseService(category.id, CODE_B), allowHalf: false, medicineOptional: false }));
    expect(resB.status).toBe(201);
    serviceB = await readData<ServiceDTO>(resB);
    expect(serviceB.allowHalf).toBe(false);
    expect(serviceB.medicineOptional).toBe(false);

    const dup = await createPOST(makeRequest('POST', '/api/services', baseService(category.id, CODE_A)));
    const err = await readError(dup);
    expect(err.status).toBe(409);
    expect(err.code).toBe('CONFLICT');

    const bad = await createPOST(makeRequest('POST', '/api/services', { ...baseService(category.id, CODE_C), durationMin: 2 }));
    expect((await readError(bad)).code).toBe('VALIDATION');

    const created = await db.auditLog.findFirst({ where: { entity: 'Service', entityId: serviceA.id, action: 'CREATE' } });
    expect(created).toBeTruthy();
  });

  it('GET /api/services?all=1 lists with category; without all — only active; categoryId filter', async () => {
    actAs('cashier');
    const all = await readData<ServicesListDTO>(await listGET(makeRequest('GET', `/api/services?all=1&categoryId=${category.id}`)));
    expect(all.items.map((s) => s.code).sort()).toEqual([CODE_A, CODE_B]);
    expect(all.items[0]?.category.name).toBe(`Kat ${MARKER}`);
    expect(all.items.every((s) => Number.isInteger(s.priceAdultMed))).toBe(true);

    actAs('admin');
    await onePATCH(makeRequest('PATCH', `/api/services/${serviceB.id}`, { isActive: false }), ctx(serviceB.id));
    actAs('doctor');
    const active = await readData<ServicesListDTO>(await listGET(makeRequest('GET', `/api/services?categoryId=${category.id}`)));
    expect(active.items.map((s) => s.code)).toEqual([CODE_A]);
    const withInactive = await readData<ServicesListDTO>(await listGET(makeRequest('GET', `/api/services?all=1&categoryId=${category.id}`)));
    expect(withInactive.items).toHaveLength(2);

    const one = await readData<ServiceDTO>(await oneGET(makeRequest('GET', `/api/services/${serviceB.id}`), ctx(serviceB.id)));
    expect(one.isActive).toBe(false);

    const cats = await readData<{ items: CategoryDTO[] }>(await categoriesGET(makeRequest('GET', '/api/categories')));
    const mine = cats.items.find((c) => c.id === category.id);
    expect(mine?.servicesCount).toBe(2);
    expect(mine?.activeCount).toBe(1);
  });

  it('criterion 9: DOCTOR cannot change prices (PATCH → 403, bulk → 403); DB untouched', async () => {
    actAs('doctor');
    const res = await onePATCH(makeRequest('PATCH', `/api/services/${serviceA.id}`, { priceAdultNoMed: 999000 }), ctx(serviceA.id));
    const err = await readError(res);
    expect(err.status).toBe(403);
    expect(err.code).toBe('FORBIDDEN');

    const bulk = await bulkPOST(makeRequest('POST', '/api/services/bulk', { mode: 'PERCENT', value: 10, fields: ['priceAdultNoMed'], serviceIds: [serviceA.id] }));
    expect((await readError(bulk)).status).toBe(403);

    actAs('cashier');
    const res2 = await onePATCH(makeRequest('PATCH', `/api/services/${serviceA.id}`, { priceAdultNoMed: 999000 }), ctx(serviceA.id));
    expect((await readError(res2)).status).toBe(403);

    const row = await db.service.findUniqueOrThrow({ where: { id: serviceA.id } });
    expect(row.priceAdultNoMed.toString()).toBe('120000');
  });

  it('ADMIN PATCH price → 200, PRICE_CHANGE audit row with before/after; non-price patch → UPDATE audit only', async () => {
    actAs('admin');
    const res = await onePATCH(makeRequest('PATCH', `/api/services/${serviceA.id}`, { priceAdultNoMed: '130 000' }), ctx(serviceA.id));
    expect(res.status).toBe(200);
    const row = await readData<ServiceDTO>(res);
    expect(row.priceAdultNoMed).toBe(130000);
    expect(row.priceAdultMed).toBe(150000);

    const log = await db.auditLog.findFirst({
      where: { clinicId: clinics.demo, entity: 'Service', entityId: serviceA.id, action: 'PRICE_CHANGE' },
      orderBy: { createdAt: 'desc' },
    });
    expect(log).toBeTruthy();
    expect(log?.userId).toBe(users.admin?.id);
    const before = log?.before as Record<string, unknown>;
    const after = log?.after as Record<string, unknown>;
    expect(before.priceAdultNoMed).toBe(120000);
    expect(after.priceAdultNoMed).toBe(130000);
    expect(after.priceAdultMed).toBe(150000);

    const same = await onePATCH(makeRequest('PATCH', `/api/services/${serviceA.id}`, { priceAdultNoMed: 130000 }), ctx(serviceA.id));
    expect(same.status).toBe(200);
    const priceLogs = await db.auditLog.count({ where: { entity: 'Service', entityId: serviceA.id, action: 'PRICE_CHANGE' } });
    expect(priceLogs).toBe(1);

    const other = await onePATCH(makeRequest('PATCH', `/api/services/${serviceA.id}`, { durationMin: 30, allowHalf: false }), ctx(serviceA.id));
    const updated = await readData<ServiceDTO>(other);
    expect(updated.durationMin).toBe(30);
    expect(updated.allowHalf).toBe(false);
    const updateLog = await db.auditLog.findFirst({ where: { entity: 'Service', entityId: serviceA.id, action: 'UPDATE' }, orderBy: { createdAt: 'desc' } });
    expect((updateLog?.after as Record<string, unknown>).durationMin).toBe(30);
    expect(await db.auditLog.count({ where: { entity: 'Service', entityId: serviceA.id, action: 'PRICE_CHANGE' } })).toBe(1);

    const empty = await onePATCH(makeRequest('PATCH', `/api/services/${serviceA.id}`, {}), ctx(serviceA.id));
    expect((await readError(empty)).code).toBe('VALIDATION');
  });

  it('history endpoint returns PRICE_CHANGE / UPDATE / CREATE entries with user', async () => {
    actAs('reception');
    const h = await readData<ServiceHistoryDTO>(await historyGET(makeRequest('GET', `/api/services/${serviceA.id}/history?limit=10`), ctx(serviceA.id)));
    const actions = h.items.map((i) => i.action);
    expect(actions).toContain('PRICE_CHANGE');
    expect(actions).toContain('UPDATE');
    expect(actions).toContain('CREATE');
    const pc = h.items.find((i) => i.action === 'PRICE_CHANGE');
    expect(pc?.user?.fullName).toBe(users.admin?.fullName);
    expect(pc?.after?.priceAdultNoMed).toBe(130000);
  });

  it('bulk preview computes new prices without changing DB; apply writes + audits per service', async () => {
    actAs('admin');
    const previewRes = await bulkPOST(
      makeRequest('POST', '/api/services/bulk', {
        mode: 'PERCENT',
        value: 10,
        fields: ['priceAdultNoMed', 'priceChildMed'],
        roundTo: 100,
        preview: true,
        serviceIds: [serviceA.id, serviceB.id],
      }),
    );
    expect(previewRes.status).toBe(200);
    const preview = await readData<BulkResultDTO>(previewRes);
    expect(preview.preview).toBe(true);
    expect(preview.total).toBe(2);
    expect(preview.updated).toBe(2);
    const rowA = preview.rows.find((r) => r.id === serviceA.id);
    expect(rowA?.changes).toEqual([
      { field: 'priceAdultNoMed', from: 130000, to: 143000 },
      { field: 'priceChildMed', from: 110000, to: 121000 },
    ]);

    const dbA = await db.service.findUniqueOrThrow({ where: { id: serviceA.id } });
    expect(dbA.priceAdultNoMed.toString()).toBe('130000');
    expect(dbA.priceChildMed.toString()).toBe('110000');
    expect(await db.auditLog.count({ where: { entity: 'Service', entityId: serviceA.id, action: 'PRICE_CHANGE' } })).toBe(1);

    const applyRes = await bulkPOST(
      makeRequest('POST', '/api/services/bulk', {
        mode: 'FIXED',
        value: -5000,
        fields: ['priceAdultMed'],
        roundTo: 100,
        categoryId: category.id,
      }),
    );
    const applied = await readData<BulkResultDTO>(applyRes);
    expect(applied.preview).toBe(false);
    expect(applied.total).toBe(2);
    expect(applied.updated).toBe(2);

    const afterA = await db.service.findUniqueOrThrow({ where: { id: serviceA.id } });
    const afterB = await db.service.findUniqueOrThrow({ where: { id: serviceB.id } });
    expect(afterA.priceAdultMed.toString()).toBe('145000');
    expect(afterB.priceAdultMed.toString()).toBe('145000');
    expect(afterA.priceAdultNoMed.toString()).toBe('130000');

    const logsA = await db.auditLog.findMany({ where: { entity: 'Service', entityId: serviceA.id, action: 'PRICE_CHANGE' }, orderBy: { createdAt: 'desc' } });
    expect(logsA).toHaveLength(2);
    const bulkMeta = (logsA[0]?.after as Record<string, unknown>).bulk as Record<string, unknown>;
    expect(bulkMeta.mode).toBe('FIXED');
    expect(bulkMeta.value).toBe(-5000);
    expect(await db.auditLog.count({ where: { entity: 'Service', entityId: serviceB.id, action: 'PRICE_CHANGE' } })).toBe(1);

    const noop = await readData<BulkResultDTO>(
      await bulkPOST(makeRequest('POST', '/api/services/bulk', { mode: 'SET', value: 145000, fields: ['priceAdultMed'], serviceIds: [serviceA.id] })),
    );
    expect(noop.updated).toBe(0);
    expect(await db.auditLog.count({ where: { entity: 'Service', entityId: serviceA.id, action: 'PRICE_CHANGE' } })).toBe(2);

    const bad = await bulkPOST(makeRequest('POST', '/api/services/bulk', { mode: 'PERCENT', value: 0, fields: ['priceAdultMed'] }));
    expect((await readError(bad)).code).toBe('VALIDATION');
  });

  it('tenant isolation: other clinic admin → 404 on GET/PATCH/DELETE, bulk by ids → 404', async () => {
    actAs('admin2');
    expect((await readError(await oneGET(makeRequest('GET', `/api/services/${serviceA.id}`), ctx(serviceA.id)))).status).toBe(404);
    expect(
      (await readError(await onePATCH(makeRequest('PATCH', `/api/services/${serviceA.id}`, { priceAdultNoMed: 1 }), ctx(serviceA.id)))).status,
    ).toBe(404);
    expect((await readError(await oneDELETE(makeRequest('DELETE', `/api/services/${serviceA.id}`), ctx(serviceA.id)))).status).toBe(404);
    expect(
      (await readError(await bulkPOST(makeRequest('POST', '/api/services/bulk', { mode: 'PERCENT', value: 10, fields: ['priceAdultMed'], serviceIds: [serviceA.id] })))).status,
    ).toBe(404);
    expect(
      (await readError(await historyGET(makeRequest('GET', `/api/services/${serviceA.id}/history`), ctx(serviceA.id)))).status,
    ).toBe(404);
    expect(
      (await readError(await categoryPATCH(makeRequest('PATCH', `/api/categories/${category.id}`, { name: 'Hack' }), ctx(category.id)))).status,
    ).toBe(404);
    const list = await readData<ServicesListDTO>(await listGET(makeRequest('GET', '/api/services?all=1')));
    expect(list.items.some((s) => s.id === serviceA.id)).toBe(false);
    expect(list.items.every((s) => s.clinicId === clinics.lorPlus)).toBe(true);

    const row = await db.service.findUniqueOrThrow({ where: { id: serviceA.id } });
    expect(row.priceAdultNoMed.toString()).toBe('130000');
  });

  it('delete: service used in visits → 409; unused → 200 + DELETE audit', async () => {
    actAs('admin');
    const used = await db.service.findFirst({ where: { clinicId: clinics.demo, lines: { some: {} } }, select: { id: true, code: true } });
    expect(used, 'seed service with treatment lines').toBeTruthy();
    if (!used) return;
    const blocked = await oneDELETE(makeRequest('DELETE', `/api/services/${used.id}`), ctx(used.id));
    const err = await readError(blocked);
    expect(err.status).toBe(409);
    expect(err.code).toBe('CONFLICT');
    expect(await db.service.count({ where: { id: used.id } })).toBe(1);

    const res = await oneDELETE(makeRequest('DELETE', `/api/services/${serviceB.id}`), ctx(serviceB.id));
    expect(res.status).toBe(200);
    expect(await db.service.count({ where: { id: serviceB.id } })).toBe(0);
    const log = await db.auditLog.findFirst({ where: { entity: 'Service', entityId: serviceB.id, action: 'DELETE' } });
    expect((log?.before as Record<string, unknown>).code).toBe(CODE_B);
  });

  it('reorder services and categories; category delete blocked while non-empty, allowed when empty', async () => {
    actAs('admin');
    const resC = await createPOST(makeRequest('POST', '/api/services', baseService(category.id, CODE_C)));
    const serviceC = await readData<ServiceDTO>(resC);
    expect(serviceC.order).toBeGreaterThan(serviceA.order);

    const re = await readData<{ updated: number }>(await reorderPOST(makeRequest('POST', '/api/services/reorder', { ids: [serviceC.id, serviceA.id] })));
    expect(re.updated).toBe(2);
    const list = await readData<ServicesListDTO>(await listGET(makeRequest('GET', `/api/services?all=1&categoryId=${category.id}`)));
    expect(list.items.map((s) => s.code)).toEqual([CODE_C, CODE_A]);

    const foreign = await reorderPOST(makeRequest('POST', '/api/services/reorder', { ids: [serviceA.id, 'nope'] }));
    expect((await readError(foreign)).status).toBe(404);

    const cats = await readData<{ items: CategoryDTO[] }>(await categoriesGET(makeRequest('GET', '/api/categories')));
    const ids = cats.items.map((c) => c.id);
    const mineIdx = ids.indexOf(category.id);
    expect(mineIdx).toBeGreaterThan(0);
    const reordered = [category.id, ...ids.filter((id) => id !== category.id)];
    const rc = await readData<{ updated: number }>(await categoriesReorderPOST(makeRequest('POST', '/api/categories/reorder', { ids: reordered })));
    expect(rc.updated).toBe(ids.length);
    const after = await readData<{ items: CategoryDTO[] }>(await categoriesGET(makeRequest('GET', '/api/categories')));
    expect(after.items[0]?.id).toBe(category.id);
    // Seed tartibini qaytarish
    await categoriesReorderPOST(makeRequest('POST', '/api/categories/reorder', { ids }));

    const blocked = await categoryDELETE(makeRequest('DELETE', `/api/categories/${category.id}`), ctx(category.id));
    expect((await readError(blocked)).status).toBe(409);

    const renamed = await readData<CategoryDTO>(
      await categoryPATCH(makeRequest('PATCH', `/api/categories/${category.id}`, { nameRu: `Кат2 ${MARKER}`, icon: 'ear' }), ctx(category.id)),
    );
    expect(renamed.nameRu).toBe(`Кат2 ${MARKER}`);
    expect(renamed.icon).toBe('ear');
    expect(renamed.servicesCount).toBe(2);

    await oneDELETE(makeRequest('DELETE', `/api/services/${serviceA.id}`), ctx(serviceA.id));
    await oneDELETE(makeRequest('DELETE', `/api/services/${serviceC.id}`), ctx(serviceC.id));
    const del = await categoryDELETE(makeRequest('DELETE', `/api/categories/${category.id}`), ctx(category.id));
    expect(del.status).toBe(200);
    expect(await db.serviceCategory.count({ where: { id: category.id } })).toBe(0);
  });

  it('export: ADMIN gets an xlsx attachment; CASHIER → 403', async () => {
    actAs('cashier');
    expect((await readError(await exportGET(makeRequest('GET', '/api/services/export')))).status).toBe(403);

    actAs('admin');
    const res = await exportGET(makeRequest('GET', '/api/services/export?all=1&locale=ru'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('spreadsheetml');
    expect(res.headers.get('content-disposition')).toMatch(/attachment; filename="narxlar-\d{4}-\d{2}-\d{2}\.xlsx"/);
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBeGreaterThan(2000);
    // XLSX = ZIP: "PK" sarlavhasi
    expect(buf.subarray(0, 2).toString('latin1')).toBe('PK');
  });
});
