import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Route handler prisma ni faqat audit uchun ishlatadi — mock (DB kerak emas)
const auditCreate = vi.fn().mockResolvedValue({});
vi.mock('@/lib/prisma', () => ({
  prisma: { auditLog: { create: (...args: unknown[]) => auditCreate(...args) } },
}));
vi.mock('next-auth', () => ({ getServerSession: vi.fn() }));

import { getMessages } from '@/i18n/messages';
import { makeT } from '@/i18n/t';
import { calcLine, calcVisit } from '@/lib/calc';
import { LeadSchema } from '@/components/landing/lead-schema';
import {
  buildDefaultDemoLines,
  buildDemoLine,
  computeDemoLine,
  computeDemoTotals,
  DemoCalcError,
  isDiscountValid,
  parseDiscountInput,
  tryComputeDemoLine,
} from '@/components/landing/demo-calc';
import { renderTemplate } from '@/components/landing/template';
import { DEMO_CATEGORIES, DEMO_SERVICES, findDemoService, groupDemoServices } from '@/data/demo-services';
import {
  CLINIC_WORDMARKS,
  FAQ,
  FEATURES,
  PRICING_TIERS,
  PRIVACY_POLICY,
  STATS,
  TERMS_OF_SERVICE,
  yearlyPerMonth,
  yearlyPrice,
  type L,
} from '@/data/landing-content';
import { landing } from '@/i18n/messages/landing';
import { createRateLimiter, getLeadLimiter, LEAD_RATE_LIMIT } from '@/app/api/public/_lib/rate-limit';
import {
  escapeTelegramHtml,
  formatLeadMessage,
  isTelegramConfigured,
  notifyTelegramAdmin,
} from '@/app/api/public/_lib/telegram';
import { POST as leadPost } from '@/app/api/public/lead/route';
import sitemap from '@/app/sitemap';
import { makeRequest, readError, readJson } from './helpers/request';

/* ─────────────────────────── Demo xizmatlar ─────────────────────────── */

describe('demo-services', () => {
  it('8 ta xizmat, narx invariantlari: butun ming, bola < katta, dori ≥ dorisiz', () => {
    expect(DEMO_SERVICES).toHaveLength(8);
    for (const s of DEMO_SERVICES) {
      for (const p of [s.priceAdultNoMed, s.priceAdultMed, s.priceChildNoMed, s.priceChildMed]) {
        expect(p % 1000).toBe(0);
        expect(p).toBeGreaterThan(0);
      }
      expect(s.priceChildNoMed).toBeLessThan(s.priceAdultNoMed);
      expect(s.priceChildMed).toBeLessThan(s.priceAdultMed);
      expect(s.priceAdultMed).toBeGreaterThanOrEqual(s.priceAdultNoMed);
      expect(s.name.length).toBeGreaterThan(3);
      expect(s.nameRu.length).toBeGreaterThan(3);
      expect(s.name).not.toMatch(/'/);
    }
    const codes = new Set(DEMO_SERVICES.map((s) => s.code));
    expect(codes.size).toBe(DEMO_SERVICES.length);
  });

  it('allowHalf va medicineOptional ikkala holat ham mavjud (UI hintlari uchun)', () => {
    expect(DEMO_SERVICES.some((s) => !s.allowHalf)).toBe(true);
    expect(DEMO_SERVICES.some((s) => !s.medicineOptional)).toBe(true);
    expect(findDemoService('N-001')?.allowHalf).toBe(true);
    expect(findDemoService('nope')).toBeUndefined();
  });

  it('kategoriya boʻyicha guruhlash boʻsh guruhlarsiz', () => {
    const groups = groupDemoServices();
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.length).toBeLessThanOrEqual(DEMO_CATEGORIES.length);
    expect(groups.flatMap((g) => g.services)).toHaveLength(DEMO_SERVICES.length);
    for (const g of groups) expect(g.services.every((s) => s.category === g.category.key)).toBe(true);
  });
});

/* ─────────────────────────── Demo kalkulyator ─────────────────────────── */

