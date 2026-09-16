import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  calcLine,
  calcVisit,
  CalcError,
  validateQuantity,
  isValidQuantity,
  snapQuantity,
  quantityStep,
  formatQuantity,
  pickUnitPrice,
  validateDiscount,
  determinePatientType,
  ageAt,
  lineResultToJson,
  visitTotalsToJson,
  QUANTITY_MAX,
  type ServicePricing,
  type LineInput,
} from '@/lib/calc';
import { MoneyError } from '@/lib/money';

/** Standart xizmat: kattalar dori bilan 120 000, dorisiz 100 000; bolalar 90 000 / 75 000 */
const SERVICE: ServicePricing = {
  priceAdultNoMed: 100_000,
  priceAdultMed: 120_000,
  priceChildNoMed: 75_000,
  priceChildMed: 90_000,
  allowHalf: true,
  medicineOptional: true,
};

const line = (over: Partial<LineInput> = {}): LineInput => ({
  patientType: 'ADULT',
  withMedicine: true,
  quantity: 1,
  discountType: 'NONE',
  discountValue: 0,
  ...over,
});

const code = (fn: () => unknown): string | null => {
  try {
    fn();
    return null;
  } catch (e) {
    return e instanceof CalcError ? e.code : `OTHER:${String(e)}`;
  }
};

describe('calc: (1) miqdor × narx', () => {
  it('1.5 × 120 000 = 180 000', () => {
    const r = calcLine(line({ quantity: 1.5 }), SERVICE);
    expect(r.unitPrice.toString()).toBe('120000');
    expect(r.quantity.toString()).toBe('1.5');
    expect(r.gross.toString()).toBe('180000');
    expect(r.discount.toString()).toBe('0');
    expect(r.net.toString()).toBe('180000');
  });

  it('miqdor string / Decimal shaklida ham ishlaydi', () => {
    expect(calcLine(line({ quantity: '1.5' }), SERVICE).gross.toString()).toBe('180000');
    expect(calcLine(line({ quantity: new Decimal('2') }), SERVICE).gross.toString()).toBe('240000');
  });

  it('0.5 × 120 000 = 60 000; 99 × 120 000 = 11 880 000', () => {
    expect(calcLine(line({ quantity: 0.5 }), SERVICE).gross.toString()).toBe('60000');
    expect(calcLine(line({ quantity: 99 }), SERVICE).gross.toString()).toBe('11880000');
  });
});

describe('calc: (2) bemor turi narxni almashtiradi', () => {
  it('CHILD → bolalar narxi (dori bilan)', () => {
    const r = calcLine(line({ patientType: 'CHILD', quantity: 1.5 }), SERVICE);
    expect(r.unitPrice.toString()).toBe('90000');
    expect(r.gross.toString()).toBe('135000');
  });

  it('CHILD dorisiz → priceChildNoMed', () => {
    const r = calcLine(line({ patientType: 'CHILD', withMedicine: false }), SERVICE);
    expect(r.unitPrice.toString()).toBe('75000');
  });

  it('pickUnitPrice toʻrtala kombinatsiya', () => {
    expect(pickUnitPrice(SERVICE, 'ADULT', true).toString()).toBe('120000');
    expect(pickUnitPrice(SERVICE, 'ADULT', false).toString()).toBe('100000');
    expect(pickUnitPrice(SERVICE, 'CHILD', true).toString()).toBe('90000');
    expect(pickUnitPrice(SERVICE, 'CHILD', false).toString()).toBe('75000');
  });

  it('manfiy narx → NEGATIVE_PRICE', () => {
    expect(code(() => pickUnitPrice({ ...SERVICE, priceAdultMed: -1 }, 'ADULT', true))).toBe('NEGATIVE_PRICE');
  });
});

describe('calc: (3) dori bilan / dorisiz', () => {
  it('withMedicine=false → dorisiz narx', () => {
    const r = calcLine(line({ withMedicine: false, quantity: 2 }), SERVICE);
    expect(r.unitPrice.toString()).toBe('100000');
    expect(r.gross.toString()).toBe('200000');
  });

  it('medicineOptional=false → withMedicine=false boʻlsa ham dori bilan narx', () => {
    const forced: ServicePricing = { ...SERVICE, medicineOptional: false };
    expect(calcLine(line({ withMedicine: false }), forced).unitPrice.toString()).toBe('120000');
    expect(calcLine(line({ withMedicine: true }), forced).unitPrice.toString()).toBe('120000');
    expect(pickUnitPrice(forced, 'CHILD', false).toString()).toBe('90000');
  });
});

