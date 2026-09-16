import { describe, it, expect } from 'vitest';
import { NextResponse } from 'next/server';
import { mockSession, sessionFor, TEST_USER } from '../helpers/session';
import { makeRequest, readJson, readData, readError, TEST_ORIGIN } from '../helpers/request';
import { ok, fail } from '@/lib/api/respond';

describe('helpers: mockSession', () => {
  it('standart: ADMIN, clinic_test, expires kelajakda', () => {
    const s = mockSession();
    expect(s.user.role).toBe('ADMIN');
    expect(s.user.clinicId).toBe('clinic_test');
    expect(s.user.id).toBe(TEST_USER.id);
    expect(new Date(s.expires).getTime()).toBeGreaterThan(Date.now());
  });

  it('qisman foydalanuvchi ustiga yoziladi', () => {
    const s = mockSession({ role: 'DOCTOR', id: 'doc_1', fullName: 'Dr. Aliyev' });
    expect(s.user.role).toBe('DOCTOR');
    expect(s.user.id).toBe('doc_1');
    expect(s.user.fullName).toBe('Dr. Aliyev');
    expect(s.user.name).toBe('Dr. Aliyev');
    expect(s.user.clinicId).toBe('clinic_test');
  });

  it('sessionFor(role)', () => {
    const s = sessionFor('CASHIER');
    expect(s.user.role).toBe('CASHIER');
    expect(s.user.login).toBe('cashier');
    expect(sessionFor('RECEPTION', { clinicId: 'c2' }).user.clinicId).toBe('c2');
  });
});

describe('helpers: makeRequest / readJson', () => {
  it('nisbiy URL, JSON body, X-Requested-With', async () => {
    const req = makeRequest('POST', '/api/visits', { patientId: 'p1' });
    expect(req.method).toBe('POST');
    expect(req.url).toBe(`${TEST_ORIGIN}/api/visits`);
    expect(req.headers.get('x-requested-with')).toBe('lor-crm');
    expect(req.headers.get('content-type')).toBe('application/json');
    await expect(req.json()).resolves.toEqual({ patientId: 'p1' });
  });

  it('GET: body yoʻq, query saqlanadi, qoʻshimcha sarlavha', () => {
    const req = makeRequest('GET', '/api/patients?search=ali&page=2', undefined, { 'x-forwarded-for': '10.0.0.1' });
    expect(req.nextUrl.searchParams.get('search')).toBe('ali');
    expect(req.nextUrl.searchParams.get('page')).toBe('2');
    expect(req.headers.get('x-forwarded-for')).toBe('10.0.0.1');
    expect(req.body).toBeNull();
  });

  it('absolyut URL va string body oʻzgarmaydi', async () => {
    const req = makeRequest('PUT', 'http://example.test/api/x', '{"a":1}');
    expect(req.url).toBe('http://example.test/api/x');
    await expect(req.text()).resolves.toBe('{"a":1}');
  });

  it('readJson / readData ok javobni oʻqiydi (Date → ISO string)', async () => {
    const res = ok({ id: 'v1', when: new Date('2026-09-15T10:00:00Z'), items: [1, 2] });
    const json = await readJson<{ id: string; when: string; items: number[] }>(res.clone());
    expect(json.ok).toBe(true);
    if (json.ok) expect(json.data.id).toBe('v1');
    const data = await readData<{ id: string; when: string; items: number[] }>(res);
    expect(data.when).toBe('2026-09-15T10:00:00.000Z');
    expect(data.items).toEqual([1, 2]);
    expect(res.status).toBe(200);
  });

  it('readError xato javobni oʻqiydi; readData xato javobda throw', async () => {
    const res = fail(403, 'FORBIDDEN', 'Ruxsat yoʻq');
    const e = await readError(res.clone());
    expect(e).toMatchObject({ status: 403, code: 'FORBIDDEN', message: 'Ruxsat yoʻq' });
    await expect(readData(res)).rejects.toThrow(/FORBIDDEN/);
  });

  it('readError ok javobda throw', async () => {
    await expect(readError(NextResponse.json({ ok: true, data: 1 }))).rejects.toThrow(/ok=true/);
  });
});
