import ExcelJS from 'exceljs';
import type { Locale } from '@/i18n/config';
import { getMessages, makeT } from '@/i18n';
import { toMoneyNumber } from '@/lib/money';
import type { ServiceRow } from './service';

/**
 * Narxlar roʻyxati (price list) — Excel (exceljs). Sarlavhalar joriy tilda, narxlar butun soʻm (raqam formatida).
 */

export interface PriceListOptions {
  clinicName: string;
  locale: Locale;
  /** Fayl nomi uchun sana (YYYY-MM-DD) */
  dateKey: string;
}

const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0D1220' } };
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFEAF0FF' }, size: 11 };
const MONEY_FMT = '#,##0';

export async function buildPriceListWorkbook(services: ServiceRow[], opts: PriceListOptions): Promise<ExcelJS.Buffer> {
  const t = makeT(getMessages(), opts.locale);
  const yes = t('common.yes');
  const no = t('common.no');

  const wb = new ExcelJS.Workbook();
  wb.creator = 'LOR CRM';
  wb.created = new Date();

  const ws = wb.addWorksheet(t('services.export.sheet'), {
    views: [{ state: 'frozen', ySplit: 3 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const columns: { header: string; key: string; width: number }[] = [
    { header: t('common.category'), key: 'category', width: 26 },
    { header: t('common.code'), key: 'code', width: 9 },
    { header: t('services.export.nameUz'), key: 'name', width: 40 },
    { header: t('services.export.nameRu'), key: 'nameRu', width: 40 },
    { header: t('services.fields.unit'), key: 'unit', width: 9 },
    { header: t('services.prices.adultNoMed'), key: 'priceAdultNoMed', width: 18 },
    { header: t('services.prices.adultMed'), key: 'priceAdultMed', width: 18 },
    { header: t('services.prices.childNoMed'), key: 'priceChildNoMed', width: 18 },
    { header: t('services.prices.childMed'), key: 'priceChildMed', width: 18 },
    { header: t('services.fields.durationShort'), key: 'durationMin', width: 12 },
    { header: t('services.fields.allowHalf'), key: 'allowHalf', width: 12 },
    { header: t('services.fields.medicineOptional'), key: 'medicineOptional', width: 14 },
    { header: t('common.status'), key: 'status', width: 10 },
  ];

  // 1-qator: sarlavha (klinika + sana); 2-qator: boʻsh; 3-qator: ustun nomlari
  ws.mergeCells(1, 1, 1, columns.length);
  const title = ws.getCell(1, 1);
  title.value = `${opts.clinicName} — ${t('services.export.title')} (${opts.dateKey})`;
  title.font = { bold: true, size: 14 };
  title.alignment = { vertical: 'middle' };
  ws.getRow(1).height = 24;

  const headerRow = ws.getRow(3);
  columns.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.header;
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: 'middle', horizontal: i >= 5 && i <= 9 ? 'right' : 'left', wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: 'FF1F2A40' } } };
    ws.getColumn(i + 1).width = c.width;
  });
  headerRow.height = 30;

  const unitLabel = (u: string) => t(`services.units.${u}`);
  const catName = (s: ServiceRow) => (opts.locale === 'ru' ? s.category.nameRu : s.category.name);

  services.forEach((s, idx) => {
    const row = ws.getRow(4 + idx);
    const values: (string | number)[] = [
      catName(s),
      s.code,
      s.name,
      s.nameRu,
      unitLabel(s.unit),
      toMoneyNumber(s.priceAdultNoMed),
      toMoneyNumber(s.priceAdultMed),
      toMoneyNumber(s.priceChildNoMed),
      toMoneyNumber(s.priceChildMed),
      s.durationMin,
      s.allowHalf ? yes : no,
      s.medicineOptional ? yes : no,
      s.isActive ? t('common.active') : t('common.inactive'),
    ];
    values.forEach((v, i) => {
      const cell = row.getCell(i + 1);
      cell.value = v;
      if (i >= 5 && i <= 8) {
        cell.numFmt = MONEY_FMT;
        cell.alignment = { horizontal: 'right' };
      }
      if (i === 9) cell.alignment = { horizontal: 'right' };
    });
    if (!s.isActive) row.font = { color: { argb: 'FF8A99B8' }, italic: true };
  });

  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3 + services.length, column: columns.length } };

  return wb.xlsx.writeBuffer();
}

export function priceListFileName(dateKey: string): string {
  return `narxlar-${dateKey}.xlsx`;
}