describe('calc: (4) miqdor validatsiyasi', () => {
  it('allowHalf=false + 0.5 → HALF_NOT_ALLOWED', () => {
    const whole: ServicePricing = { ...SERVICE, allowHalf: false };
    expect(code(() => calcLine(line({ quantity: 0.5 }), whole))).toBe('HALF_NOT_ALLOWED');
    expect(code(() => calcLine(line({ quantity: 1.5 }), whole))).toBe('HALF_NOT_ALLOWED');
    expect(code(() => validateQuantity(2.5, false))).toBe('HALF_NOT_ALLOWED');
  });

  it('allowHalf=false + butun → OK', () => {
    const whole: ServicePricing = { ...SERVICE, allowHalf: false };
    expect(calcLine(line({ quantity: 2 }), whole).gross.toString()).toBe('240000');
  });

  it('1.3 → INVALID_QUANTITY (allowHalf boʻlsa ham)', () => {
    expect(code(() => calcLine(line({ quantity: 1.3 }), SERVICE))).toBe('INVALID_QUANTITY');
    expect(code(() => validateQuantity(1.3, false))).toBe('INVALID_QUANTITY');
    expect(code(() => validateQuantity(0.25, true))).toBe('INVALID_QUANTITY');
  });

  it('0, manfiy, > 99 → INVALID_QUANTITY', () => {
    expect(code(() => calcLine(line({ quantity: 0 }), SERVICE))).toBe('INVALID_QUANTITY');
    expect(code(() => calcLine(line({ quantity: -1 }), SERVICE))).toBe('INVALID_QUANTITY');
    expect(code(() => calcLine(line({ quantity: -0.5 }), SERVICE))).toBe('INVALID_QUANTITY');
    expect(code(() => calcLine(line({ quantity: 100 }), SERVICE))).toBe('INVALID_QUANTITY');
    expect(code(() => calcLine(line({ quantity: 99.5 }), SERVICE))).toBe('INVALID_QUANTITY');
    expect(QUANTITY_MAX).toBe(99);
  });

  it('99 → OK; validateQuantity Decimal qaytaradi', () => {
    expect(validateQuantity(99, false).toString()).toBe('99');
    expect(validateQuantity('0.5', true).toString()).toBe('0.5');
    expect(validateQuantity(new Decimal(3), false).toString()).toBe('3');
  });

  it('CalcError nomi/kodi/xabari', () => {
    const e = new CalcError('HALF_NOT_ALLOWED');
    expect(e).toBeInstanceOf(Error);
    expect(e.name).toBe('CalcError');
    expect(e.code).toBe('HALF_NOT_ALLOWED');
    expect(e.message).toBe('HALF_NOT_ALLOWED');
    expect(new CalcError('INVALID_QUANTITY', 'x').message).toBe('x');
  });
});

