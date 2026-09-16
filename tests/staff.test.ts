import { describe, expect, it } from 'vitest';

import { staff } from '@/i18n/messages/staff';
import type { Tree } from '@/i18n/types';
import { parseWeeklySchedule } from '@/lib/settings/types';
import { hexToRgba, safeHex } from '@/lib/staff/color';
import { CSV_BOM, buildCsv, csvCell } from '@/lib/staff/csv';
import { SALARY_ROUND_STEP, calcSalary, formatPercent, isValidMonth, monthRange, recentMonths, shiftMonth } from '@/lib/staff/salary';
import {
  DAY_ORDER,
  dayMinutes,
  daySegments,
  defaultScheduleForm,
  isWorkingAt,
  scheduleToForm,
  startOfWeekMonday,
  timelineBounds,
  timelineTicks,
  weeklyHours,
} from '@/lib/staff/schedule';
import {
  PasswordFormSchema,
  PasswordSchema,
  SalaryQuerySchema,
  STAFF_COLORS,
  UserCreateSchema,
  UserUpdateSchema,
  UsersQuerySchema,
  WeeklyScheduleInputSchema,
} from '@/lib/staff/schemas';

// ───────────────────────── Yordamchilar ─────────────────────────

function keyPaths(tree: Tree, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([k, v]) => (typeof v === 'string' ? [prefix + k] : keyPaths(v, `${prefix}${k}.`)));
}
function leaves(tree: Tree): string[] {
  return Object.values(tree).flatMap((v) => (typeof v === 'string' ? [v] : leaves(v)));
}

const validSchedule = () => defaultScheduleForm();

const validCreate = () => ({
  login: 'Test.Doctor-01',
  password: 'Doctor123!',
  fullName: 'Rahimov Jasur Anvarovich',
  role: 'DOCTOR' as const,
  phone: '+998 90 123 45 67',
  email: 'JASUR@lor.uz',
  specialty: 'LOR-shifokor',
  room: '3',
  color: '#00d4ff',
  salaryType: 'PERCENT' as const,
  salaryValue: 30,
  schedule: validSchedule(),
});

// ───────────────────────── Ish haqi ─────────────────────────

describe('calcSalary', () => {
  it('PERCENT: 30 % of 1 234 567 → 370 400 (100 soʻmgacha yaxlitlanadi)', () => {
    expect(calcSalary('PERCENT', 30, 1_234_567).toNumber()).toBe(370_400);
    expect(SALARY_ROUND_STEP).toBe(100);
  });

  it('PERCENT: Decimal aniqligi, satr kirishlar, 0 va manfiy foiz', () => {
    expect(calcSalary('PERCENT', '35', '1000000').toNumber()).toBe(350_000);
    expect(calcSalary('PERCENT', 33, 100).toNumber()).toBe(0); // 33 → 0 (100 ga yaxlitlash)
    expect(calcSalary('PERCENT', 33, 200).toNumber()).toBe(100); // 66 → 100
    expect(calcSalary('PERCENT', 0, 5_000_000).toNumber()).toBe(0);
    expect(calcSalary('PERCENT', -5, 5_000_000).toNumber()).toBe(0);
    expect(calcSalary('PERCENT', 30, 0).toNumber()).toBe(0);
  });

  it('PERCENT: float xatosiz (0.1 + 0.2 muammosi yoʻq)', () => {
    // 3 % of 10 → 0.3 → 0 (100 ga), 3 % of 3 333 333 → 99 999.99 → 100 000
    expect(calcSalary('PERCENT', 3, 3_333_333).toNumber()).toBe(100_000);
    expect(calcSalary('PERCENT', 12.5, 1_000_000).toNumber()).toBe(125_000);
  });

  it('FIXED: tushumdan qatʼi nazar oylik summa', () => {
    expect(calcSalary('FIXED', 8_000_000, 1_234_567).toNumber()).toBe(8_000_000);
    expect(calcSalary('FIXED', 8_000_000, 0).toNumber()).toBe(8_000_000);
    expect(calcSalary('FIXED', '4500000', 99).toNumber()).toBe(4_500_000);
  });

  it('formatPercent', () => {
    expect(formatPercent(30)).toBe('30 %');
    expect(formatPercent('12.5')).toBe('12.5 %');
  });
});