describe('demo-calc (calcLine/calcVisit bilan bir xil)', () => {
  it('qabul mezoni №1: 1.5 × 120 000 = 180 000', () => {
    const r = computeDemoLine({
      serviceCode: 'N-001',
      patientType: 'ADULT',
      withMedicine: false,
      quantity: 1.5,
      discountType: 'NONE',
      discountValue: 0,
    });
    expect(r.unitPrice).toBe(120_000);
    expect(r.gross).toBe(180_000);
    expect(r.net).toBe(180_000);
    expect(r.quantity).toBe(1.5);
    expect(r.effectiveWithMedicine).toBe(false);
  });

  it('bemor turi / dori oʻzgarganda narx darhol oʻzgaradi', () => {
    const base = { serviceCode: 'N-001', quantity: 1, discountType: 'NONE' as const, discountValue: 0 };
    expect(computeDemoLine({ ...base, patientType: 'ADULT', withMedicine: true }).unitPrice).toBe(150_000);
    expect(computeDemoLine({ ...base, patientType: 'CHILD', withMedicine: false }).unitPrice).toBe(90_000);
    expect(computeDemoLine({ ...base, patientType: 'CHILD', withMedicine: true }).unitPrice).toBe(110_000);
  });

  it('medicineOptional=false → doim "dori bilan" narx', () => {
    const r = computeDemoLine({
      serviceCode: 'N-005',
      patientType: 'ADULT',
      withMedicine: false,
      quantity: 1,
      discountType: 'NONE',
      discountValue: 0,
    });
    expect(r.unitPrice).toBe(60_000);
    expect(r.effectiveWithMedicine).toBe(true);
  });

  it('allowHalf=false → 0.5 rad etiladi (HALF_NOT_ALLOWED)', () => {
    expect(() =>
      computeDemoLine({
        serviceCode: 'D-001',
        patientType: 'ADULT',
        withMedicine: false,
        quantity: 1.5,
        discountType: 'NONE',
        discountValue: 0,
      }),
    ).toThrowError(DemoCalcError);
    try {
      computeDemoLine({
        serviceCode: 'D-001',
        patientType: 'ADULT',
        withMedicine: false,
        quantity: 1.5,
        discountType: 'NONE',
        discountValue: 0,
      });
    } catch (e) {
      expect((e as DemoCalcError).code).toBe('HALF_NOT_ALLOWED');
    }
    expect(
      tryComputeDemoLine({
        serviceCode: 'D-001',
        patientType: 'ADULT',
        withMedicine: false,
        quantity: 1.5,
        discountType: 'NONE',
        discountValue: 0,
      }),
    ).toBeNull();
    expect(
      tryComputeDemoLine({
        serviceCode: 'missing',
        patientType: 'ADULT',
        withMedicine: false,
        quantity: 1,
        discountType: 'NONE',
        discountValue: 0,
      }),
    ).toBeNull();
  });

  it('chegirma foizda va soʻmda', () => {
    const pct = computeDemoLine({
      serviceCode: 'F-002',
      patientType: 'ADULT',
      withMedicine: false,
      quantity: 5,
      discountType: 'PERCENT',
      discountValue: 10,
    });
    expect(pct.gross).toBe(250_000);
    expect(pct.discount).toBe(25_000);
    expect(pct.net).toBe(225_000);
    const fixed = computeDemoLine({
      serviceCode: 'F-002',
      patientType: 'ADULT',
      withMedicine: false,
      quantity: 5,
      discountType: 'FIXED',
      discountValue: 30_000,
    });
    expect(fixed.net).toBe(220_000);
    const over = computeDemoLine({
      serviceCode: 'F-002',
      patientType: 'ADULT',
      withMedicine: false,
      quantity: 1,
      discountType: 'FIXED',
      discountValue: 999_999,
    });
    expect(over.net).toBe(0);
    expect(() =>
      computeDemoLine({
        serviceCode: 'F-002',
        patientType: 'ADULT',
        withMedicine: false,
        quantity: 1,
        discountType: 'PERCENT',
        discountValue: 101,
      }),
    ).toThrowError(DemoCalcError);
  });

  it('5 xil qator alohida hisoblanadi, jami calcVisit bilan mos (100 soʻmgacha yaxlitlash)', () => {
    const lines = buildDefaultDemoLines();
    expect(lines).toHaveLength(5);
    expect(new Set(lines.map((l) => l.serviceCode)).size).toBe(5);
    expect(new Set(lines.map((l) => l.id)).size).toBe(5);
    const expectedNets = lines.map((l) => {
      const s = findDemoService(l.serviceCode);
      if (!s) throw new Error('service');
      return calcLine(
        {
          patientType: l.patientType,
          withMedicine: l.withMedicine,
          quantity: l.quantity,
          discountType: l.discountType,
          discountValue: l.discountValue,
        },
        s,
      ).net.toNumber();
    });
    expect(lines.map((l) => l.result.net)).toEqual(expectedNets);
    const totals = computeDemoTotals(lines);
    const ref = calcVisit(expectedNets, { type: 'NONE', value: 0 }, [], 100);
    expect(totals.subtotal).toBe(ref.subtotal.toNumber());
    expect(totals.total).toBe(ref.total.toNumber());
    expect(totals.total % 100).toBe(0);
    expect(totals.rounding).toBe(totals.total - totals.totalRaw);
    expect(totals.linesCount).toBe(5);
    // 180 000 + 80 000 + 60 000 + 120 000 + 225 000
    expect(totals.total).toBe(665_000);
  });

  it('yaxlitlash: 100 soʻmgacha (162 350 → 162 400)', () => {
    const line = buildDemoLine({
      serviceCode: 'E-003',
      patientType: 'ADULT',
      withMedicine: true,
      quantity: 1,
      discountType: 'FIXED',
      discountValue: 12_650,
    });
    expect(line.result.net).toBe(37_350);
    const totals = computeDemoTotals([line]);
    expect(totals.totalRaw).toBe(37_350);
    expect(totals.total).toBe(37_400);
    expect(totals.rounding).toBe(50);
    expect(computeDemoTotals([]).total).toBe(0);
  });

  it('chegirma kiritishini tahlil qilish', () => {
    expect(parseDiscountInput('')).toBe(0);
    expect(parseDiscountInput(' 12,5 ')).toBe(12.5);
    expect(parseDiscountInput('10 000')).toBe(10_000);
    expect(Number.isNaN(parseDiscountInput('abc'))).toBe(true);
    expect(Number.isNaN(parseDiscountInput('-5'))).toBe(true);
    expect(isDiscountValid('PERCENT', 100)).toBe(true);
    expect(isDiscountValid('PERCENT', 100.5)).toBe(false);
    expect(isDiscountValid('FIXED', 100.5)).toBe(true);
    expect(isDiscountValid('FIXED', Number.NaN)).toBe(false);
    expect(isDiscountValid('NONE', -1)).toBe(false);
  });
});