describe('calc: (5) bir nechta qator jamlanadi', () => {
  it('5 xil qator → calcVisit.subtotal = qoʻlda hisoblangan yigʻindi', () => {
    const s1 = SERVICE; // 120000 med / 100000 nomed
    const s2: ServicePricing = { ...SERVICE, priceAdultMed: 45_000, priceAdultNoMed: 35_000, priceChildMed: 30_000, priceChildNoMed: 25_000 };
    const s3: ServicePricing = { ...SERVICE, priceAdultMed: 250_000, priceAdultNoMed: 200_000, allowHalf: false };
    const s4: ServicePricing = { ...SERVICE, priceAdultMed: 80_000, priceAdultNoMed: 60_000, medicineOptional: false };
    const s5: ServicePricing = { ...SERVICE, priceAdultMed: 15_000, priceAdultNoMed: 12_000 };

    const lines = [
      calcLine(line({ quantity: 1.5 }), s1), // 180 000
      calcLine(line({ patientType: 'CHILD', quantity: 2 }), s2), // 60 000
      calcLine(line({ quantity: 1, discountType: 'PERCENT', discountValue: 10 }), s3), // 250 000 − 25 000 = 225 000
      calcLine(line({ withMedicine: false, quantity: 3 }), s4), // dori majburiy: 3 × 80 000 = 240 000
      calcLine(line({ quantity: 0.5, discountType: 'FIXED', discountValue: 2_500 }), s5), // 7 500 − 2 500 = 5 000
    ];

    expect(lines.map((l) => l.net.toString())).toEqual(['180000', '60000', '225000', '240000', '5000']);

    const manual = 180_000 + 60_000 + 225_000 + 240_000 + 5_000; // 710 000
    const t = calcVisit(
      lines.map((l) => l.net),
      { type: 'NONE', value: 0 },
      [],
      100,
    );
    expect(t.subtotal.toString()).toBe(String(manual));
    expect(t.globalDiscount.toString()).toBe('0');
    expect(t.total.toString()).toBe('710000');
    expect(t.paid.toString()).toBe('0');
    expect(t.balance.toString()).toBe('710000');

    const grossSum = lines.reduce((s, l) => s.plus(l.gross), new Decimal(0));
    const discountSum = lines.reduce((s, l) => s.plus(l.discount), new Decimal(0));
    expect(grossSum.toString()).toBe(String(180_000 + 60_000 + 250_000 + 240_000 + 7_500));
    expect(discountSum.toString()).toBe(String(25_000 + 2_500));
    expect(grossSum.minus(discountSum).toString()).toBe(t.subtotal.toString());
  });

  it('calcVisit aralash kirishlar (number/string/Decimal)', () => {
    const t = calcVisit([100, '200', new Decimal(300)], undefined, undefined, 1);
    expect(t.subtotal.toString()).toBe('600');
    expect(t.total.toString()).toBe('600');
  });
});

describe('calc: (6) chegirmalar', () => {
  it('PERCENT 10 % → 180 000 dan 18 000 → 162 000', () => {
    const r = calcLine(line({ quantity: 1.5, discountType: 'PERCENT', discountValue: 10 }), SERVICE);
    expect(r.gross.toString()).toBe('180000');
    expect(r.discount.toString()).toBe('18000');
    expect(r.net.toString()).toBe('162000');
  });

  it('FIXED 25 000 → 180 000 dan 155 000', () => {
    const r = calcLine(line({ quantity: 1.5, discountType: 'FIXED', discountValue: 25_000 }), SERVICE);
    expect(r.discount.toString()).toBe('25000');
    expect(r.net.toString()).toBe('155000');
  });

  it('FIXED chegirma xom summadan oshmaydi (net 0)', () => {
    const r = calcLine(line({ quantity: 1, discountType: 'FIXED', discountValue: 999_999 }), SERVICE);
    expect(r.discount.toString()).toBe('120000');
    expect(r.net.toString()).toBe('0');
  });

  it('PERCENT 100 → net 0; PERCENT > 100 → INVALID_DISCOUNT', () => {
    const r = calcLine(line({ discountType: 'PERCENT', discountValue: 100 }), SERVICE);
    expect(r.discount.toString()).toBe('120000');
    expect(r.net.toString()).toBe('0');
    expect(code(() => calcLine(line({ discountType: 'PERCENT', discountValue: 101 }), SERVICE))).toBe('INVALID_DISCOUNT');
    expect(code(() => validateDiscount('PERCENT', 100.01))).toBe('INVALID_DISCOUNT');
  });

  it('manfiy chegirma → INVALID_DISCOUNT; NONE → qiymat eʼtiborsiz', () => {
    expect(code(() => calcLine(line({ discountType: 'FIXED', discountValue: -1 }), SERVICE))).toBe('INVALID_DISCOUNT');
    expect(code(() => calcLine(line({ discountType: 'PERCENT', discountValue: -5 }), SERVICE))).toBe('INVALID_DISCOUNT');
    expect(validateDiscount('NONE', 999).toString()).toBe('0');
    expect(calcLine(line({ discountType: 'NONE', discountValue: 50 }), SERVICE).discount.toString()).toBe('0');
  });

  it('foiz chegirma butun soʻmgacha yaxlitlanadi (half-up)', () => {
    // 100 000 × 0.5 = 50 000; 33 % = 16 500
    const r1 = calcLine(line({ withMedicine: false, quantity: 0.5, discountType: 'PERCENT', discountValue: 33 }), SERVICE);
    expect(r1.discount.toString()).toBe('16500');
    // 120 000 × 1 = 120 000; 12.5 % = 15 000
    const r2 = calcLine(line({ discountType: 'PERCENT', discountValue: 12.5 }), SERVICE);
    expect(r2.discount.toString()).toBe('15000');
    // 7 % dan 120 000 → 8 400
    const r3 = calcLine(line({ discountType: 'PERCENT', discountValue: 7 }), SERVICE);
    expect(r3.discount.toString()).toBe('8400');
    expect(r3.net.toString()).toBe('111600');
  });

  it('umumiy chegirma PERCENT: 710 000 dan 10 % → 71 000 → 639 000', () => {
    const t = calcVisit([180_000, 60_000, 225_000, 240_000, 5_000], { type: 'PERCENT', value: 10 }, [], 100);
    expect(t.subtotal.toString()).toBe('710000');
    expect(t.globalDiscount.toString()).toBe('71000');
    expect(t.totalRaw.toString()).toBe('639000');
    expect(t.total.toString()).toBe('639000');
  });

  it('umumiy chegirma FIXED: 50 000', () => {
    const t = calcVisit([180_000, 60_000], { type: 'FIXED', value: 50_000 }, [], 100);
    expect(t.globalDiscount.toString()).toBe('50000');
    expect(t.total.toString()).toBe('190000');
  });

  it('umumiy chegirma subtotal dan oshmaydi', () => {
    const t = calcVisit([100_000], { type: 'FIXED', value: 500_000 }, [], 100);
    expect(t.globalDiscount.toString()).toBe('100000');
    expect(t.totalRaw.toString()).toBe('0');
    expect(t.total.toString()).toBe('0');
  });

  it('umumiy chegirma PERCENT > 100 → INVALID_DISCOUNT', () => {
    expect(code(() => calcVisit([100_000], { type: 'PERCENT', value: 150 }))).toBe('INVALID_DISCOUNT');
  });

  it('qator chegirmasi + umumiy chegirma birgalikda', () => {
    const l = calcLine(line({ quantity: 1.5, discountType: 'PERCENT', discountValue: 10 }), SERVICE); // 162 000
    const t = calcVisit([l.net], { type: 'FIXED', value: 12_000 }, [], 100);
    expect(t.total.toString()).toBe('150000');
  });
});