describe('oy yordamchilari (Asia/Tashkent)', () => {
  it('monthRange: oy boshi va keyingi oy boshi (+05:00)', () => {
    const r = monthRange('2026-09');
    expect(r.start.toISOString()).toBe('2026-08-31T19:00:00.000Z');
    expect(r.end.toISOString()).toBe('2026-09-30T19:00:00.000Z');
    const dec = monthRange('2026-12');
    expect(dec.end.toISOString()).toBe('2026-12-31T19:00:00.000Z');
    expect(() => monthRange('2026-13')).toThrow(RangeError);
  });

  it('shiftMonth / recentMonths / isValidMonth', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-09', -14)).toBe('2025-07');
    const months = recentMonths(3, new Date('2026-09-15T10:00:00+05:00'));
    expect(months).toEqual(['2026-09', '2026-08', '2026-07']);
    expect(isValidMonth('2026-00')).toBe(false);
    expect(isValidMonth('2026-9')).toBe(false);
    expect(isValidMonth('2026-09')).toBe(true);
  });
});

// ───────────────────────── Sxemalar ─────────────────────────

describe('UserCreateSchema', () => {
  it('toʻgʻri kirish: login kichik harfga, email kichik harfga, telefon normalizatsiya', () => {
    const r = UserCreateSchema.safeParse(validCreate());
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.login).toBe('test.doctor-01');
    expect(r.data.email).toBe('jasur@lor.uz');
    expect(r.data.phone).toBe('+998901234567');
    expect(r.data.salaryValue).toBe(30);
    expect(r.data.schedule[1].breakStart).toBe('13:00');
    expect(r.data.schedule[0].enabled).toBe(false);
  });

  it('login formati: boʻshliq / kirill / qisqa / uzun rad etiladi', () => {
    for (const login of ['ab', 'jasur rahimov', 'жасур', 'a'.repeat(33), 'jas@ur']) {
      const r = UserCreateSchema.safeParse({ ...validCreate(), login });
      expect(r.success, login).toBe(false);
    }
  });

  it('zaif parol rad etiladi (kamida 8 belgi, harf + raqam)', () => {
    for (const password of ['short1', 'onlyletters', '12345678', '']) {
      expect(UserCreateSchema.safeParse({ ...validCreate(), password }).success, password).toBe(false);
    }
    expect(UserCreateSchema.safeParse({ ...validCreate(), password: 'Strong123' }).success).toBe(true);
  });

  it('SUPER_ADMIN yaratib boʻlmaydi, notoʻgʻri rol rad', () => {
    expect(UserCreateSchema.safeParse({ ...validCreate(), role: 'SUPER_ADMIN' }).success).toBe(false);
    expect(UserCreateSchema.safeParse({ ...validCreate(), role: 'OWNER' }).success).toBe(false);
  });

  it('PERCENT 100 dan oshmaydi, FIXED uchun cheklov yoʻq; pul butun', () => {
    expect(UserCreateSchema.safeParse({ ...validCreate(), salaryType: 'PERCENT', salaryValue: 101 }).success).toBe(false);
    expect(UserCreateSchema.safeParse({ ...validCreate(), salaryType: 'PERCENT', salaryValue: 100 }).success).toBe(true);
    expect(UserCreateSchema.safeParse({ ...validCreate(), salaryType: 'FIXED', salaryValue: 8_000_000 }).success).toBe(true);
    expect(UserCreateSchema.safeParse({ ...validCreate(), salaryType: 'FIXED', salaryValue: '8 000 000' }).success).toBe(true);
    expect(UserCreateSchema.safeParse({ ...validCreate(), salaryType: 'FIXED', salaryValue: 1000.5 }).success).toBe(false);
    expect(UserCreateSchema.safeParse({ ...validCreate(), salaryType: 'FIXED', salaryValue: -1 }).success).toBe(false);
  });

  it('rang faqat #RRGGBB, palitra 8 ta', () => {
    expect(STAFF_COLORS).toHaveLength(8);
    expect(UserCreateSchema.safeParse({ ...validCreate(), color: 'red' }).success).toBe(false);
    expect(UserCreateSchema.safeParse({ ...validCreate(), color: '#FFF' }).success).toBe(false);
  });

  it('ixtiyoriy maydonlar boʻsh satr boʻlishi mumkin, notoʻgʻri email/telefon rad', () => {
    expect(UserCreateSchema.safeParse({ ...validCreate(), email: '', phone: '', specialty: '', room: '' }).success).toBe(true);
    expect(UserCreateSchema.safeParse({ ...validCreate(), email: 'not-an-email' }).success).toBe(false);
    expect(UserCreateSchema.safeParse({ ...validCreate(), phone: '12' }).success).toBe(false);
  });

  it('jadval: tugash boshlanishdan keyin, tanaffus ish vaqti ichida va juft', () => {
    const bad = validCreate();
    bad.schedule[1] = { enabled: true, start: '18:00', end: '09:00', breakStart: '', breakEnd: '' };
    const r1 = UserCreateSchema.safeParse(bad);
    expect(r1.success).toBe(false);
    if (!r1.success) expect(r1.error.issues[0]?.message).toBe('staff.validation.endAfterStart');

    const halfBreak = validCreate();
    halfBreak.schedule[2] = { enabled: true, start: '09:00', end: '18:00', breakStart: '13:00', breakEnd: '' };
    const r2 = UserCreateSchema.safeParse(halfBreak);
    expect(r2.success).toBe(false);
    if (!r2.success) expect(r2.error.issues[0]?.message).toBe('staff.validation.breakBoth');

    const outside = validCreate();
    outside.schedule[3] = { enabled: true, start: '09:00', end: '18:00', breakStart: '18:30', breakEnd: '19:00' };
    expect(UserCreateSchema.safeParse(outside).success).toBe(false);

    // Oʻchirilgan kun tekshirilmaydi
    const off = validCreate();
    off.schedule[0] = { enabled: false, start: '18:00', end: '09:00', breakStart: '', breakEnd: '' };
    expect(UserCreateSchema.safeParse(off).success).toBe(true);

    // Vaqt formati
    const badTime = validCreate();
    badTime.schedule[4] = { enabled: true, start: '9:00', end: '18:00', breakStart: '', breakEnd: '' };
    expect(UserCreateSchema.safeParse(badTime).success).toBe(false);
  });

  it('WeeklyScheduleInputSchema natijasi kernel parseWeeklySchedule bilan mos', () => {
    const parsed = WeeklyScheduleInputSchema.parse(validSchedule());
    const kernel = parseWeeklySchedule(parsed);
    expect(kernel[1].start).toBe('09:00');
    expect(kernel[1].breakStart).toBe('13:00');
    expect(kernel[6].end).toBe('14:00');
    expect(kernel[0].enabled).toBe(false);
  });
});