/* ─────────────────────────── Shablon ─────────────────────────── */

describe('renderTemplate', () => {
  it('placeholderlarni almashtiradi, nomaʼlumlarni qoldiradi', () => {
    expect(
      renderTemplate('{clinic}: {name}, {date} {time}', {
        clinic: 'Shifo',
        name: 'Ali',
        date: '16.09.2026',
        time: '10:30',
      }),
    ).toBe('Shifo: Ali, 16.09.2026 10:30');
    expect(renderTemplate('{a} {b}', { a: 1 })).toBe('1 {b}');
  });
});

/* ─────────────────────────── Lead sxemasi ─────────────────────────── */

describe('LeadSchema', () => {
  it('toʻgʻri soʻrov: telefon normallashadi, defaultlar toʻldiriladi', () => {
    const r = LeadSchema.safeParse({
      name: '  Dilnoza Karimova ',
      phone: '+998 90 123 45 67',
      clinic: 'Shifo LOR',
    });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.name).toBe('Dilnoza Karimova');
    expect(r.data.phone).toBe('+998901234567');
    expect(r.data.message).toBe('');
    expect(r.data.website).toBe('');
    expect(r.data.locale).toBe('uz');
    expect(r.data.source).toBe('landing');
  });

  it('xato xabarlari i18n kalitlari va ikki tilda mavjud', () => {
    const r = LeadSchema.safeParse({ name: 'A', phone: '12', clinic: '', message: 'x'.repeat(1001) });
    expect(r.success).toBe(false);
    if (r.success) return;
    const messages = r.error.issues.map((i) => i.message);
    expect(messages).toContain('landing.cta.form.errors.nameMin');
    expect(messages).toContain('landing.cta.form.errors.clinicMin');
    expect(messages).toContain('landing.cta.form.errors.messageMax');
    const tUz = makeT(getMessages(), 'uz');
    const tRu = makeT(getMessages(), 'ru');
    for (const key of [
      'landing.cta.form.errors.nameMin',
      'landing.cta.form.errors.clinicMin',
      'landing.cta.form.errors.messageMax',
      'landing.cta.form.errors.phone',
    ]) {
      expect(tUz(key)).not.toBe(key);
      expect(tRu(key)).not.toBe(key);
      expect(tUz(key)).not.toBe(tRu(key));
    }
  });

  it('honeypot qiymati saqlanib qoladi (server tekshiradi); locale faqat uz/ru', () => {
    const bot = LeadSchema.safeParse({
      name: 'Ali Valiyev',
      phone: '901234567',
      clinic: 'Shifo',
      website: 'http://spam',
    });
    expect(bot.success && bot.data.website).toBe('http://spam');
    expect(
      LeadSchema.safeParse({ name: 'Ali Valiyev', phone: '901234567', clinic: 'Shifo', locale: 'en' })
        .success,
    ).toBe(false);
    expect(LeadSchema.safeParse({ name: 'Ali Valiyev', phone: '901234567', clinic: 'X' }).success).toBe(
      false,
    );
    const ok = LeadSchema.safeParse({
      name: 'Ali Valiyev',
      phone: '901234567',
      clinic: 'Shifo',
      locale: 'ru',
    });
    expect(ok.success && ok.data.phone).toBe('901234567');
  });
});

