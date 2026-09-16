import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  D,
  MoneyError,
  roundMoney,
  roundToStep,
  sumMoney,
  maxZero,
  toMoneyString,
  toMoneyNumber,
  moneyToJson,
  formatMoney,
  parseMoneyInput,
  groupDigits,
} from '@/lib/money';

const NBSP = ' ';
const MINUS = '−';

describe('money: D() parsing', () => {
  it('number → Decimal', () => {
    expect(D(1250000).toString()).toBe('1250000');
    expect(D(0).isZero()).toBe(true);
    expect(D(-5).toString()).toBe('-5');
  });

  it('string → Decimal', () => {
    expect(D('1250000').toString()).toBe('1250000');
    expect(D('120000.50').toString()).toBe('120000.5');
    expect(D('-42').toString()).toBe('-42');
  });

  it('boʻshliqli string "1 250 000" → 1250000', () => {
    expect(D('1 250 000').toString()).toBe('1250000');
    expect(D(`1${NBSP}250${NBSP}000`).toString()).toBe('1250000');
    expect(D(' 500 ').toString()).toBe('500');
  });

  it('vergul → nuqta: "1250,5" → 1250.5', () => {
    expect(D('1250,5').toString()).toBe('1250.5');
  });

  it('null / undefined / "" → 0', () => {
    expect(D(null).isZero()).toBe(true);
    expect(D(undefined).isZero()).toBe(true);
    expect(D('').isZero()).toBe(true);
  });

  it('Decimal → oʻzi (nusxa emas)', () => {
    const d = new Decimal(77);
    expect(D(d)).toBe(d);
  });

  it('bigint → Decimal', () => {
    expect(D(BigInt(123456789012)).toString()).toBe('123456789012');
  });

  it('toString() li obyekt (Prisma.Decimal kabi) → Decimal', () => {
    expect(D({ toString: () => '125000' }).toString()).toBe('125000');
  });

  it('notoʻgʻri matn → MoneyError INVALID_MONEY', () => {
    expect(() => D('abc')).toThrow(MoneyError);
    expect(() => D('12a')).toThrowError(expect.objectContaining({ code: 'INVALID_MONEY' }));
    expect(() => D('1.2.3')).toThrow(MoneyError);
  });

  it('cheksiz / NaN → MoneyError', () => {
    expect(() => D(Number.NaN)).toThrow(MoneyError);
    expect(() => D(Number.POSITIVE_INFINITY)).toThrow(MoneyError);
  });

  it('MoneyError nomi va kodi', () => {
    const e = new MoneyError('NEGATIVE_MONEY');
    expect(e.name).toBe('MoneyError');
    expect(e.code).toBe('NEGATIVE_MONEY');
    expect(e.message).toBe('NEGATIVE_MONEY');
  });
});

describe('money: roundMoney (half-up)', () => {
  it('0.5 → 1, 1.4 → 1, 1.5 → 2, 2.5 → 3', () => {
    expect(roundMoney(0.5).toString()).toBe('1');
    expect(roundMoney(1.4).toString()).toBe('1');
    expect(roundMoney(1.5).toString()).toBe('2');
    expect(roundMoney(2.5).toString()).toBe('3');
    expect(roundMoney('123456.49').toString()).toBe('123456');
  });

  it('manfiy: -0.5 → -1 (noldan uzoqlashadi)', () => {
    expect(roundMoney(-0.5).toString()).toBe('-1');
    expect(roundMoney(-1.4).toString()).toBe('-1');
  });

  it('butun sonlar oʻzgarmaydi', () => {
    expect(roundMoney(120000).toString()).toBe('120000');
  });
});

describe('money: roundToStep', () => {
  it('162350 → 162400 @100 (yarim yuqoriga)', () => {
    expect(roundToStep(162350, 100).toString()).toBe('162400');
  });

  it('162349 → 162300 @100', () => {
    expect(roundToStep(162349, 100).toString()).toBe('162300');
  });

  it('step 1000: 162350 → 162000, 162500 → 163000', () => {
    expect(roundToStep(162350, 1000).toString()).toBe('162000');
    expect(roundToStep(162500, 1000).toString()).toBe('163000');
    expect(roundToStep(162499, 1000).toString()).toBe('162000');
  });

  it('step 0 va 1 → butun soʻm', () => {
    expect(roundToStep(162350.4, 0).toString()).toBe('162350');
    expect(roundToStep(162350.5, 0).toString()).toBe('162351');
    expect(roundToStep(162350.4, 1).toString()).toBe('162350');
    expect(roundToStep(162349, 1).toString()).toBe('162349');
  });

  it('manfiy step → butun soʻm', () => {
    expect(roundToStep(162349.6, -100).toString()).toBe('162350');
  });

  it('aynan karrali qiymat oʻzgarmaydi', () => {
    expect(roundToStep(162300, 100).toString()).toBe('162300');
    expect(roundToStep(0, 100).toString()).toBe('0');
  });

  it('step 500: 1250 → 1500, 1249 → 1000', () => {
    expect(roundToStep(1250, 500).toString()).toBe('1500');
    expect(roundToStep(1249, 500).toString()).toBe('1000');
  });
});

