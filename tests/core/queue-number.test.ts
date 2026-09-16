import { describe, it, expect } from 'vitest';
import {
  formatQueueNumber,
  parseQueueNumber,
  prefixForType,
  estimateWait,
  formatCardNumber,
  formatReceiptNo,
} from '@/lib/queue-number';
import { parseClinicSettings, type QueueSettings } from '@/lib/settings/types';

describe('queue-number: formatQueueNumber', () => {
  it("formatQueueNumber('A', 1) = 'A-001'", () => {
    expect(formatQueueNumber('A', 1)).toBe('A-001');
  });

  it('3 xonagacha toʻldiriladi: 7 → A-007, 42 → B-042, 999 → C-999', () => {
    expect(formatQueueNumber('A', 7)).toBe('A-007');
    expect(formatQueueNumber('B', 42)).toBe('B-042');
    expect(formatQueueNumber('C', 999)).toBe('C-999');
  });

  it("1000 → 'A-1000' (kesilmaydi)", () => {
    expect(formatQueueNumber('A', 1000)).toBe('A-1000');
    expect(formatQueueNumber('D', 12345)).toBe('D-12345');
  });
});

describe('queue-number: parseQueueNumber', () => {
  it('A-001 → { prefix: A, seq: 1 }', () => {
    expect(parseQueueNumber('A-001')).toEqual({ prefix: 'A', seq: 1 });
  });

  it('A-1000 → seq 1000', () => {
    expect(parseQueueNumber('A-1000')).toEqual({ prefix: 'A', seq: 1000 });
  });

  it('format ↔ parse teskari', () => {
    for (const seq of [1, 9, 10, 99, 100, 999, 1000, 4321]) {
      const p = parseQueueNumber(formatQueueNumber('B', seq));
      expect(p).toEqual({ prefix: 'B', seq });
    }
  });

  it('notoʻgʻri formatlar → null', () => {
    expect(parseQueueNumber('')).toBeNull();
    expect(parseQueueNumber('A001')).toBeNull();
    expect(parseQueueNumber('a-001')).toBeNull();
    expect(parseQueueNumber('A-01')).toBeNull();
    expect(parseQueueNumber('AB-001')).toBeNull();
    expect(parseQueueNumber('A-001x')).toBeNull();
    expect(parseQueueNumber('1-001')).toBeNull();
  });
});

describe('queue-number: prefixForType', () => {
  const defaults: QueueSettings = parseClinicSettings({}).queue;

  it('standart prefikslar A/B/C/D', () => {
    expect(prefixForType('DOCTOR', defaults)).toBe('A');
    expect(prefixForType('RECHECK', defaults)).toBe('B');
    expect(prefixForType('LAB', defaults)).toBe('C');
    expect(prefixForType('CASHIER', defaults)).toBe('D');
  });

  it('klinika sozlamasidagi prefiks ustun', () => {
    const custom = parseClinicSettings({ queue: { prefixes: { DOCTOR: 'S', LAB: 'L' } } }).queue;
    expect(prefixForType('DOCTOR', custom)).toBe('S');
    expect(prefixForType('LAB', custom)).toBe('L');
    expect(prefixForType('RECHECK', custom)).toBe('B');
    expect(formatQueueNumber(prefixForType('DOCTOR', custom), 5)).toBe('S-005');
  });
});

describe('queue-number: estimateWait', () => {
  it('oldinda 3 kishi × 15 daqiqa = 45', () => {
    expect(estimateWait(3, 15)).toBe(45);
  });

  it('oldinda hech kim yoʻq → 0', () => {
    expect(estimateWait(0, 15)).toBe(0);
  });

  it('manfiy ahead → 0; avg < 1 → 1 daqiqa deb olinadi', () => {
    expect(estimateWait(-2, 15)).toBe(0);
    expect(estimateWait(3, 0)).toBe(3);
    expect(estimateWait(3, -5)).toBe(3);
  });
});

describe('queue-number: formatCardNumber / formatReceiptNo', () => {
  it("formatCardNumber(2026, 42) = '2026-00042'", () => {
    expect(formatCardNumber(2026, 42)).toBe('2026-00042');
    expect(formatCardNumber(2026, 1)).toBe('2026-00001');
    expect(formatCardNumber(2026, 99999)).toBe('2026-99999');
    expect(formatCardNumber(2026, 100000)).toBe('2026-100000');
  });

  it("formatReceiptNo('2026-09-15', 42) = '20260915-0042'", () => {
    expect(formatReceiptNo('2026-09-15', 42)).toBe('20260915-0042');
    expect(formatReceiptNo('2026-01-01', 1)).toBe('20260101-0001');
    expect(formatReceiptNo('2026-12-31', 9999)).toBe('20261231-9999');
    expect(formatReceiptNo('2026-12-31', 10000)).toBe('20261231-10000');
  });
});
