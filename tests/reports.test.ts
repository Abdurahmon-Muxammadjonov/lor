import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { loadWorkbook } from './helpers/excel';
import {
  addDaysKey,
  buildPeriods,
  daysInRange,
  debtReminderText,
  detectPreset,
  formatPeriodLabel,
  formatRangeLabel,
  isDateKey,
  monthEndKey,
  normalizeRange,
  periodBounds,
  periodKey,
  presetRange,
  previousRange,
  renderTemplate,
  suggestGroupBy,
  weekStartKey,
  MAX_RANGE_DAYS,
} from '@/lib/reports/period';
import { deltaPercent, formatCompactMoney, formatCount, formatPercent, formatQty, sharePercent } from '@/lib/reports/format';
import { allowedTabs, canViewReport } from '@/lib/reports/access';
import { DebtorsQuerySchema, ExportQuerySchema, GroupedQuerySchema, ReportQuerySchema } from '@/lib/reports/schemas';
import { buildWorkbook, columnLetter, exportFileName, moneyFormat, safeSheetName, type WorkbookMeta } from '@/lib/reports/excel';
import { reportsHref, reportsPrintHref, reportsQuery } from '@/lib/reports/url';
import { parseFileName } from '@/components/reports/use-reports';
import type {
  DebtorsReportDTO,
  DoctorsReportDTO,
  FullReportDTO,
  MedicineReportDTO,
  PatientTypesReportDTO,
  RevenueReportDTO,
  ServicesReportDTO,
  ShiftsReportDTO,
  SummaryDTO,
} from '@/lib/reports/types';

// 2026-09-16 — chorshanba (Asia/Tashkent 12:00)
const NOW = new Date('2026-09-16T07:00:00.000Z');