describe('money: sumMoney / maxZero', () => {
  it('sumMoney aralash kirishlarni qoʻshadi', () => {
    expect(sumMoney([100, '200', new Decimal(300), '1 000']).toString()).toBe('1600');
    expect(sumMoney([]).isZero()).toBe(true);
  });

  it('maxZero manfiyni 0 ga keltiradi', () => {
    expect(maxZero(-5).toString()).toBe('0');
    expect(maxZero(5).toString()).toBe('5');
    expect(maxZero(0).toString()).toBe('0');
  });
});

describe('money: toMoneyString / toMoneyNumber / moneyToJson', () => {
  it('toMoneyString yaxlitlab butun string beradi', () => {
    expect(toMoneyString(1250000)).toBe('1250000');
    expect(toMoneyString('1250000.49')).toBe('1250000');
    expect(toMoneyString('1250000.5')).toBe('1250001');
    expect(toMoneyString(new Decimal(0))).toBe('0');
  });

  it('toMoneyNumber butun number', () => {
    expect(toMoneyNumber('180000')).toBe(180000);
    expect(toMoneyNumber(180000.4)).toBe(180000);
  });

  it('moneyToJson null/undefined → 0', () => {
    expect(moneyToJson(null)).toBe(0);
    expect(moneyToJson(undefined)).toBe(0);
    expect(moneyToJson(new Decimal('125000'))).toBe(125000);
    expect(moneyToJson({ toString: () => '99.5' })).toBe(100);
  });
});

describe('money: formatMoney', () => {
  it('1250000 → "1 250 000 soʻm" (NBSP suffiks oldida)', () => {
    const s = formatMoney(1250000);
    expect(s).toBe(`1 250 000${NBSP}soʻm`);
    expect(s.includes('ʻ')).toBe(true);
    expect(s.charAt(s.length - 5)).toBe(NBSP);
  });

  it('kichik summalar guruhlanmaydi', () => {
    expect(formatMoney(999)).toBe(`999${NBSP}soʻm`);
    expect(formatMoney(1000)).toBe(`1 000${NBSP}soʻm`);
    expect(formatMoney(0)).toBe(`0${NBSP}soʻm`);
  });

  it('manfiy → matematik minus (U+2212)', () => {
    expect(formatMoney(-5000)).toBe(`${MINUS}5 000${NBSP}soʻm`);
    expect(formatMoney(-5000).startsWith('-')).toBe(false);
  });

  it('signed: musbatga "+", nolga belgi yoʻq, manfiyga minus', () => {
    expect(formatMoney(5000, { signed: true })).toBe(`+5 000${NBSP}soʻm`);
    expect(formatMoney(0, { signed: true })).toBe(`0${NBSP}soʻm`);
    expect(formatMoney(-5000, { signed: true })).toBe(`${MINUS}5 000${NBSP}soʻm`);
  });

  it('suffix "" → faqat raqam', () => {
    expect(formatMoney(1250000, { suffix: '' })).toBe('1 250 000');
    expect(formatMoney(-1250000, { suffix: '' })).toBe(`${MINUS}1 250 000`);
  });

  it('suffix "сум" (RU)', () => {
    expect(formatMoney(1250000, { suffix: 'сум' })).toBe(`1 250 000${NBSP}сум`);
  });

  it('separator parametri', () => {
    expect(formatMoney(1250000, { separator: NBSP, suffix: '' })).toBe(`1${NBSP}250${NBSP}000`);
    expect(formatMoney(1250000, { separator: ',', suffix: '' })).toBe('1,250,000');
  });

  it('kasr qiymat yaxlitlanadi, null → 0', () => {
    expect(formatMoney('1250000.5', { suffix: '' })).toBe('1 250 001');
    expect(formatMoney(null)).toBe(`0${NBSP}soʻm`);
    expect(formatMoney(undefined, { suffix: '' })).toBe('0');
  });

  it('string kirishni ham qabul qiladi', () => {
    expect(formatMoney('1 250 000', { suffix: '' })).toBe('1 250 000');
  });
});

describe('money: groupDigits / parseMoneyInput', () => {
  it('groupDigits "1250000" → "1 250 000"', () => {
    expect(groupDigits('1250000')).toBe('1 250 000');
    expect(groupDigits('12')).toBe('12');
    expect(groupDigits('1234')).toBe('1 234');
    expect(groupDigits('')).toBe('');
  });

  it('groupDigits raqam boʻlmagan belgilarni tashlaydi', () => {
    expect(groupDigits('1a2b3c4')).toBe('1 234');
    expect(groupDigits('1 250 000')).toBe('1 250 000');
  });

  it('groupDigits separator parametri', () => {
    expect(groupDigits('1250000', NBSP)).toBe(`1${NBSP}250${NBSP}000`);
  });

  it('parseMoneyInput "1 250 000" → "1250000"', () => {
    expect(parseMoneyInput('1 250 000')).toBe('1250000');
    expect(parseMoneyInput(`1${NBSP}250${NBSP}000 soʻm`)).toBe('1250000');
    expect(parseMoneyInput('1,250,000')).toBe('1250000');
    expect(parseMoneyInput('')).toBe('');
    expect(parseMoneyInput('abc')).toBe('');
  });

  it('groupDigits(parseMoneyInput(x)) idempotent', () => {
    const raw = '1 250 000';
    expect(groupDigits(parseMoneyInput(raw))).toBe(raw);
  });
});
