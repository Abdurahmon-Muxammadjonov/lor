import ExcelJS from 'exceljs';

/**
 * exceljs oʻz tiplarida global `Buffer` interfeysini `ArrayBuffer` bilan qoʻshib yuboradi
 * (`declare interface Buffer extends ArrayBuffer {}`), shuning uchun haqiqiy Node `Buffer`
 * `xlsx.load()` imzosiga strukturaviy jihatdan toʻgʻri kelmaydi (TS2345). Ish vaqtida esa
 * baytlar JSZip ga uzatiladi — `Buffer` ham, `Uint8Array` ham qabul qilinadi.
 * Shuning uchun tip koʻprigi faqat shu yordamchida — bitta joyda — saqlanadi.
 */
type XlsxLoadInput = Parameters<ExcelJS.Workbook['xlsx']['load']>[0];

/** .xlsx baytlari → ExcelJS.Workbook (testlarda hosil boʻlgan faylni tekshirish uchun) */
export async function loadWorkbook(data: ArrayBuffer | Uint8Array): Promise<ExcelJS.Workbook> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes as unknown as XlsxLoadInput);
  return wb;
}