describe('UserUpdateSchema / PasswordSchema / soʻrov sxemalari', () => {
  it('qisman yangilash: parol yoʻq, isActive bor', () => {
    const r = UserUpdateSchema.safeParse({ fullName: 'Yangi Ism', isActive: false, password: 'Should-be-stripped1' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.fullName).toBe('Yangi Ism');
      expect(r.data.isActive).toBe(false);
      expect('password' in r.data).toBe(false);
    }
    expect(UserUpdateSchema.safeParse({}).success).toBe(true);
    expect(UserUpdateSchema.safeParse({ salaryType: 'PERCENT', salaryValue: 150 }).success).toBe(false);
    expect(UserUpdateSchema.safeParse({ role: 'SUPER_ADMIN' }).success).toBe(false);
  });

  it('PasswordSchema va tasdiqlash', () => {
    expect(PasswordSchema.safeParse({ password: 'weak' }).success).toBe(false);
    expect(PasswordSchema.safeParse({ password: 'Strong123' }).success).toBe(true);
    const mismatch = PasswordFormSchema.safeParse({ password: 'Strong123', confirm: 'Strong124' });
    expect(mismatch.success).toBe(false);
    if (!mismatch.success) expect(mismatch.error.issues[0]?.path).toEqual(['confirm']);
    expect(PasswordFormSchema.safeParse({ password: 'Strong123', confirm: 'Strong123' }).success).toBe(true);
  });

  it('UsersQuerySchema / SalaryQuerySchema', () => {
    expect(UsersQuerySchema.parse({ role: 'DOCTOR', active: '1' })).toEqual({ role: 'DOCTOR', active: '1' });
    expect(UsersQuerySchema.safeParse({ role: 'SUPER_ADMIN' }).success).toBe(false);
    expect(UsersQuerySchema.safeParse({ active: 'yes' }).success).toBe(false);
    expect(SalaryQuerySchema.parse({ month: '2026-09' })).toEqual({ month: '2026-09' });
    expect(SalaryQuerySchema.safeParse({ month: '2026-9' }).success).toBe(false);
    expect(SalaryQuerySchema.safeParse({}).success).toBe(false);
  });
});

