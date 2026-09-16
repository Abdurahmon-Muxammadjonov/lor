import { describe, expect, it } from 'vitest';
import { D } from '@/lib/money';
import { applyBulkRule, computeBulkPrice, pricesDiffer, pricesToNumbers } from '@/lib/services/pricing';
import {
  BulkSchema,
  CategorySchema,
  CategoryUpdateSchema,
  ReorderSchema,
  SERVICE_CODE_RE,
  ServiceSchema,
  ServiceUpdateSchema,
  ServicesQuerySchema,
} from '@/lib/services/schemas';
import { services as servicesMessages } from '@/i18n/messages/services';

// ───────────────────────── Ommaviy narx matematikasi ─────────────────────────

describe('computeBulkPrice', () => {
  it('PERCENT +10 on 120 000 (round 100) → 132 000', () => {
    expect(computeBulkPrice(120_000, { mode: 'PERCENT', value: 10, roundTo: 100 }).toNumber()).toBe(132_000);
  });

  it('PERCENT −10 on 120 000 → 108 000; +15 on 123 456 round 1000 → 142 000', () => {
    expect(computeBulkPrice(120_000, { mode: 'PERCENT', value: -10, roundTo: 100 }).toNumber()).toBe(108_000);
    // 123 456 × 1.15 = 141 974.4 → 142 000
    expect(computeBulkPrice(123_456, { mode: 'PERCENT', value: 15, roundTo: 1000 }).toNumber()).toBe(142_000);
  });

  it('PERCENT rounding to 100: 33 333 × 1.1 = 36 666.3 → 36 700', () => {
    expect(computeBulkPrice(33_333, { mode: 'PERCENT', value: 10, roundTo: 100 }).toNumber()).toBe(36_700);
  });

  it('FIXED −5000 on 120 000 → 115 000; FIXED +2 550 round 100 → 122 600', () => {
    expect(computeBulkPrice(120_000, { mode: 'FIXED', value: -5000, roundTo: 100 }).toNumber()).toBe(115_000);
    expect(computeBulkPrice(120_000, { mode: 'FIXED', value: 2_550, roundTo: 100 }).toNumber()).toBe(122_600);
  });

  it('SET 99 000 → 99 000 regardless of current; SET 99 500 round 1000 → 100 000', () => {
    expect(computeBulkPrice(120_000, { mode: 'SET', value: 99_000, roundTo: 100 }).toNumber()).toBe(99_000);
    expect(computeBulkPrice(5, { mode: 'SET', value: 99_500, roundTo: 1000 }).toNumber()).toBe(100_000);
  });

  it('never goes negative: FIXED −200 000 on 120 000 → 0; PERCENT −100 → 0', () => {
    expect(computeBulkPrice(120_000, { mode: 'FIXED', value: -200_000, roundTo: 100 }).toNumber()).toBe(0);
    expect(computeBulkPrice(120_000, { mode: 'PERCENT', value: -100, roundTo: 100 }).toNumber()).toBe(0);
  });

  it('accepts Decimal / string inputs (Prisma Decimal koʻrinishi)', () => {
    expect(computeBulkPrice('120000.00', { mode: 'PERCENT', value: D(10), roundTo: 100 }).toNumber()).toBe(132_000);
    expect(computeBulkPrice(D('120000'), { mode: 'FIXED', value: '-5000', roundTo: 100 }).toNumber()).toBe(115_000);
  });

  it('uses Decimal arithmetic — no float drift (0.1 + 0.2 style)', () => {
    // 1 000 000 × 1.07 = 1 070 000 aniq (floatda 1069999.9999…)
    expect(computeBulkPrice(1_000_000, { mode: 'PERCENT', value: 7, roundTo: 100 }).toNumber()).toBe(1_070_000);
    expect(computeBulkPrice(3, { mode: 'PERCENT', value: 10, roundTo: 1 }).toNumber()).toBe(3);
  });
});

