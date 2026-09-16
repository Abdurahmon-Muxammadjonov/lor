import ExcelJS from 'exceljs';
import type { PayMethod } from '@prisma/client';
import type { Locale } from '@/i18n/config';
import { getMessages } from '@/i18n/messages';
import { makeT, type TFunction } from '@/i18n/t';
import { fmtDateTime } from '@/lib/date';
import { formatPeriodLabel, formatRangeLabel } from './period';
import {
  PAY_METHODS,
  type DebtorsReportDTO,
  type DoctorsReportDTO,
  type FullReportDTO,
  type GroupBy,
  type MedicineReportDTO,
  type PatientTypesReportDTO,
  type ReportDataMap,
  type ReportKind,
  type ReportRange,
  type RevenueReportDTO,
  type ServicesReportDTO,
  type ShiftsReportDTO,
  type SummaryDTO,
} from './types';

/**
 * Excel eksport (exceljs): sarlavha (toʻq fon, qalin), pul formati `#,##0 "soʻm"` (lokal minglar ajratgichi),
 * ustun kengligi avtomatik, jami qatori (SUM formulasi + hisoblangan qiymat), `full` — har boʻlim alohida varaqda.
 */

export interface WorkbookMeta {
  clinicName: string;
  locale: Locale;
  range: ReportRange;
  groupBy?: GroupBy;
  doctorName?: string | null;
  generatedAt?: Date;
}

type CellValue = string | number | null;

interface ColumnSpec {
  header: string;
  /** money — pul formati; qty — 1 kasr; int — butun; percent — foiz; text */
  kind: 'money' | 'qty' | 'int' | 'percent' | 'text' | 'date';
  /** Jami qatorida: sum — SUM formulasi, value — tayyor qiymat, none — boʻsh */
  total?: 'sum' | 'none';
}

interface SheetSpec {
  name: string;
  columns: ColumnSpec[];
  rows: CellValue[][];
  /** Tayyor jami qiymatlari (ustun boʻyicha); berilmagan money/qty/int ustunlar SUM bilan hisoblanadi */
  totals?: (CellValue | undefined)[];
  /** Jami qatorini yashirish */
  noTotals?: boolean;
}

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2A40' } };
const TOTAL_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEFF' } };
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFEAF0FF' }, size: 11 };
const TITLE_FONT: Partial<ExcelJS.Font> = { bold: true, size: 14, color: { argb: 'FF0D1220' } };
const META_FONT: Partial<ExcelJS.Font> = { color: { argb: 'FF5B6B8C' }, size: 10 };
const THIN: ExcelJS.Border = { style: 'thin', color: { argb: 'FFB8C4DE' } };

export function moneyFormat(locale: Locale): string {
  return locale === 'ru' ? '#,##0 "сум"' : '#,##0 "soʻm"';
}
const QTY_FORMAT = '#,##0.0';
const INT_FORMAT = '#,##0';
const PERCENT_FORMAT = '0.00" %"';

/** Excel varaq nomi: 31 belgigacha, taqiqlangan belgilarsiz */
export function safeSheetName(name: string): string {
  return name.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'Sheet';
}