// ───────────────────────── Jadval yordamchilari ─────────────────────────

describe('schedule helpers', () => {
  const base = parseWeeklySchedule({});

  it('DAY_ORDER dushanbadan boshlanadi', () => {
    expect(DAY_ORDER).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });

  it('dayMinutes / weeklyHours (standart: Du–Ju 9–18, Sh 9–14, Ya dam = 50 soat)', () => {
    expect(dayMinutes(base[1])).toBe(540);
    expect(dayMinutes(base[6])).toBe(300);
    expect(dayMinutes(base[0])).toBe(0);
    expect(weeklyHours(base)).toBe(50);
    const withBreak = { ...base[1], breakStart: '13:00', breakEnd: '14:00' };
    expect(dayMinutes(withBreak)).toBe(480);
    const form = defaultScheduleForm();
    expect(form[1].breakStart).toBe('13:00');
    expect(form[6].breakStart).toBe('');
  });

  it('scheduleToForm boʻsh tanaffusni satr sifatida beradi', () => {
    const f = scheduleToForm(base);
    expect(f[1]).toEqual({ enabled: true, start: '09:00', end: '18:00', breakStart: '', breakEnd: '' });
  });

  it('isWorkingAt: ish vaqti, tanaffus, dam kuni', () => {
    const s = parseWeeklySchedule({ 1: { enabled: true, start: '09:00', end: '18:00', breakStart: '13:00', breakEnd: '14:00' } });
    // 2026-09-14 — dushanba
    expect(isWorkingAt(s, new Date(2026, 8, 14, 10, 0))).toBe(true);
    expect(isWorkingAt(s, new Date(2026, 8, 14, 13, 30))).toBe(false);
    expect(isWorkingAt(s, new Date(2026, 8, 14, 18, 0))).toBe(false);
    expect(isWorkingAt(s, new Date(2026, 8, 14, 8, 59))).toBe(false);
    // 2026-09-13 — yakshanba (dam)
    expect(isWorkingAt(s, new Date(2026, 8, 13, 10, 0))).toBe(false);
  });

  it('timelineBounds / ticks / daySegments', () => {
    const early = parseWeeklySchedule({ 1: { enabled: true, start: '07:30', end: '21:15' } });
    const b = timelineBounds([base, early]);
    expect(b).toEqual({ startMin: 7 * 60, endMin: 22 * 60 });
    expect(timelineBounds([])).toEqual({ startMin: 8 * 60, endMin: 20 * 60 });
    expect(timelineTicks({ startMin: 480, endMin: 1200 })).toEqual(['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00']);

    const bounds = { startMin: 8 * 60, endMin: 20 * 60 };
    const segs = daySegments({ enabled: true, start: '08:00', end: '20:00', breakStart: '13:00', breakEnd: '14:00' }, bounds);
    expect(segs).toHaveLength(2);
    expect(segs[0]?.left).toBe(0);
    expect(segs[0]?.width).toBeCloseTo((5 / 12) * 100, 5);
    expect(segs[1]?.left).toBeCloseTo(50, 5);
    expect(segs[1]?.width).toBeCloseTo(50, 5);
    expect(daySegments({ enabled: false, start: '09:00', end: '18:00' }, bounds)).toEqual([]);
    expect(daySegments({ enabled: true, start: '09:00', end: '18:00' }, bounds)).toHaveLength(1);
  });

  it('startOfWeekMonday', () => {
    expect(startOfWeekMonday(new Date(2026, 8, 13)).getDate()).toBe(7); // yakshanba → oʻtgan dushanba
    expect(startOfWeekMonday(new Date(2026, 8, 14)).getDate()).toBe(14); // dushanba
    expect(startOfWeekMonday(new Date(2026, 8, 17)).getDate()).toBe(14);
  });
});