describe('calc: yaxlitlash (roundTo)', () => {
  it('roundTo=100: 162 350 → 162 400, 162 349 → 162 300', () => {
    const a = calcVisit([162_350], { type: 'NONE', value: 0 }, [], 100);
    expect(a.totalRaw.toString()).toBe('162350');
    expect(a.total.toString()).toBe('162400');
    const b = calcVisit([162_349], { type: 'NONE', value: 0 }, [], 100);
    expect(b.total.toString()).toBe('162300');
  });

  it('roundTo=1: oʻzgarmaydi', () => {
    const t = calcVisit([162_349], { type: 'NONE', value: 0 }, [], 1);
    expect(t.total.toString()).toBe('162349');
  });

  it('roundTo=1000', () => {
    const t = calcVisit([162_500], { type: 'NONE', value: 0 }, [], 1000);
    expect(t.total.toString()).toBe('163000');
  });

  it('chegirmadan keyin yaxlitlanadi: 180 000 − 7 % = 167 400 → @100 oʻzgarmas; 12 345 → 12 300', () => {
    const t = calcVisit([180_000], { type: 'PERCENT', value: 7 }, [], 100);
    expect(t.globalDiscount.toString()).toBe('12600');
    expect(t.total.toString()).toBe('167400');
    const u = calcVisit([12_345], { type: 'NONE', value: 0 }, [], 100);
    expect(u.total.toString()).toBe('12300');
  });

  it('default roundTo = 100', () => {
    expect(calcVisit([162_350]).total.toString()).toBe('162400');
  });
});

describe('calc: toʻlovlar va qoldiq', () => {
  it('qisman toʻlov → musbat qoldiq (qarz)', () => {
    const t = calcVisit([180_000], { type: 'NONE', value: 0 }, [100_000], 100);
    expect(t.paid.toString()).toBe('100000');
    expect(t.balance.toString()).toBe('80000');
    expect(t.balance.isPositive()).toBe(true);
  });

  it('toʻliq toʻlov → qoldiq 0', () => {
    const t = calcVisit([180_000], { type: 'NONE', value: 0 }, [100_000, 80_000], 100);
    expect(t.balance.isZero()).toBe(true);
  });

  it('ortiqcha toʻlov → manfiy qoldiq', () => {
    const t = calcVisit([180_000], { type: 'NONE', value: 0 }, [200_000], 100);
    expect(t.balance.toString()).toBe('-20000');
    expect(t.balance.isNegative()).toBe(true);
  });

  it('qaytarish (manfiy toʻlov) hisobga olinadi', () => {
    const t = calcVisit([180_000], { type: 'NONE', value: 0 }, [200_000, -20_000], 100);
    expect(t.paid.toString()).toBe('180000');
    expect(t.balance.isZero()).toBe(true);
  });

  it('toʻlovlar string/Decimal shaklida', () => {
    const t = calcVisit([180_000], { type: 'NONE', value: 0 }, ['50 000', new Decimal(30_000)], 100);
    expect(t.paid.toString()).toBe('80000');
    expect(t.balance.toString()).toBe('100000');
  });
});