describe('applyBulkRule', () => {
  const prices = { priceAdultNoMed: '120000', priceAdultMed: 150000, priceChildNoMed: D(90000), priceChildMed: '110000.00' };

  it('changes only selected fields and reports real changes', () => {
    const { next, changes } = applyBulkRule(prices, ['priceAdultNoMed', 'priceChildNoMed'], {
      mode: 'PERCENT',
      value: 10,
      roundTo: 100,
    });
    expect(next).toEqual({ priceAdultNoMed: 132_000, priceAdultMed: 150_000, priceChildNoMed: 99_000, priceChildMed: 110_000 });
    expect(changes).toEqual([
      { field: 'priceAdultNoMed', from: 120_000, to: 132_000 },
      { field: 'priceChildNoMed', from: 90_000, to: 99_000 },
    ]);
  });

  it('SET to the same value → no changes', () => {
    const { changes } = applyBulkRule(prices, ['priceAdultMed'], { mode: 'SET', value: 150_000, roundTo: 100 });
    expect(changes).toEqual([]);
  });

  it('all four fields with FIXED −5000', () => {
    const { next, changes } = applyBulkRule(
      prices,
      ['priceAdultNoMed', 'priceAdultMed', 'priceChildNoMed', 'priceChildMed'],
      { mode: 'FIXED', value: -5000, roundTo: 100 },
    );
    expect(next).toEqual({ priceAdultNoMed: 115_000, priceAdultMed: 145_000, priceChildNoMed: 85_000, priceChildMed: 105_000 });
    expect(changes).toHaveLength(4);
  });

  it('pricesToNumbers / pricesDiffer', () => {
    expect(pricesToNumbers(prices)).toEqual({ priceAdultNoMed: 120_000, priceAdultMed: 150_000, priceChildNoMed: 90_000, priceChildMed: 110_000 });
    expect(pricesDiffer(prices, { ...prices, priceChildMed: 110_000 })).toBe(false);
    expect(pricesDiffer(prices, { ...prices, priceChildMed: 111_000 })).toBe(true);
  });
});

// ───────────────────────── Sxemalar ─────────────────────────

const validService = {
  categoryId: 'cat_1',
  code: 'n-001',
  name: 'Burun yuvish',
  nameRu: 'Промывание носа',
  unit: 'seans',
  priceAdultNoMed: '120 000',
  priceAdultMed: 150000,
  priceChildNoMed: 90000,
  priceChildMed: 110000,
  allowHalf: true,
  medicineOptional: true,
  durationMin: '20',
  defaultOrgan: 'NOSE',
};

describe('ServiceSchema', () => {
  it('parses a valid service (code uppercased, money → int, duration coerced)', () => {
    const r = ServiceSchema.safeParse(validService);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.code).toBe('N-001');
    expect(r.data.priceAdultNoMed).toBe(120_000);
    expect(r.data.durationMin).toBe(20);
    expect(r.data.isActive).toBe(true);
    expect(r.data.defaultOrgan).toBe('NOSE');
  });

  it('code regex: [A-Z]{1,3}-\\d{3}', () => {
    expect(SERVICE_CODE_RE.test('N-001')).toBe(true);
    expect(SERVICE_CODE_RE.test('LAB-999')).toBe(true);
    expect(SERVICE_CODE_RE.test('ABCD-001')).toBe(false);
    expect(SERVICE_CODE_RE.test('N-01')).toBe(false);
    expect(SERVICE_CODE_RE.test('N001')).toBe(false);
    for (const code of ['N01', 'ABCD-001', 'n-0001', '1-001', '']) {
      const r = ServiceSchema.safeParse({ ...validService, code });
      expect(r.success, code).toBe(false);
    }
  });

  it('rejects bad unit, negative / fractional price, duration out of 5–300', () => {
    expect(ServiceSchema.safeParse({ ...validService, unit: 'litr' }).success).toBe(false);
    expect(ServiceSchema.safeParse({ ...validService, priceAdultMed: -1 }).success).toBe(false);
    expect(ServiceSchema.safeParse({ ...validService, priceAdultMed: 1000.5 }).success).toBe(false);
    expect(ServiceSchema.safeParse({ ...validService, durationMin: 4 }).success).toBe(false);
    expect(ServiceSchema.safeParse({ ...validService, durationMin: 301 }).success).toBe(false);
    expect(ServiceSchema.safeParse({ ...validService, durationMin: 300 }).success).toBe(true);
    expect(ServiceSchema.safeParse({ ...validService, defaultOrgan: 'HAND' }).success).toBe(false);
    expect(ServiceSchema.safeParse({ ...validService, name: 'A' }).success).toBe(false);
  });

  it('defaults: unit ta, allowHalf/medicineOptional/isActive true, durationMin 20', () => {
    const { unit: _u, allowHalf: _a, medicineOptional: _m, durationMin: _d, ...rest } = validService;
    const r = ServiceSchema.safeParse(rest);
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.unit).toBe('ta');
    expect(r.data.allowHalf).toBe(true);
    expect(r.data.medicineOptional).toBe(true);
    expect(r.data.durationMin).toBe(20);
  });

  it('strips HTML from names (sanitizeText)', () => {
    const r = ServiceSchema.safeParse({ ...validService, name: 'Burun <b>yuvish</b>' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.name).toBe('Burun yuvish');
  });

  it('ServiceUpdateSchema: partial ok, empty object rejected', () => {
    expect(ServiceUpdateSchema.safeParse({ priceAdultNoMed: 130000 }).success).toBe(true);
    expect(ServiceUpdateSchema.safeParse({ isActive: false }).success).toBe(true);
    expect(ServiceUpdateSchema.safeParse({}).success).toBe(false);
    expect(ServiceUpdateSchema.safeParse({ code: 'bad' }).success).toBe(false);
  });
});