/* ─────────────────────────── Rate limiter ─────────────────────────── */

describe('createRateLimiter', () => {
  it('oynada limitgacha ruxsat, keyin retryAfter bilan rad; oyna oʻtgach yana ruxsat', () => {
    let now = 1_000_000;
    const rl = createRateLimiter({ limit: 3, windowMs: 10_000, now: () => now });
    expect(rl.check('a').allowed).toBe(true);
    expect(rl.check('a').allowed).toBe(true);
    expect(rl.check('a')).toMatchObject({ allowed: true, remaining: 0 });
    const denied = rl.check('a');
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterSec).toBeGreaterThanOrEqual(1);
    expect(denied.retryAfterSec).toBeLessThanOrEqual(10);
    expect(rl.check('b').allowed).toBe(true);
    now += 10_001;
    expect(rl.check('a').allowed).toBe(true);
    rl.reset('a');
    expect(rl.size()).toBe(1);
    rl.reset();
    expect(rl.size()).toBe(0);
  });

  it('lead limiti: 5 / 10 daqiqa, global bitta instansiya', () => {
    expect(LEAD_RATE_LIMIT).toEqual({ limit: 5, windowMs: 600_000 });
    expect(getLeadLimiter()).toBe(getLeadLimiter());
  });
});

/* ─────────────────────────── Telegram ─────────────────────────── */

describe('telegram helper', () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
    vi.unstubAllGlobals();
  });

  it('HTML belgilarini qochiradi va xabarni formatlaydi', () => {
    expect(escapeTelegramHtml('<b>&</b>')).toBe('&lt;b&gt;&amp;&lt;/b&gt;');
    const msg = formatLeadMessage(
      {
        name: 'Ali <script>',
        phone: '+998901234567',
        clinic: 'Shifo & Co',
        message: 'Salom',
        locale: 'uz',
        source: 'landing',
        website: '',
      },
      { ip: '1.2.3.4', receivedAt: new Date('2026-09-15T05:00:00Z') },
    );
    expect(msg).toContain('Ali &lt;script&gt;');
    expect(msg).toContain('+998 90 123 45 67');
    expect(msg).toContain('Shifo &amp; Co');
    expect(msg).toContain('Salom');
    expect(msg).toContain('IP 1.2.3.4');
    expect(msg).toContain('UZ · landing');
  });

  it('env boʻlmasa yubormaydi; env boʻlsa api.telegram.org ga POST qiladi', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_ADMIN_CHAT_ID;
    expect(isTelegramConfigured()).toBe(false);
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    expect(await notifyTelegramAdmin('x')).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();

    process.env.TELEGRAM_BOT_TOKEN = 'token123';
    process.env.TELEGRAM_ADMIN_CHAT_ID = '42';
    expect(isTelegramConfigured()).toBe(true);
    expect(await notifyTelegramAdmin('hello')).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.telegram.org/bottoken123/sendMessage');
    expect(JSON.parse(String(init.body))).toMatchObject({ chat_id: '42', text: 'hello', parse_mode: 'HTML' });

    fetchMock.mockRejectedValueOnce(new Error('network'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await notifyTelegramAdmin('again')).toBe(false);
    spy.mockRestore();
  });
});

/* ─────────────────────────── POST /api/public/lead ─────────────────────────── */