describe('calc: determinePatientType / ageAt', () => {
  const birth = new Date(2012, 8, 15); // 15.09.2012 (mahalliy vaqt)

  it('14 yoshga toʻlishdan bir kun oldin → CHILD', () => {
    expect(determinePatientType(birth, 14, new Date(2026, 8, 14))).toBe('CHILD');
    expect(ageAt(birth, new Date(2026, 8, 14))).toBe(13);
  });

  it('tugʻilgan kunida → ADULT', () => {
    expect(determinePatientType(birth, 14, new Date(2026, 8, 15))).toBe('ADULT');
    expect(ageAt(birth, new Date(2026, 8, 15))).toBe(14);
  });

  it('bir kun keyin → ADULT', () => {
    expect(determinePatientType(birth, 14, new Date(2026, 8, 16))).toBe('ADULT');
  });

  it('maxsus chegara 16: 14 yosh → CHILD, 16 yosh → ADULT', () => {
    expect(determinePatientType(birth, 16, new Date(2026, 8, 15))).toBe('CHILD');
    expect(determinePatientType(birth, 16, new Date(2028, 8, 14))).toBe('CHILD');
    expect(determinePatientType(birth, 16, new Date(2028, 8, 15))).toBe('ADULT');
  });

  it('default chegara 14', () => {
    expect(determinePatientType(birth, undefined, new Date(2026, 8, 15))).toBe('ADULT');
    expect(determinePatientType(birth, undefined, new Date(2026, 8, 14))).toBe('CHILD');
  });

  it('string sana qabul qilinadi; kelajakdagi sana → yosh 0', () => {
    expect(determinePatientType('2020-01-01', 14, new Date(2026, 8, 15))).toBe('CHILD');
    expect(ageAt(new Date(2030, 0, 1), new Date(2026, 8, 15))).toBe(0);
  });

  it('oy chegarasi: oy hali kelmagan boʻlsa yosh kamayadi', () => {
    // 15.09.2012 → 01.03.2026 da 13 yosh
    expect(ageAt(birth, new Date(2026, 2, 1))).toBe(13);
    // 15.09.2012 → 01.12.2026 da 14 yosh
    expect(ageAt(birth, new Date(2026, 11, 1))).toBe(14);
  });
});

