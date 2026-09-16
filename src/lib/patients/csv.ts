/**
 * CSV yigʻuvchi (Excel-mos): UTF-8 BOM, `;` ajratgich, CRLF, barcha maydonlar qoʻshtirnoqda.
 * Formulaga oʻxshash qiymatlar (=, +, -, @) oldiga apostrof qoʻyiladi (CSV injection himoyasi).
 */

export const CSV_BOM = '\uFEFF';
export const CSV_SEPARATOR = ';';
export const CSV_EOL = '\r\n';

export type CsvCell = string | number | boolean | null | undefined;

export function escapeCsvCell(v: CsvCell): string {
  if (v === null || v === undefined) return '""';
  let s = typeof v === 'string' ? v : String(v);
  s = s.replace(/[\r\n]+/g, ' ');
  if (/^[=+\-@\t]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function buildCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers, ...rows].map((r) => r.map(escapeCsvCell).join(CSV_SEPARATOR));
  return CSV_BOM + lines.join(CSV_EOL) + CSV_EOL;
}