export function columnLetter(index1: number): string {
  let n = index1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function tFor(locale: Locale): TFunction {
  return makeT(getMessages(), locale);
}

function methodLabel(t: TFunction, m: PayMethod): string {
  return t(`common.payMethod.${m}`);
}

function displayLength(v: CellValue, kind: ColumnSpec['kind']): number {
  if (v === null || v === undefined) return 1;
  if (typeof v === 'number') {
    const digits = Math.round(Math.abs(v)).toString().length;
    const grouped = digits + Math.floor((digits - 1) / 3);
    if (kind === 'money') return grouped + 6;
    if (kind === 'percent') return grouped + 5;
    if (kind === 'qty') return grouped + 2;
    return grouped;
  }
  return String(v).length;
}

function writeSheet(wb: ExcelJS.Workbook, spec: SheetSpec, meta: WorkbookMeta, t: TFunction): ExcelJS.Worksheet {
  const ws = wb.addWorksheet(safeSheetName(spec.name), { views: [{ state: 'frozen', ySplit: 4 }] });
  const colCount = Math.max(1, spec.columns.length);
  const lastCol = columnLetter(colCount);

  // 1: sarlavha, 2: meta, 3: boʻsh, 4: ustun sarlavhalari
  ws.mergeCells(`A1:${lastCol}1`);
  const titleCell = ws.getCell('A1');
  titleCell.value = `${spec.name} — ${meta.clinicName}`;
  titleCell.font = TITLE_FONT;
  titleCell.alignment = { vertical: 'middle' };
  ws.getRow(1).height = 24;

  ws.mergeCells(`A2:${lastCol}2`);
  const metaParts = [
    `${t('reports.excel.meta.period')}: ${formatRangeLabel(meta.range)}`,
    `${t('reports.excel.meta.doctor')}: ${meta.doctorName ?? t('reports.excel.meta.allDoctors')}`,
    `${t('reports.excel.meta.generated')}: ${fmtDateTime(meta.generatedAt ?? new Date(), meta.locale)}`,
  ];
  if (meta.groupBy) metaParts.splice(1, 0, `${t('reports.excel.meta.groupBy')}: ${t(`reports.toolbar.${meta.groupBy}`)}`);
  const metaCell = ws.getCell('A2');
  metaCell.value = metaParts.join('   ·   ');
  metaCell.font = META_FONT;

  const headerRow = ws.getRow(4);
  spec.columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: c.kind === 'text' || c.kind === 'date' ? 'left' : 'right', wrapText: true };
    cell.border = { bottom: THIN };
  });
  headerRow.height = 22;

  const firstDataRow = 5;
  spec.rows.forEach((r, ri) => {
    const row = ws.getRow(firstDataRow + ri);
    spec.columns.forEach((c, ci) => {
      const cell = row.getCell(ci + 1);
      const v = r[ci] ?? null;
      cell.value = v;
      applyFormat(cell, c.kind, meta.locale);
    });
  });

  const lastDataRow = firstDataRow + spec.rows.length - 1;
  if (!spec.noTotals) {
    const totalRow = ws.getRow(Math.max(lastDataRow + 1, firstDataRow));
    spec.columns.forEach((c, ci) => {
      const cell = totalRow.getCell(ci + 1);
      const preset = spec.totals?.[ci];
      if (ci === 0 && preset === undefined) {
        cell.value = t('common.total');
      } else if (preset !== undefined) {
        cell.value = preset;
        applyFormat(cell, c.kind, meta.locale);
      } else if ((c.kind === 'money' || c.kind === 'qty' || c.kind === 'int') && c.total !== 'none' && spec.rows.length > 0) {
        const col = columnLetter(ci + 1);
        const sum = spec.rows.reduce((s, r) => s + (typeof r[ci] === 'number' ? (r[ci] as number) : 0), 0);
        cell.value = { formula: `SUM(${col}${firstDataRow}:${col}${lastDataRow})`, result: Math.round(sum * 10) / 10 };
        applyFormat(cell, c.kind, meta.locale);
      } else {
        cell.value = null;
      }
      cell.font = { bold: true, color: { argb: 'FF0D1220' } };
      cell.fill = TOTAL_FILL;
      cell.border = { top: THIN, bottom: THIN };
    });
  }

  // Ustun kengligi
  spec.columns.forEach((c, ci) => {
    let max = displayLength(c.header, 'text');
    for (const r of spec.rows) max = Math.max(max, displayLength(r[ci] ?? null, c.kind));
    const preset = spec.totals?.[ci];
    if (preset !== undefined) max = Math.max(max, displayLength(preset, c.kind));
    ws.getColumn(ci + 1).width = Math.min(60, Math.max(10, max + 2));
  });
  ws.autoFilter = spec.rows.length > 0 ? { from: { row: 4, column: 1 }, to: { row: 4, column: colCount } } : undefined;
  return ws;
}

function applyFormat(cell: ExcelJS.Cell, kind: ColumnSpec['kind'], locale: Locale): void {
  switch (kind) {
    case 'money':
      cell.numFmt = moneyFormat(locale);
      cell.alignment = { horizontal: 'right' };
      break;
    case 'qty':
      cell.numFmt = QTY_FORMAT;
      cell.alignment = { horizontal: 'right' };
      break;
    case 'int':
      cell.numFmt = INT_FORMAT;
      cell.alignment = { horizontal: 'right' };
      break;
    case 'percent':
      cell.numFmt = PERCENT_FORMAT;
      cell.alignment = { horizontal: 'right' };
      break;
    default:
      cell.alignment = { horizontal: 'left', vertical: 'top' };
  }
}

// ───────────────────────────── Boʻlim spesifikatsiyalari ─────────────────────────────