describe('BulkSchema', () => {
  it('PERCENT +10 all fields, roundTo default 100, preview default false', () => {
    const r = BulkSchema.safeParse({ mode: 'PERCENT', value: 10, fields: ['priceAdultNoMed', 'priceAdultMed', 'priceChildNoMed', 'priceChildMed'] });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.roundTo).toBe(100);
    expect(r.data.preview).toBe(false);
    expect(r.data.categoryId).toBeUndefined();
  });

  it('accepts negative FIXED, SET ≥ 0, roundTo 1000, preview true, scope by category / ids', () => {
    expect(BulkSchema.safeParse({ mode: 'FIXED', value: '-5 000', fields: ['priceAdultMed'], roundTo: 1000, preview: true, categoryId: 'c1' }).success).toBe(true);
    expect(BulkSchema.safeParse({ mode: 'SET', value: 0, fields: ['priceAdultMed'], serviceIds: ['a', 'b'] }).success).toBe(true);
  });

  it('rejects: SET negative, PERCENT out of −100..1000, zero for PERCENT/FIXED, empty/duplicate fields, roundTo 50', () => {
    expect(BulkSchema.safeParse({ mode: 'SET', value: -1, fields: ['priceAdultMed'] }).success).toBe(false);
    expect(BulkSchema.safeParse({ mode: 'PERCENT', value: -101, fields: ['priceAdultMed'] }).success).toBe(false);
    expect(BulkSchema.safeParse({ mode: 'PERCENT', value: 1001, fields: ['priceAdultMed'] }).success).toBe(false);
    expect(BulkSchema.safeParse({ mode: 'PERCENT', value: 0, fields: ['priceAdultMed'] }).success).toBe(false);
    expect(BulkSchema.safeParse({ mode: 'FIXED', value: 0, fields: ['priceAdultMed'] }).success).toBe(false);
    expect(BulkSchema.safeParse({ mode: 'FIXED', value: 100, fields: [] }).success).toBe(false);
    expect(BulkSchema.safeParse({ mode: 'FIXED', value: 100, fields: ['priceAdultMed', 'priceAdultMed'] }).success).toBe(false);
    expect(BulkSchema.safeParse({ mode: 'FIXED', value: 100, fields: ['priceAdultMed'], roundTo: 50 }).success).toBe(false);
    expect(BulkSchema.safeParse({ mode: 'FIXED', value: 100, fields: ['unknown'] }).success).toBe(false);
    expect(BulkSchema.safeParse({ mode: 'DOUBLE', value: 100, fields: ['priceAdultMed'] }).success).toBe(false);
  });
});

describe('CategorySchema / ReorderSchema / ServicesQuerySchema', () => {
  it('category: names required, icon from the list, order default 0', () => {
    const r = CategorySchema.safeParse({ name: 'Burun', nameRu: 'Нос', icon: 'wind' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.order).toBe(0);
    expect(CategorySchema.safeParse({ name: 'Burun', nameRu: 'Нос', icon: 'rocket' }).success).toBe(false);
    expect(CategorySchema.safeParse({ name: 'B', nameRu: 'Нос' }).success).toBe(false);
    expect(CategoryUpdateSchema.safeParse({}).success).toBe(false);
    expect(CategoryUpdateSchema.safeParse({ icon: null }).success).toBe(true);
  });

  it('reorder: ids non-empty', () => {
    expect(ReorderSchema.safeParse({ ids: ['a', 'b'] }).success).toBe(true);
    expect(ReorderSchema.safeParse({ ids: [] }).success).toBe(false);
  });

  it('query: all=1/true → true, otherwise false', () => {
    expect(ServicesQuerySchema.parse({ all: '1' }).all).toBe(true);
    expect(ServicesQuerySchema.parse({ all: 'true' }).all).toBe(true);
    expect(ServicesQuerySchema.parse({ all: '0' }).all).toBe(false);
    expect(ServicesQuerySchema.parse({}).all).toBe(false);
    expect(ServicesQuerySchema.parse({ categoryId: 'c1', q: ' burun ' }).q).toBe('burun');
  });
});

// ───────────────────────── i18n ─────────────────────────

function leafKeys(tree: Record<string, unknown>, prefix = ''): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') out.push(...leafKeys(v as Record<string, unknown>, key));
    else out.push(key);
  }
  return out.sort();
}

describe('services i18n', () => {
  it('uz and ru have identical key shapes and no straight apostrophes in uz', () => {
    const uz = leafKeys(servicesMessages.uz as unknown as Record<string, unknown>);
    const ru = leafKeys(servicesMessages.ru as unknown as Record<string, unknown>);
    expect(ru).toEqual(uz);
    expect(uz.length).toBeGreaterThan(100);
    const bad = uz.filter((k) => {
      const v = k.split('.').reduce<unknown>((acc, p) => (acc as Record<string, unknown>)[p], servicesMessages.uz);
      return typeof v === 'string' && /'/.test(v);
    });
    expect(bad).toEqual([]);
  });
});