// ───────────────────────── CSV / rang ─────────────────────────

describe('csv helpers', () => {
  it('csvCell: qoʻshtirnoq, ajratgich, formula himoyasi', () => {
    expect(csvCell('oddiy')).toBe('oddiy');
    expect(csvCell(12345)).toBe('12345');
    expect(csvCell(null)).toBe('');
    expect(csvCell('a;b')).toBe('"a;b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('-5')).toBe('-5');
    expect(csvCell('+998901234567')).toBe("'+998901234567");
  });

  it('buildCsv: BOM, `;` ajratgich, CRLF', () => {
    const out = buildCsv([
      ['Shifokor', 'Tushum'],
      ['Rahimov', 1_000_000],
    ]);
    expect(out.startsWith(CSV_BOM)).toBe(true);
    expect(out).toBe(`${CSV_BOM}Shifokor;Tushum\r\nRahimov;1000000\r\n`);
  });
});

describe('color helpers', () => {
  it('safeHex / hexToRgba', () => {
    expect(safeHex('#00d4ff')).toBe('#00D4FF');
    expect(safeHex('red')).toBe(STAFF_COLORS[0]);
    expect(safeHex(null)).toBe(STAFF_COLORS[0]);
    expect(hexToRgba('#00D4FF', 0.5)).toBe('rgba(0, 212, 255, 0.5)');
    expect(hexToRgba('bad', 1)).toBe('rgba(0, 212, 255, 1)');
  });
});

// ───────────────────────── i18n ─────────────────────────

describe('i18n staff', () => {
  it('uz va ru kalitlari bir xil', () => {
    expect(keyPaths(staff.ru as Tree).sort()).toEqual(keyPaths(staff.uz as Tree).sort());
  });

  it('kerakli kalitlar bor va boʻsh emas', () => {
    const keys = new Set(keyPaths(staff.uz as Tree));
    for (const k of [
      'title',
      'tabs.staff',
      'tabs.schedule',
      'tabs.salary',
      'newStaff',
      'form.createTitle',
      'form.login',
      'form.percent',
      'form.fixed',
      'days.short.1',
      'days.long.0',
      'schedule.title',
      'salary.title',
      'salary.export',
      'salary.csv.fileName',
      'password.title',
      'deactivate.title',
      'errors.loginTaken',
      'errors.lastAdmin',
      'errors.deactivateSelf',
      'validation.endAfterStart',
      'validation.percentMax',
    ]) {
      expect(keys.has(k), k).toBe(true);
    }
    for (const v of [...leaves(staff.uz as Tree), ...leaves(staff.ru as Tree)]) expect(v.trim().length).toBeGreaterThan(0);
  });

  it('oʻzbek matnlarida oddiy apostrof (\') ishlatilmagan', () => {
    for (const v of leaves(staff.uz as Tree)) expect(v, v).not.toMatch(/'/);
  });
});