function summarySheet(d: SummaryDTO, meta: WorkbookMeta, t: TFunction): SheetSpec {
  const rows: CellValue[][] = [
    [t('reports.kpi.revenue'), d.revenue, d.previous.revenue],
    [t('reports.kpi.visits'), d.visits, d.previous.visits],
    [t('reports.kpi.patients'), d.patients, d.previous.patients],
    [t('reports.kpi.avgCheck'), d.avgCheck, d.previous.avgCheck],
    [t('reports.kpi.debt'), d.debt, d.previous.debt],
    [t('reports.kpi.discount'), d.discount, d.previous.discount],
    [t('reports.kpi.servicesTotal'), d.servicesTotal, d.previous.servicesTotal],
    ...d.byMethod.map((m): CellValue[] => [`${t('reports.revenue.methodsTitle')}: ${methodLabel(t, m.method)}`, m.amount, null]),
  ];
  return {
    name: t('reports.excel.sheets.summary'),
    columns: [
      { header: t('reports.excel.meta.indicator'), kind: 'text' },
      { header: `${t('reports.excel.meta.value')} (${formatRangeLabel(meta.range)})`, kind: 'money', total: 'none' },
      { header: `${t('reports.excel.meta.previous')} (${formatRangeLabel(d.previousRange)})`, kind: 'money', total: 'none' },
    ],
    rows,
    noTotals: true,
  };
}

function revenueSheet(d: RevenueReportDTO, meta: WorkbookMeta, t: TFunction): SheetSpec {
  return {
    name: t('reports.excel.sheets.revenue'),
    columns: [
      { header: t('reports.columns.period'), kind: 'text' },
      { header: t('reports.columns.revenue'), kind: 'money' },
      { header: t('reports.columns.visits'), kind: 'int' },
      { header: t('reports.columns.avgCheck'), kind: 'money', total: 'none' },
      ...PAY_METHODS.map((m): ColumnSpec => ({ header: methodLabel(t, m), kind: 'money' })),
    ],
    rows: d.periods.map((p): CellValue[] => [
      formatPeriodLabel(p, d.groupBy, meta.locale, { long: true }),
      p.revenue,
      p.visits,
      p.avgCheck,
      ...PAY_METHODS.map((m) => p.byMethod.find((b) => b.method === m)?.amount ?? 0),
    ]),
    totals: [undefined, undefined, undefined, d.totals.avgCheck],
  };
}

function doctorsSheet(d: DoctorsReportDTO, _meta: WorkbookMeta, t: TFunction): SheetSpec {
  return {
    name: t('reports.excel.sheets.doctors'),
    columns: [
      { header: t('reports.doctors.doctor'), kind: 'text' },
      { header: t('reports.doctors.patients'), kind: 'int' },
      { header: t('reports.doctors.visits'), kind: 'int' },
      { header: t('reports.doctors.revenue'), kind: 'money' },
      { header: t('reports.doctors.servicesTotal'), kind: 'money' },
      { header: t('reports.doctors.avgCheck'), kind: 'money', total: 'none' },
      { header: `${t('reports.doctors.share')}, %`, kind: 'percent' },
      { header: t('reports.doctors.salary'), kind: 'money' },
    ],
    rows: d.rows.map((r): CellValue[] => [
      r.specialty ? `${r.fullName} (${r.specialty})` : r.fullName,
      r.patients,
      r.visits,
      r.revenue,
      r.servicesTotal,
      r.avgCheck,
      r.share,
      r.salary,
    ]),
    totals: [undefined, undefined, undefined, undefined, undefined, d.totals.avgCheck, d.rows.length > 0 ? 100 : 0],
  };
}

function servicesSheet(d: ServicesReportDTO, meta: WorkbookMeta, t: TFunction): SheetSpec {
  const ru = meta.locale === 'ru';
  return {
    name: t('reports.excel.sheets.services'),
    columns: [
      { header: t('common.code'), kind: 'text' },
      { header: t('reports.services.service'), kind: 'text' },
      { header: t('reports.services.category'), kind: 'text' },
      { header: t('reports.services.count'), kind: 'qty' },
      { header: t('reports.services.lines'), kind: 'int' },
      { header: t('reports.services.revenue'), kind: 'money' },
      { header: t('reports.services.discount'), kind: 'money' },
      { header: `${t('reports.services.share')}, %`, kind: 'percent' },
      { header: t('reports.services.adult'), kind: 'qty' },
      { header: t('reports.services.child'), kind: 'qty' },
      { header: t('reports.services.withMed'), kind: 'qty' },
    ],
    rows: d.rows.map((r): CellValue[] => [
      r.code,
      ru ? r.nameRu || r.name : r.name,
      r.category ? (ru ? r.category.nameRu : r.category.name) : null,
      r.count,
      r.lines,
      r.revenue,
      r.discount,
      r.share,
      r.adultCount,
      r.childCount,
      r.medCount,
    ]),
    totals: [undefined, null, null, undefined, undefined, undefined, undefined, d.rows.length > 0 ? 100 : 0],
  };
}