describe('calc: snapQuantity / isValidQuantity / quantityStep / formatQuantity', () => {
  it('snapQuantity 1.3 → 1.5 (half), 1.3 → 1 (whole)', () => {
    expect(snapQuantity(1.3, true)).toBe(1.5);
    expect(snapQuantity(1.3, false)).toBe(1);
  });

  it('snapQuantity 1.2 → 1 (half), 1.25 → 1.5, 1.7 → 1.5, 1.8 → 2', () => {
    expect(snapQuantity(1.2, true)).toBe(1);
    expect(snapQuantity(1.25, true)).toBe(1.5);
    expect(snapQuantity(1.7, true)).toBe(1.5);
    expect(snapQuantity(1.8, true)).toBe(2);
    expect(snapQuantity(1.5, false)).toBe(2);
    expect(snapQuantity(1.4, false)).toBe(1);
  });

  it('snapQuantity 0 → step; manfiy → step', () => {
    expect(snapQuantity(0, true)).toBe(0.5);
    expect(snapQuantity(0, false)).toBe(1);
    expect(snapQuantity(-3, true)).toBe(0.5);
  });

  it('snapQuantity 200 → 99', () => {
    expect(snapQuantity(200, true)).toBe(99);
    expect(snapQuantity(200, false)).toBe(99);
    expect(snapQuantity(99.4, true)).toBe(99);
  });

  it('snapQuantity NaN/Infinity → step', () => {
    expect(snapQuantity(Number.NaN, true)).toBe(0.5);
    expect(snapQuantity(Number.POSITIVE_INFINITY, false)).toBe(1);
  });

  it('quantityStep', () => {
    expect(quantityStep(true)).toBe(0.5);
    expect(quantityStep(false)).toBe(1);
  });

  it('isValidQuantity', () => {
    expect(isValidQuantity(1.5, true)).toBe(true);
    expect(isValidQuantity(1.5, false)).toBe(false);
    expect(isValidQuantity(1.3, true)).toBe(false);
    expect(isValidQuantity(0, true)).toBe(false);
    expect(isValidQuantity(-1, true)).toBe(false);
    expect(isValidQuantity(100, true)).toBe(false);
    expect(isValidQuantity(99, false)).toBe(true);
    expect(isValidQuantity('2', false)).toBe(true);
    expect(isValidQuantity('0,5', true)).toBe(true);
    expect(isValidQuantity('abc', true)).toBe(false);
    expect(isValidQuantity(new Decimal(3), false)).toBe(true);
  });

  it('formatQuantity', () => {
    expect(formatQuantity(1)).toBe('1');
    expect(formatQuantity(1.5)).toBe('1.5');
    expect(formatQuantity('2.0')).toBe('2');
    expect(formatQuantity(new Decimal('0.5'))).toBe('0.5');
    expect(formatQuantity(99)).toBe('99');
  });
});

describe('calc: float xatosiz (Decimal)', () => {
  it('0.5 × 12 345 va 33 % → aniq butun sonlar', () => {
    const svc: ServicePricing = { ...SERVICE, priceAdultMed: 12_345 };
    const r = calcLine(line({ quantity: 0.5, discountType: 'PERCENT', discountValue: 33 }), svc);
    // 12 345 × 0.5 = 6 172.5 → 6 173 (half-up)
    expect(r.gross.toString()).toBe('6173');
    expect(r.gross.mod(1).isZero()).toBe(true);
    // 6 173 × 33 % = 2 037.09 → 2 037
    expect(r.discount.toString()).toBe('2037');
    expect(r.discount.mod(1).isZero()).toBe(true);
    // 6 173 − 2 037 = 4 136
    expect(r.net.toString()).toBe('4136');
    expect(r.net.mod(1).isZero()).toBe(true);
    expect(r.gross.isInteger()).toBe(true);
    expect(r.net.isInteger()).toBe(true);
  });

  it('0.1 + 0.2 kabi holatlar: 3 × 33 333 ning 10 % = 10 000 (aniq)', () => {
    const svc: ServicePricing = { ...SERVICE, priceAdultMed: 33_333 };
    const r = calcLine(line({ quantity: 3, discountType: 'PERCENT', discountValue: 10 }), svc);
    expect(r.gross.toString()).toBe('99999');
    expect(r.discount.toString()).toBe('10000');
    expect(r.net.toString()).toBe('89999');
  });

  it('koʻp qatorli yigʻindi float xatosiz', () => {
    const nets = Array.from({ length: 10 }, () => new Decimal('0.1'));
    const t = calcVisit(nets, { type: 'NONE', value: 0 }, [], 1);
    expect(t.subtotal.toString()).toBe('1');
    expect(t.total.toString()).toBe('1');
  });
});

describe('calc: JSON yordamchilari', () => {
  it('lineResultToJson → number maydonlar', () => {
    const r = calcLine(line({ quantity: 1.5, discountType: 'PERCENT', discountValue: 10 }), SERVICE);
    expect(lineResultToJson(r)).toEqual({ unitPrice: 120_000, gross: 180_000, discount: 18_000, net: 162_000, quantity: 1.5 });
  });

  it('visitTotalsToJson → number maydonlar', () => {
    const t = calcVisit([162_000], { type: 'FIXED', value: 12_000 }, [100_000], 100);
    expect(visitTotalsToJson(t)).toEqual({
      subtotal: 162_000,
      globalDiscount: 12_000,
      totalRaw: 150_000,
      total: 150_000,
      paid: 100_000,
      balance: 50_000,
    });
  });

  it('notoʻgʻri pul matni → MoneyError (CalcError emas)', () => {
    expect(() => calcLine(line({ discountType: 'FIXED', discountValue: 'abc' }), SERVICE)).toThrow(MoneyError);
  });
});