describe('POST /api/public/lead', () => {
  const env = { ...process.env };
  beforeEach(() => {
    auditCreate.mockClear();
    getLeadLimiter().reset();
    delete process.env.TELEGRAM_BOT_TOKEN;
    delete process.env.TELEGRAM_ADMIN_CHAT_ID;
  });
  afterEach(() => {
    process.env = { ...env };
  });

  const valid = {
    name: 'Dilnoza Karimova',
    phone: '+998 90 123 45 67',
    clinic: 'Shifo LOR',
    message: 'Ertaga qoʻngʻiroq qiling',
    locale: 'ru',
  };

  it('toʻgʻri soʻrov → 201, AuditLog {CREATE, Lead}', async () => {
    const res = await leadPost(
      makeRequest('POST', '/api/public/lead', valid, { 'x-forwarded-for': '10.0.0.1' }),
    );
    expect(res.status).toBe(201);
    const json = await readJson<{ received: boolean; forwarded: boolean }>(res);
    expect(json.ok && json.data).toEqual({ received: true, forwarded: false });
    expect(auditCreate).toHaveBeenCalledTimes(1);
    const arg = auditCreate.mock.calls[0]?.[0] as {
      data: { action: string; entity: string; clinicId: unknown; after: Record<string, unknown>; ip: string };
    };
    expect(arg.data.action).toBe('CREATE');
    expect(arg.data.entity).toBe('Lead');
    expect(arg.data.clinicId).toBeNull();
    expect(arg.data.ip).toBe('10.0.0.1');
    expect(arg.data.after).toMatchObject({
      name: 'Dilnoza Karimova',
      phone: '+998901234567',
      clinic: 'Shifo LOR',
      locale: 'ru',
      source: 'landing',
    });
  });

  it('validatsiya xatosi → 400 VALIDATION, saqlanmaydi', async () => {
    const res = await leadPost(
      makeRequest(
        'POST',
        '/api/public/lead',
        { name: 'A', phone: 'x', clinic: '' },
        { 'x-forwarded-for': '10.0.0.2' },
      ),
    );
    const err = await readError(res);
    expect(err.status).toBe(400);
    expect(err.code).toBe('VALIDATION');
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it('honeypot → 200 "muvaffaqiyat", lekin hech narsa saqlanmaydi', async () => {
    const res = await leadPost(
      makeRequest(
        'POST',
        '/api/public/lead',
        { ...valid, website: 'http://spam.example' },
        { 'x-forwarded-for': '10.0.0.3' },
      ),
    );
    expect(res.status).toBe(200);
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it('bitta IP dan 6-soʻrov → 429 RATE_LIMITED', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await leadPost(
        makeRequest('POST', '/api/public/lead', valid, { 'x-forwarded-for': '10.0.0.4' }),
      );
      expect(res.status).toBe(201);
    }
    const res = await leadPost(
      makeRequest('POST', '/api/public/lead', valid, { 'x-forwarded-for': '10.0.0.4' }),
    );
    const err = await readError(res);
    expect(err.status).toBe(429);
    expect(err.code).toBe('RATE_LIMITED');
    const other = await leadPost(
      makeRequest('POST', '/api/public/lead', valid, { 'x-forwarded-for': '10.0.0.5' }),
    );
    expect(other.status).toBe(201);
  });

  it('Telegram sozlangan boʻlsa forwarded=true', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 't';
    process.env.TELEGRAM_ADMIN_CHAT_ID = '1';
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const res = await leadPost(
      makeRequest('POST', '/api/public/lead', valid, { 'x-forwarded-for': '10.0.0.6' }),
    );
    const json = await readJson<{ received: boolean; forwarded: boolean }>(res);
    expect(json.ok && json.data.forwarded).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});

/* ─────────────────────────── Kontent (ikki til) ─────────────────────────── */

const APOSTROPHE_OK = /^[^']*$/; // toʻgʻri apostrof ʻ/ʼ, oddiy ' yoʻq

function expectBilingual(v: L, min = 2) {
  expect(v.uz.trim().length).toBeGreaterThanOrEqual(min);
  expect(v.ru.trim().length).toBeGreaterThanOrEqual(min);
  expect(v.uz).toMatch(APOSTROPHE_OK);
  expect(v.uz).not.toMatch(/lorem|TODO|placeholder/i);
  expect(v.ru).not.toMatch(/lorem|TODO|placeholder/i);
}

describe('landing-content', () => {
  it('tariflar: 3 ta, narxlar spec boʻyicha, yillik −20% ming soʻmgacha', () => {
    expect(PRICING_TIERS.map((p) => p.monthly)).toEqual([490_000, 990_000, 1_990_000]);
    expect(PRICING_TIERS.filter((p) => p.popular).map((p) => p.key)).toEqual(['pro']);
    expect(yearlyPrice(490_000)).toBe(4_704_000);
    expect(yearlyPerMonth(490_000)).toBe(392_000);
    expect(yearlyPerMonth(990_000)).toBe(792_000);
    expect(yearlyPerMonth(1_990_000)).toBe(1_592_000);
    for (const tier of PRICING_TIERS) {
      expectBilingual(tier.name, 2);
      expectBilingual(tier.tagline);
      expect(tier.features.length).toBeGreaterThanOrEqual(6);
      tier.features.forEach((f) => expectBilingual(f));
    }
  });

  it('FAQ 8 ta savol, imkoniyatlar 7 ta, 10 ta klinika, 4 ta statistika', () => {
    expect(FAQ).toHaveLength(8);
    expect(new Set(FAQ.map((f) => f.id)).size).toBe(8);
    FAQ.forEach((f) => {
      expectBilingual(f.q, 10);
      expectBilingual(f.a, 80);
    });
    expect(FEATURES).toHaveLength(7);
    expect(new Set(FEATURES.map((f) => f.key)).size).toBe(7);
    FEATURES.forEach((f) => {
      expectBilingual(f.title);
      expectBilingual(f.description, 30);
    });
    expect(CLINIC_WORDMARKS).toHaveLength(10);
    expect(STATS.map((s) => s.key)).toEqual(['clinics', 'patients', 'tickets', 'hours']);
  });

  it('huquqiy hujjatlar ≈600 soʻz, 547-ЗРУ eslatiladi, boʻlim idlari unikal', () => {
    for (const doc of [PRIVACY_POLICY, TERMS_OF_SERVICE]) {
      const words = (l: 'uz' | 'ru') =>
        [
          doc.intro[l],
          ...doc.sections.flatMap((s) => [
            s.heading[l],
            ...s.paragraphs.map((p) => p[l]),
            ...(s.bullets ?? []).map((b) => b[l]),
          ]),
        ]
          .join(' ')
          .split(/\s+/)
          .filter(Boolean).length;
      expect(words('uz')).toBeGreaterThanOrEqual(500);
      expect(words('ru')).toBeGreaterThanOrEqual(500);
      expect(new Set(doc.sections.map((s) => s.id)).size).toBe(doc.sections.length);
      doc.sections.forEach((s) => {
        expectBilingual(s.heading);
        s.paragraphs.forEach((p) => expectBilingual(p, 20));
      });
    }
    expect(PRIVACY_POLICY.intro.uz).toContain('547');
    expect(PRIVACY_POLICY.intro.ru).toContain('547');
    expect(TERMS_OF_SERVICE.sections.some((s) => s.id === 'offer')).toBe(true);
  });

  it('landing lugʻati: uz/ru kalit shakli bir xil va apostroflar toʻgʻri', () => {
    const flat = (tree: Record<string, unknown>, prefix = ''): string[] =>
      Object.entries(tree).flatMap(([k, v]) =>
        typeof v === 'string' ? [`${prefix}${k}`] : flat(v as Record<string, unknown>, `${prefix}${k}.`),
      );
    expect(flat(landing.ru)).toEqual(flat(landing.uz));
    const uzText = JSON.stringify(landing.uz);
    expect(uzText).not.toMatch(/[^\\]'/);
    expect(uzText).toContain('ʻ');
    expect(uzText).toContain('ʼ');
  });
});

/* ─────────────────────────── Sitemap ─────────────────────────── */

describe('sitemap', () => {
  it('faqat ochiq sahifalar, APP_URL asosida', () => {
    const entries = sitemap();
    const urls = entries.map((e) => e.url);
    expect(urls[0]).toMatch(/^http:\/\/localhost:3000\/$/);
    expect(urls).toContain('http://localhost:3000/privacy');
    expect(urls).toContain('http://localhost:3000/terms');
    expect(urls.some((u) => u.includes('/dashboard') || u.includes('/api'))).toBe(false);
  });
});