describe('reports — davr yordamchilari', () => {
  it('isDateKey / addDaysKey / daysInRange', () => {
    expect(isDateKey('2026-09-16')).toBe(true);
    expect(isDateKey('2026-02-30')).toBe(false);
    expect(isDateKey('2026-9-1')).toBe(false);
    expect(isDateKey(42)).toBe(false);
    expect(addDaysKey('2026-09-16', 1)).toBe('2026-09-17');
    expect(addDaysKey('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDaysKey('2028-03-01', -1)).toBe('2028-02-29');
    expect(daysInRange('2026-09-01', '2026-09-01')).toBe(1);
    expect(daysInRange('2026-09-01', '2026-09-30')).toBe(30);
  });

  it('periodKey: kun / hafta (dushanba) / oy — SQL bucketlari bilan bir xil', () => {
    expect(periodKey('2026-09-16', 'day')).toBe('2026-09-16');
    expect(weekStartKey('2026-09-16')).toBe('2026-09-14'); // chorshanba → dushanba
    expect(weekStartKey('2026-09-14')).toBe('2026-09-14'); // dushanba
    expect(weekStartKey('2026-09-20')).toBe('2026-09-14'); // yakshanba → oʻtgan dushanba
    expect(periodKey('2026-09-20', 'week')).toBe('2026-09-14');
    expect(periodKey('2026-09-16', 'month')).toBe('2026-09');
    expect(periodBounds('2026-09-14', 'week')).toEqual({ start: '2026-09-14', end: '2026-09-20' });
    expect(periodBounds('2026-02', 'month')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(periodBounds('2028-02', 'month')).toEqual({ start: '2028-02-01', end: '2028-02-29' });
    expect(monthEndKey('2026-12-05')).toBe('2026-12-31');
  });

  it('buildPeriods: boʻsh davrlar ham kiradi, chegaralar qisqartiriladi', () => {
    const days = buildPeriods('2026-09-01', '2026-09-05', 'day');
    expect(days.map((p) => p.period)).toEqual(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05']);

    const weeks = buildPeriods('2026-09-01', '2026-09-16', 'week');
    expect(weeks.map((p) => p.period)).toEqual(['2026-08-31', '2026-09-07', '2026-09-14']);
    expect(weeks[0]).toEqual({ period: '2026-08-31', start: '2026-09-01', end: '2026-09-06' });
    expect(weeks[2]).toEqual({ period: '2026-09-14', start: '2026-09-14', end: '2026-09-16' });

    const months = buildPeriods('2026-07-15', '2026-09-16', 'month');
    expect(months.map((p) => p.period)).toEqual(['2026-07', '2026-08', '2026-09']);
    expect(months[0]?.start).toBe('2026-07-15');
    expect(months[0]?.end).toBe('2026-07-31');
    expect(months[2]?.end).toBe('2026-09-16');

    expect(buildPeriods('2026-09-10', '2026-09-01', 'day')).toEqual([]);
    // Har bir kun aynan bitta bucketga tushadi
    for (const p of buildPeriods('2026-01-01', '2026-12-31', 'week')) {
      expect(periodKey(p.start, 'week')).toBe(p.period);
      expect(periodKey(p.end, 'week')).toBe(p.period);
    }
  });

  it('normalizeRange / previousRange / suggestGroupBy', () => {
    expect(normalizeRange('2026-09-10', '2026-09-01')).toEqual({ from: '2026-09-01', to: '2026-09-10' });
    const capped = normalizeRange('2020-01-01', '2026-09-16');
    expect(daysInRange(capped.from, capped.to)).toBe(MAX_RANGE_DAYS);
    expect(capped.to).toBe('2026-09-16');
    expect(previousRange({ from: '2026-09-01', to: '2026-09-07' })).toEqual({ from: '2026-08-25', to: '2026-08-31' });
    expect(previousRange({ from: '2026-09-16', to: '2026-09-16' })).toEqual({ from: '2026-09-15', to: '2026-09-15' });
    expect(suggestGroupBy({ from: '2026-09-01', to: '2026-09-16' })).toBe('day');
    expect(suggestGroupBy({ from: '2026-06-01', to: '2026-09-16' })).toBe('week');
    expect(suggestGroupBy({ from: '2026-01-01', to: '2026-09-16' })).toBe('month');
  });

  it('presetRange / detectPreset (Asia/Tashkent)', () => {
    expect(presetRange('today', NOW)).toEqual({ from: '2026-09-16', to: '2026-09-16' });
    expect(presetRange('yesterday', NOW)).toEqual({ from: '2026-09-15', to: '2026-09-15' });
    expect(presetRange('week', NOW)).toEqual({ from: '2026-09-14', to: '2026-09-16' });
    expect(presetRange('month', NOW)).toEqual({ from: '2026-09-01', to: '2026-09-16' });
    expect(presetRange('lastMonth', NOW)).toEqual({ from: '2026-08-01', to: '2026-08-31' });
    // Toshkentda allaqachon ertasi kun (UTC 20:30 = 01:30 +05)
    expect(presetRange('today', new Date('2026-09-16T20:30:00.000Z'))).toEqual({ from: '2026-09-17', to: '2026-09-17' });
    expect(detectPreset({ from: '2026-08-01', to: '2026-08-31' }, NOW)).toBe('lastMonth');
    expect(detectPreset({ from: '2026-08-02', to: '2026-08-31' }, NOW)).toBeNull();
  });

  it('formatPeriodLabel / formatRangeLabel', () => {
    expect(formatPeriodLabel({ period: '2026-09-16', start: '2026-09-16', end: '2026-09-16' }, 'day', 'uz')).toBe('16.09');
    expect(formatPeriodLabel({ period: '2026-09-14', start: '2026-09-14', end: '2026-09-20' }, 'week', 'uz')).toBe('14.09 – 20.09');
    expect(formatPeriodLabel({ period: '2026-09', start: '2026-09-01', end: '2026-09-30' }, 'month', 'ru')).toBe('Сент. 2026');
    expect(formatPeriodLabel({ period: '2026-09', start: '2026-09-01', end: '2026-09-30' }, 'month', 'uz', { long: true })).toMatch(/^Sentabr 2026$/i);
    expect(formatRangeLabel({ from: '2026-09-01', to: '2026-09-16' })).toBe('01.09.2026 – 16.09.2026');
    expect(formatRangeLabel({ from: '2026-09-16', to: '2026-09-16' })).toBe('16.09.2026');
  });

  it('renderTemplate / debtReminderText', () => {
    expect(renderTemplate('{clinic}: {name}, {amount} soʻm. Tel: {phone}', { clinic: 'Shifo', name: 'Ali', amount: '120 000', phone: '+998' })).toBe(
      'Shifo: Ali, 120 000 soʻm. Tel: +998',
    );
    expect(renderTemplate('{unknown} qoladi', {})).toBe('{unknown} qoladi');
    const uz = debtReminderText('uz', { clinic: 'Shifo LOR', name: 'Karimov A.', amount: '250 000', phone: '+998 71 200 00 00' });
    expect(uz).toContain('Shifo LOR');
    expect(uz).toContain('250 000 soʻm');
    expect(uz).not.toContain('{');
    const ru = debtReminderText('ru', { clinic: 'Shifo LOR', name: 'Каримов А.', amount: '250 000', phone: '+998 71 200 00 00' });
    expect(ru).toContain('250 000 сум');
  });
});

describe('reports — format', () => {
  it('formatCompactMoney / formatPercent / formatQty / formatCount', () => {
    expect(formatCompactMoney(1_250_000, 'uz')).toBe('1,3 mln');
    expect(formatCompactMoney(1_250_000, 'uz', 2)).toBe('1,25 mln');
    expect(formatCompactMoney(250_000, 'ru')).toBe('250 тыс.');
    expect(formatCompactMoney(-3_000_000_000, 'ru')).toBe('−3 млрд');
    expect(formatCompactMoney(999, 'uz')).toBe('999');
    expect(formatPercent(25.678)).toBe('25,7 %');
    expect(formatPercent(100)).toBe('100 %');
    expect(formatPercent(Number.NaN)).toBe('0 %');
    expect(formatQty(1.5)).toBe('1,5');
    expect(formatQty(2)).toBe('2');
    expect(formatQty(1234.5)).toBe('1 234,5');
    expect(formatCount(1234567)).toBe('1 234 567');
  });

  it('sharePercent / deltaPercent', () => {
    expect(sharePercent(1, 3)).toBe(33.33);
    expect(sharePercent(5, 0)).toBe(0);
    expect(deltaPercent(120, 100)).toBe(20);
    expect(deltaPercent(80, 100)).toBe(-20);
    expect(deltaPercent(50, 0)).toBeNull();
  });
});

describe('reports — ruxsatlar', () => {
  it('CASHIER faqat tushum / smenalar / qarzdorlar, doctors va full — reports.full', () => {
    expect(allowedTabs('CASHIER')).toEqual(['revenue', 'shifts', 'debtors']);
    expect(allowedTabs('ADMIN')).toEqual(['revenue', 'doctors', 'services', 'patient-types', 'medicine', 'shifts', 'debtors']);
    expect(allowedTabs('DOCTOR')).toEqual([]);
    expect(allowedTabs('SUPER_ADMIN')).toHaveLength(7);
    expect(canViewReport('CASHIER', 'doctors')).toBe(false);
    expect(canViewReport('CASHIER', 'full')).toBe(false);
    expect(canViewReport('CASHIER', 'services')).toBe(false);
    expect(canViewReport('CASHIER', 'revenue')).toBe(true);
    expect(canViewReport('ADMIN', 'full')).toBe(true);
    expect(canViewReport('RECEPTION', 'revenue')).toBe(false);
    expect(canViewReport(null, 'revenue')).toBe(false);
  });
});

describe('reports — zod sxemalar', () => {
  it('ReportQuerySchema: default joriy oy, from>to almashtiriladi, notoʻgʻri sana rad etiladi', () => {
    const d = ReportQuerySchema.parse({});
    expect(d.from <= d.to).toBe(true);
    expect(d.from.endsWith('-01')).toBe(true);
    expect(d.doctorId).toBeNull();
    const swapped = ReportQuerySchema.parse({ from: '2026-09-10', to: '2026-09-01', doctorId: 'doc1' });
    expect(swapped).toMatchObject({ from: '2026-09-01', to: '2026-09-10', doctorId: 'doc1' });
    expect(ReportQuerySchema.safeParse({ from: '2026-13-01' }).success).toBe(false);
    expect(GroupedQuerySchema.parse({ from: '2026-09-01', to: '2026-09-02' }).groupBy).toBe('day');
    expect(GroupedQuerySchema.safeParse({ groupBy: 'year' }).success).toBe(false);
    expect(DebtorsQuerySchema.parse({ all: '1' }).all).toBe(true);
    expect(DebtorsQuerySchema.parse({}).all).toBe(false);
    expect(ExportQuerySchema.parse({ kind: 'full', groupBy: 'month' })).toMatchObject({ kind: 'full', groupBy: 'month', all: false });
    expect(ExportQuerySchema.safeParse({ kind: 'salaries' }).success).toBe(false);
  });

  it('URL yordamchilari', () => {
    expect(reportsQuery({ tab: 'revenue', from: '2026-09-01', to: '2026-09-16', groupBy: 'day' })).toBe('?tab=revenue&from=2026-09-01&to=2026-09-16&groupBy=day');
    expect(reportsHref({ tab: 'debtors', from: '2026-09-01', to: '2026-09-16', groupBy: 'day', doctorId: 'd1', allTime: true })).toBe(
      '/dashboard/reports?tab=debtors&from=2026-09-01&to=2026-09-16&groupBy=day&doctorId=d1&all=1',
    );
    expect(reportsPrintHref({ tab: 'shifts', from: '2026-09-01', to: '2026-09-16', groupBy: 'week', auto: true })).toContain('/dashboard/reports/print?');
    expect(parseFileName(`attachment; filename="report-revenue.xlsx"; filename*=UTF-8''hisobot-tushum.xlsx`, 'x.xlsx')).toBe('hisobot-tushum.xlsx');
    expect(parseFileName('attachment; filename="report-revenue.xlsx"', 'x.xlsx')).toBe('report-revenue.xlsx');
    expect(parseFileName(null, 'x.xlsx')).toBe('x.xlsx');
  });
});

// ───────────────────────────── Excel ─────────────────────────────

const RANGE = { from: '2026-09-01', to: '2026-09-16' };
const meta: WorkbookMeta = { clinicName: 'Shifo LOR', locale: 'uz', range: RANGE, groupBy: 'day', doctorName: null, generatedAt: NOW };

const byMethod = (cash: number, card: number) =>
  [
    { method: 'CASH' as const, amount: cash, share: sharePercent(cash, cash + card) },
    { method: 'CARD' as const, amount: card, share: sharePercent(card, cash + card) },
    { method: 'TRANSFER' as const, amount: 0, share: 0 },
    { method: 'CLICK' as const, amount: 0, share: 0 },
    { method: 'PAYME' as const, amount: 0, share: 0 },
  ];

const revenueSample: RevenueReportDTO = {
  groupBy: 'day',
  range: RANGE,
  periods: [
    { period: '2026-09-01', start: '2026-09-01', end: '2026-09-01', revenue: 1_200_000, visits: 4, avgCheck: 300_000, byMethod: byMethod(800_000, 400_000) },
    { period: '2026-09-02', start: '2026-09-02', end: '2026-09-02', revenue: 0, visits: 0, avgCheck: 0, byMethod: byMethod(0, 0) },
    { period: '2026-09-03', start: '2026-09-03', end: '2026-09-03', revenue: 650_000, visits: 2, avgCheck: 325_000, byMethod: byMethod(650_000, 0) },
  ],
  totals: { revenue: 1_850_000, visits: 6, avgCheck: 308_333, byMethod: byMethod(1_450_000, 400_000) },
};

const doctorsSample: DoctorsReportDTO = {
  range: RANGE,
  rows: [
    { doctorId: 'd1', fullName: 'Rahimov Jasur', specialty: 'LOR', color: '#00D4FF', isActive: true, patients: 10, visits: 12, revenue: 1_500_000, servicesTotal: 1_600_000, avgCheck: 125_000, share: 75, salaryType: 'PERCENT', salaryValue: 30, salary: 450_000 },
    { doctorId: 'd2', fullName: 'Yusupova Malika', specialty: null, color: '#7C5CFF', isActive: true, patients: 4, visits: 4, revenue: 500_000, servicesTotal: 500_000, avgCheck: 125_000, share: 25, salaryType: 'FIXED', salaryValue: 8_000_000, salary: 8_000_000 },
  ],
  totals: { patients: 14, visits: 16, revenue: 2_000_000, servicesTotal: 2_100_000, avgCheck: 125_000, salary: 8_450_000 },
};

const servicesSample: ServicesReportDTO = {
  range: RANGE,
  rows: [
    { serviceId: 's1', code: 'N-001', name: 'Burun yuvish', nameRu: 'Промывание носа', unit: 'seans', category: { name: 'Burun', nameRu: 'Нос' }, count: 12.5, lines: 10, revenue: 1_500_000, gross: 1_600_000, discount: 100_000, share: 100, adultCount: 10, childCount: 2.5, medCount: 8, noMedCount: 4.5 },
  ],
  totals: { count: 12.5, lines: 10, revenue: 1_500_000, gross: 1_600_000, discount: 100_000, adultCount: 10, childCount: 2.5, medCount: 8 },
};

const patientTypesSample: PatientTypesReportDTO = {
  groupBy: 'month',
  range: RANGE,
  adult: { visits: 10, lines: 20, revenue: 2_000_000, share: 80 },
  child: { visits: 3, lines: 5, revenue: 500_000, share: 20 },
  total: { visits: 13, lines: 25, revenue: 2_500_000 },
  trend: [{ period: '2026-09', start: '2026-09-01', end: '2026-09-16', adult: { visits: 10, lines: 20, revenue: 2_000_000 }, child: { visits: 3, lines: 5, revenue: 500_000 } }],
};

const medicineSample: MedicineReportDTO = {
  range: RANGE,
  rows: [
    { serviceId: 's1', code: 'N-001', name: 'Burun yuvish', nameRu: 'Промывание носа', unit: 'seans', medicineOptional: true, med: { lines: 6, count: 8, revenue: 1_000_000 }, noMed: { lines: 4, count: 4.5, revenue: 500_000 }, total: { lines: 10, count: 12.5, revenue: 1_500_000 }, medShare: 64 },
  ],
  totals: { med: { lines: 6, count: 8, revenue: 1_000_000 }, noMed: { lines: 4, count: 4.5, revenue: 500_000 }, total: { lines: 10, count: 12.5, revenue: 1_500_000 }, medShare: 64 },
};

const shiftsSample: ShiftsReportDTO = {
  range: RANGE,
  rows: [
    {
      id: 'sh1',
      cashier: { id: 'c1', fullName: 'Ergashev Sardor' },
      status: 'CLOSED',
      openedAt: '2026-09-01T03:00:00.000Z',
      closedAt: '2026-09-01T15:00:00.000Z',
      openingCash: 100_000,
      closingCash: 880_000,
      totals: { CASH: 800_000, CARD: 400_000, TRANSFER: 0, CLICK: 0, PAYME: 0 },
      total: 1_200_000,
      expectedCash: 900_000,
      difference: -20_000,
      paymentsCount: 5,
      note: null,
    },
  ],
  totals: { totals: { CASH: 800_000, CARD: 400_000, TRANSFER: 0, CLICK: 0, PAYME: 0 }, total: 1_200_000, difference: -20_000, count: 1, open: 0 },
};

const debtorsSample: DebtorsReportDTO = {
  range: RANGE,
  allTime: false,
  rows: [
    { patient: { id: 'p1', fullName: 'Karimov Ali', cardNumber: '2026-00001', phone: '+998901234567', smsConsent: true }, visits: 2, totalDebt: 350_000, lastVisit: '2026-09-10T05:00:00.000Z', lastVisitId: 'v1', lastSmsAt: null },
  ],
  total: 350_000,
  count: 1,
};

const summarySample: SummaryDTO = {
  range: RANGE,
  previousRange: { from: '2026-08-16', to: '2026-08-31' },
  revenue: 1_850_000,
  visits: 6,
  patients: 5,
  newPatients: 2,
  avgCheck: 308_333,
  debt: 350_000,
  discount: 100_000,
  servicesTotal: 2_100_000,
  previous: { revenue: 1_000_000, visits: 4, patients: 4, newPatients: 1, avgCheck: 250_000, debt: 0, discount: 0, servicesTotal: 1_000_000 },
  deltas: { revenue: 85, visits: 50, patients: 25, avgCheck: 23.3, debt: null },
  byMethod: byMethod(1_450_000, 400_000),
};

const fullSample: FullReportDTO = {
  summary: summarySample,
  revenue: revenueSample,
  doctors: doctorsSample,
  services: servicesSample,
  patientTypes: patientTypesSample,
  medicine: medicineSample,
  shifts: shiftsSample,
  debtors: debtorsSample,
};

async function load(buf: Buffer): Promise<ExcelJS.Workbook> {
  return loadWorkbook(buf);
}

describe('reports — Excel', () => {
  it('yordamchilar: ustun harfi, varaq nomi, pul formati, fayl nomi', () => {
    expect(columnLetter(1)).toBe('A');
    expect(columnLetter(26)).toBe('Z');
    expect(columnLetter(27)).toBe('AA');
    expect(safeSheetName('Tushum / 2026: [test]?*')).toBe('Tushum   2026   test');
    expect(safeSheetName('x'.repeat(40))).toHaveLength(31);
    expect(moneyFormat('uz')).toBe('#,##0 "soʻm"');
    expect(moneyFormat('ru')).toBe('#,##0 "сум"');
    const names = exportFileName('revenue', RANGE, 'uz');
    expect(names.ascii).toBe('report-revenue-2026-09-01_2026-09-16.xlsx');
    expect(names.utf8).toBe('hisobot-tushum-2026-09-01_2026-09-16.xlsx');
    expect(exportFileName('patient-types', RANGE, 'ru').utf8).toBe('otchet-взрослые-дети-2026-09-01_2026-09-16.xlsx');
    expect(exportFileName('full', RANGE, 'uz').utf8).toContain('toʻliq');
  });

  it('revenue: bitta varaq, sarlavha uslubi, pul formati, jami qatori (SUM formulasi)', async () => {
    const buf = await buildWorkbook('revenue', revenueSample, meta);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.byteLength).toBeGreaterThan(1000);
    const wb = await load(buf);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Tushum']);
    const ws = wb.getWorksheet('Tushum');
    expect(ws).toBeDefined();
    if (!ws) return;
    expect(String(ws.getCell('A1').value)).toContain('Shifo LOR');
    expect(String(ws.getCell('A2').value)).toContain('01.09.2026 – 16.09.2026');
    const header = ws.getRow(4);
    expect(header.getCell(1).value).toBe('Davr');
    expect(header.getCell(2).value).toBe('Tushum');
    expect(header.getCell(1).font?.bold).toBe(true);
    const fill = header.getCell(1).fill;
    expect(fill.type).toBe('pattern');
    if (fill.type === 'pattern') expect(fill.fgColor?.argb).toBe('FF1F2A40');
    // Maʼlumot qatorlari
    expect(ws.getCell('B5').value).toBe(1_200_000);
    expect(ws.getCell('B5').numFmt).toBe('#,##0 "soʻm"');
    expect(ws.getCell('C5').value).toBe(4);
    expect(ws.getCell('E5').value).toBe(800_000); // CASH
    // Jami qatori: 3 qatordan keyin (5..7) → 8
    const totalRow = ws.getRow(8);
    expect(totalRow.getCell(1).value).toBe('Jami');
    const sumCell = totalRow.getCell(2).value;
    expect(sumCell && typeof sumCell === 'object' && 'formula' in sumCell ? sumCell.formula : null).toBe('SUM(B5:B7)');
    expect(sumCell && typeof sumCell === 'object' && 'result' in sumCell ? sumCell.result : null).toBe(1_850_000);
    expect(totalRow.getCell(4).value).toBe(308_333); // avgCheck — tayyor qiymat
    expect(totalRow.getCell(1).font?.bold).toBe(true);
    // Ustun kengligi avtomatik
    expect(ws.getColumn(1).width ?? 0).toBeGreaterThanOrEqual(10);
    expect(ws.getColumn(2).width ?? 0).toBeGreaterThan(ws.getColumn(3).width ?? 0);
    expect(ws.views[0]?.state).toBe('frozen');
  });

  it('doctors / services / shifts / debtors — ruscha varaqlar va ustunlar', async () => {
    const ru: WorkbookMeta = { ...meta, locale: 'ru', doctorName: 'Рахимов Ж.' };
    const wbD = await load(await buildWorkbook('doctors', doctorsSample, ru));
    const wsD = wbD.getWorksheet('Врачи');
    expect(wsD).toBeDefined();
    expect(String(wsD?.getCell('A2').value)).toContain('Рахимов Ж.');
    expect(wsD?.getCell('A5').value).toBe('Rahimov Jasur (LOR)');
    expect(wsD?.getCell('H5').numFmt).toBe('#,##0 "сум"');
    expect(wsD?.getCell('G7').value).toBe(100); // ulush jami

    const wbS = await load(await buildWorkbook('services', servicesSample, ru));
    const wsS = wbS.getWorksheet('Процедуры');
    expect(wsS?.getCell('B5').value).toBe('Промывание носа');
    expect(wsS?.getCell('D5').value).toBe(12.5);
    expect(wsS?.getCell('D5').numFmt).toBe('#,##0.0');

    const wbSh = await load(await buildWorkbook('shifts', shiftsSample, meta));
    const wsSh = wbSh.getWorksheet('Smenalar');
    expect(wsSh?.getCell('B5').value).toBe('Yopiq');
    expect(wsSh?.getCell('N5').value).toBe(-20_000);

    const wbDb = await load(await buildWorkbook('debtors', debtorsSample, meta));
    const wsDb = wbDb.getWorksheet('Qarzdorlar');
    expect(wsDb?.getCell('B5').value).toBe('Karimov Ali');
    expect(wsDb?.getCell('E5').value).toBe(350_000);
  });

  it('full: har boʻlim alohida varaqda (8 ta), xulosa varagʻi jami qatorisiz', async () => {
    const wb = await load(await buildWorkbook('full', fullSample, meta));
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Xulosa', 'Tushum', 'Shifokorlar', 'Muolajalar', 'Kattalar-bolalar', 'Dori sarfi', 'Smenalar', 'Qarzdorlar']);
    const sum = wb.getWorksheet('Xulosa');
    expect(sum?.getCell('A5').value).toBe('Tushum');
    expect(sum?.getCell('B5').value).toBe(1_850_000);
    expect(sum?.getCell('C5').value).toBe(1_000_000);
    expect(String(sum?.getCell('A12').value)).toContain('Toʻlov usullari');
    expect(sum?.getCell('A16').value).toBe('Toʻlov usullari: Payme');
    expect(sum?.getCell('A17').value ?? null).toBeNull(); // jami qatori yoʻq
    const pt = wb.getWorksheet('Kattalar-bolalar');
    expect(pt?.getCell('D6').value).toBe(2_000_000);
  });

  it('boʻsh hisobot ham yaroqli fayl beradi', async () => {
    const empty: RevenueReportDTO = { ...revenueSample, periods: [], totals: { revenue: 0, visits: 0, avgCheck: 0, byMethod: byMethod(0, 0) } };
    const wb = await load(await buildWorkbook('revenue', empty, meta));
    const ws = wb.getWorksheet('Tushum');
    expect(ws?.getRow(4).getCell(1).value).toBe('Davr');
    expect(ws?.getRow(5).getCell(1).value).toBe('Jami');
  });
});
