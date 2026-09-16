import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import { ok, serialize } from '@/lib/api/respond';
import { readData } from '../helpers/request';

/**
 * CONTRACTS §2: API JSON da pul — butun number. `serialize()` Prisma.Decimal → number.
 * Regressiya: JSON.stringify replacer ga qiymat `Decimal.toJSON()` dan keyin (string) keladi,
 * shuning uchun xom qiymat holder (`this[key]`) orqali olinishi kerak.
 */
describe('api/respond serialize()', () => {
  it('Prisma.Decimal pul → butun number (string emas)', () => {
    const out = serialize({ totalNet: new Prisma.Decimal('180000.00'), paid: new Prisma.Decimal('0') });
    expect(out.totalNet).toBe(180000);
    expect(typeof out.totalNet).toBe('number');
    expect(out.paid).toBe(0);
  });

  it('decimal.js qiymatlari ham number boʻladi', () => {
    const out = serialize({ gross: new Decimal('120000') });
    expect(out.gross).toBe(120000);
  });

  it('quantity 1.5 va foiz 12.5 yaxlitlanmaydi', () => {
    const out = serialize({
      quantity: new Prisma.Decimal('1.5'),
      discountValue: new Prisma.Decimal('12.50'),
      unitPrice: new Prisma.Decimal('120000.00'),
    });
    expect(out.quantity).toBe(1.5);
    expect(out.discountValue).toBe(12.5);
    expect(out.unitPrice).toBe(120000);
  });

  it('ichki obyekt/massiv, Date, BigInt, null', () => {
    const d = new Date('2026-01-01T00:00:00.000Z');
    const out = serialize({
      lines: [{ lineTotal: new Prisma.Decimal('50000.00') }, { lineTotal: new Prisma.Decimal('25000') }],
      nested: { deep: { amount: new Prisma.Decimal('-15000.00') } },
      createdAt: d,
      big: 10n,
      none: null,
      text: 'Bemor',
    });
    expect(out.lines.map((l) => l.lineTotal)).toEqual([50000, 25000]);
    expect(out.nested.deep.amount).toBe(-15000);
    expect(out.createdAt).toBe(d.toISOString());
    expect(out.big).toBe(10);
    expect(out.none).toBeNull();
    expect(out.text).toBe('Bemor');
  });

  it('ildiz qiymatning oʻzi Decimal boʻlsa ham number', () => {
    expect(serialize(new Prisma.Decimal('99.00'))).toBe(99);
    expect(serialize([new Prisma.Decimal('1'), new Prisma.Decimal('2.5')])).toEqual([1, 2.5]);
  });

  it('ok() javobida pul number boʻlib keladi', async () => {
    const res = ok({
      totalNet: new Prisma.Decimal('180000.00'),
      lines: [{ quantity: new Prisma.Decimal('1.5') }],
    });
    const data = await readData<{ totalNet: number; lines: { quantity: number }[] }>(res);
    expect(data.totalNet).toBe(180000);
    expect(data.lines[0]?.quantity).toBe(1.5);
  });
});