function patientTypesSheet(d: PatientTypesReportDTO, meta: WorkbookMeta, t: TFunction): SheetSpec {
  return {
    name: t('reports.excel.sheets.patientTypes'),
    columns: [
      { header: t('reports.columns.period'), kind: 'text' },
      { header: t('reports.patientTypes.adultVisits'), kind: 'int' },
      { header: `${t('reports.patientTypes.adult')}: ${t('reports.patientTypes.lines')}`, kind: 'int' },
      { header: t('reports.patientTypes.adultRevenue'), kind: 'money' },
      { header: t('reports.patientTypes.childVisits'), kind: 'int' },
      { header: `${t('reports.patientTypes.child')}: ${t('reports.patientTypes.lines')}`, kind: 'int' },
      { header: t('reports.patientTypes.childRevenue'), kind: 'money' },
    ],
    rows: d.trend.map((p): CellValue[] => [
      formatPeriodLabel(p, d.groupBy, meta.locale, { long: true }),
      p.adult.visits,
      p.adult.lines,
      p.adult.revenue,
      p.child.visits,
      p.child.lines,
      p.child.revenue,
    ]),
    totals: [undefined, d.adult.visits, d.adult.lines, d.adult.revenue, d.child.visits, d.child.lines, d.child.revenue],
  };
}

function medicineSheet(d: MedicineReportDTO, meta: WorkbookMeta, t: TFunction): SheetSpec {
  const ru = meta.locale === 'ru';
  return {
    name: t('reports.excel.sheets.medicine'),
    columns: [
      { header: t('common.code'), kind: 'text' },
      { header: t('reports.medicine.service'), kind: 'text' },
      { header: `${t('reports.medicine.withMed')}: ${t('reports.medicine.qty')}`, kind: 'qty' },
      { header: `${t('reports.medicine.withMed')}: ${t('reports.medicine.revenue')}`, kind: 'money' },
      { header: `${t('reports.medicine.withoutMed')}: ${t('reports.medicine.qty')}`, kind: 'qty' },
      { header: `${t('reports.medicine.withoutMed')}: ${t('reports.medicine.revenue')}`, kind: 'money' },
      { header: `${t('common.total')}: ${t('reports.medicine.qty')}`, kind: 'qty' },
      { header: `${t('reports.medicine.medShare')}, %`, kind: 'percent' },
      { header: t('reports.medicine.alwaysMed'), kind: 'text' },
    ],
    rows: d.rows.map((r): CellValue[] => [
      r.code,
      ru ? r.nameRu || r.name : r.name,
      r.med.count,
      r.med.revenue,
      r.noMed.count,
      r.noMed.revenue,
      r.total.count,
      r.medShare,
      r.medicineOptional ? t('reports.excel.no') : t('reports.excel.yes'),
    ]),
    totals: [undefined, null, undefined, undefined, undefined, undefined, undefined, d.totals.medShare, null],
  };
}

function shiftsSheet(d: ShiftsReportDTO, meta: WorkbookMeta, t: TFunction): SheetSpec {
  return {
    name: t('reports.excel.sheets.shifts'),
    columns: [
      { header: t('reports.shifts.cashier'), kind: 'text' },
      { header: t('reports.shifts.status'), kind: 'text' },
      { header: t('reports.shifts.opened'), kind: 'date' },
      { header: t('reports.shifts.closed'), kind: 'date' },
      { header: t('reports.shifts.openingCash'), kind: 'money', total: 'none' },
      ...PAY_METHODS.map((m): ColumnSpec => ({ header: methodLabel(t, m), kind: 'money' })),
      { header: t('reports.shifts.total'), kind: 'money' },
      { header: t('reports.shifts.expectedCash'), kind: 'money', total: 'none' },
      { header: t('reports.shifts.closingCash'), kind: 'money', total: 'none' },
      { header: t('reports.shifts.difference'), kind: 'money' },
      { header: t('reports.shifts.payments'), kind: 'int' },
      { header: t('reports.shifts.note'), kind: 'text' },
    ],
    rows: d.rows.map((r): CellValue[] => [
      r.cashier.fullName,
      r.status === 'OPEN' ? t('reports.shifts.open') : t('reports.shifts.closedStatus'),
      fmtDateTime(r.openedAt, meta.locale),
      r.closedAt ? fmtDateTime(r.closedAt, meta.locale) : null,
      r.openingCash,
      ...PAY_METHODS.map((m) => r.totals[m]),
      r.total,
      r.expectedCash,
      r.closingCash,
      r.difference,
      r.paymentsCount,
      r.note,
    ]),
  };
}

