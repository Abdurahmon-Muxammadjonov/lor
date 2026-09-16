import { describe, it, expect } from 'vitest';
import {
  CLINIC_TZ,
  todayKey,
  dateKeyToDate,
  dayRangeTz,
  todayRange,
  yesterdayRange,
  hmToMinutes,
  minutesToHm,
  fmtDate,
  fmtTime,
  fmtDateTime,
  fmtDateLong,
  fmtSmartDate,
} from '@/lib/date';

describe('date: todayKey (Asia/Tashkent)', () => {
  it('CLINIC_TZ = Asia/Tashkent', () => {
    expect(CLINIC_TZ).toBe('Asia/Tashkent');
  });

  it('2026-09-15T20:30:00Z → 2026-09-16 (UTC+5 da 01:30)', () => {
    expect(todayKey(new Date('2026-09-15T20:30:00Z'))).toBe('2026-09-16');
  });

  it('2026-09-15T18:59:59Z → 2026-09-15 (23:59:59 Toshkent)', () => {
    expect(todayKey(new Date('2026-09-15T18:59:59Z'))).toBe('2026-09-15');
  });

  it('2026-09-15T19:00:00Z → 2026-09-16 (yarim tun Toshkent)', () => {
    expect(todayKey(new Date('2026-09-15T19:00:00Z'))).toBe('2026-09-16');
  });

  it('yil oxiri: 2026-12-31T20:00:00Z → 2027-01-01', () => {
    expect(todayKey(new Date('2026-12-31T20:00:00Z'))).toBe('2027-01-01');
  });

  it('YYYY-MM-DD formati', () => {
    expect(todayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('date: dateKeyToDate / dayRangeTz', () => {
  it('dateKeyToDate → UTC yarim tun', () => {
    expect(dateKeyToDate('2026-09-15').toISOString()).toBe('2026-09-15T00:00:00.000Z');
  });

  it('dayRangeTz 2026-09-15 → [14T19:00Z, 15T18:59:59.999Z]', () => {
    const { start, end } = dayRangeTz('2026-09-15');
    expect(start.toISOString()).toBe('2026-09-14T19:00:00.000Z');
    expect(end.toISOString()).toBe('2026-09-15T18:59:59.999Z');
  });

  it('kun boshi va oxiri bir xil todayKey ga tushadi', () => {
    const { start, end } = dayRangeTz('2026-09-15');
    expect(todayKey(start)).toBe('2026-09-15');
    expect(todayKey(end)).toBe('2026-09-15');
    expect(todayKey(new Date(start.getTime() - 1))).toBe('2026-09-14');
    expect(todayKey(new Date(end.getTime() + 1))).toBe('2026-09-16');
  });

  it('todayRange / yesterdayRange berilgan vaqt boʻyicha', () => {
    const now = new Date('2026-09-15T20:30:00Z'); // 16-sentabr Toshkent
    const t = todayRange(now);
    expect(t.start.toISOString()).toBe('2026-09-15T19:00:00.000Z');
    expect(t.end.toISOString()).toBe('2026-09-16T18:59:59.999Z');
    const y = yesterdayRange(now);
    expect(y.start.toISOString()).toBe('2026-09-14T19:00:00.000Z');
    expect(y.end.toISOString()).toBe('2026-09-15T18:59:59.999Z');
  });
});

describe('date: hmToMinutes / minutesToHm', () => {
  it('"08:00" → 480, "14:32" → 872, "00:00" → 0', () => {
    expect(hmToMinutes('08:00')).toBe(480);
    expect(hmToMinutes('14:32')).toBe(872);
    expect(hmToMinutes('00:00')).toBe(0);
    expect(hmToMinutes('23:59')).toBe(1439);
  });

  it('notoʻliq matn: "9" → 540, "" → 0', () => {
    expect(hmToMinutes('9')).toBe(540);
    expect(hmToMinutes('')).toBe(0);
  });

  it('minutesToHm 480 → "08:00", 872 → "14:32", 0 → "00:00"', () => {
    expect(minutesToHm(480)).toBe('08:00');
    expect(minutesToHm(872)).toBe('14:32');
    expect(minutesToHm(0)).toBe('00:00');
    expect(minutesToHm(1439)).toBe('23:59');
  });

  it('teskari aylantirish', () => {
    for (const hm of ['00:00', '08:30', '12:05', '20:00', '23:59']) {
      expect(minutesToHm(hmToMinutes(hm))).toBe(hm);
    }
  });
});

describe('date: fmt* (mahalliy vaqt)', () => {
  // Mahalliy konstruktor — TZ dan qatʼi nazar bir xil natija
  const d = new Date(2026, 8, 15, 14, 32);

  it('fmtDate → 15.09.2026 (uz va ru bir xil)', () => {
    expect(fmtDate(d)).toBe('15.09.2026');
    expect(fmtDate(d, 'ru')).toBe('15.09.2026');
  });

  it('fmtTime → 14:32', () => {
    expect(fmtTime(d)).toBe('14:32');
  });

  it('fmtDateTime → 15.09.2026 14:32', () => {
    expect(fmtDateTime(d, 'uz')).toBe('15.09.2026 14:32');
    expect(fmtDateTime(d, 'ru')).toBe('15.09.2026 14:32');
  });

  it('fmtDate ISO string kirishni ham qabul qiladi (peshin UTC)', () => {
    expect(fmtDate('2026-09-15T12:00:00Z')).toBe('15.09.2026');
  });

  it('fmtDateLong lokalga qarab oy nomi', () => {
    expect(fmtDateLong(d, 'uz')).toMatch(/^15 .+ 2026$/);
    expect(fmtDateLong(d, 'ru')).toMatch(/^15 сентября 2026$/);
  });

  it('fmtSmartDate eski sana uchun toʻliq format', () => {
    expect(fmtSmartDate(new Date(2020, 0, 5, 9, 7), 'uz')).toBe('05.01.2020 09:07');
  });

  it('fmtSmartDate bugun uchun "Bugun, HH:mm" / "Сегодня, HH:mm"', () => {
    const now = new Date();
    expect(fmtSmartDate(now, 'uz')).toBe(`Bugun, ${fmtTime(now)}`);
    expect(fmtSmartDate(now, 'ru')).toBe(`Сегодня, ${fmtTime(now)}`);
  });
});