function debtorsSheet(d: DebtorsReportDTO, meta: WorkbookMeta, t: TFunction): SheetSpec {
  return {
    name: t('reports.excel.sheets.debtors'),
    columns: [
      { header: t('common.cardNumber'), kind: 'text' },
      { header: t('reports.debtors.patient'), kind: 'text' },
      { header: t('reports.debtors.phone'), kind: 'text' },
      { header: t('reports.debtors.visits'), kind: 'int' },
      { header: t('reports.debtors.debt'), kind: 'money' },
      { header: t('reports.debtors.lastVisit'), kind: 'date' },
      { header: t('reports.debtors.lastSms'), kind: 'date' },
    ],
    rows: d.rows.map((r): CellValue[] => [
      r.patient.cardNumber,
      r.patient.fullName,
      r.patient.phone,
      r.visits,
      r.totalDebt,
      fmtDateTime(r.lastVisit, meta.locale),
      r.lastSmsAt ? fmtDateTime(r.lastSmsAt, meta.locale) : null,
    ]),
  };
}

function sheetsFor<K extends ReportKind>(kind: K, data: ReportDataMap[K], meta: WorkbookMeta, t: TFunction): SheetSpec[] {
  switch (kind) {
    case 'revenue':
      return [revenueSheet(data as RevenueReportDTO, meta, t)];
    case 'doctors':
      return [doctorsSheet(data as DoctorsReportDTO, meta, t)];
    case 'services':
      return [servicesSheet(data as ServicesReportDTO, meta, t)];
    case 'patient-types':
      return [patientTypesSheet(data as PatientTypesReportDTO, meta, t)];
    case 'medicine':
      return [medicineSheet(data as MedicineReportDTO, meta, t)];
    case 'shifts':
      return [shiftsSheet(data as ShiftsReportDTO, meta, t)];
    case 'debtors':
      return [debtorsSheet(data as DebtorsReportDTO, meta, t)];
    case 'full': {
      const f = data as FullReportDTO;
      return [
        summarySheet(f.summary, meta, t),
        revenueSheet(f.revenue, meta, t),
        doctorsSheet(f.doctors, meta, t),
        servicesSheet(f.services, meta, t),
        patientTypesSheet(f.patientTypes, meta, t),
        medicineSheet(f.medicine, meta, t),
        shiftsSheet(f.shifts, meta, t),
        debtorsSheet(f.debtors, meta, t),
      ];
    }
    default:
      return [];
  }
}

/** Hisobot → .xlsx Buffer */
export async function buildWorkbook<K extends ReportKind>(kind: K, data: ReportDataMap[K], meta: WorkbookMeta): Promise<Buffer> {
  const t = tFor(meta.locale);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'LOR CRM';
  wb.created = meta.generatedAt ?? new Date();
  for (const spec of sheetsFor(kind, data, meta, t)) writeSheet(wb, spec, meta, t);
  const out = await wb.xlsx.writeBuffer();
  return Buffer.from(out as ArrayBuffer);
}

/** Fayl nomi: "hisobot-tushum-2026-09-01_2026-09-15.xlsx" (ASCII versiyasi Content-Disposition uchun) */
export function exportFileName(kind: ReportKind, range: ReportRange, locale: Locale): { ascii: string; utf8: string } {
  const t = tFor(locale);
  const sheetKey = kind === 'patient-types' ? 'patientTypes' : kind === 'full' ? 'summary' : kind;
  const label = kind === 'full' ? (locale === 'ru' ? 'полный' : 'toʻliq') : t(`reports.excel.sheets.${sheetKey}`);
  const base = `${t('reports.excel.fileName')}-${label}-${range.from}_${range.to}`.toLowerCase().replace(/\s+/g, '-');
  const utf8 = `${base}.xlsx`;
  const ascii = `report-${kind}-${range.from}_${range.to}.xlsx`;
  return { ascii, utf8 };
}
