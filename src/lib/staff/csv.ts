/**
 * CSV yordamchisi (sof). Excel (UZ/RU lokal) uchun `;` ajratgich va UTF-8 BOM.
 */

export const CSV_BOM = '﻿';

export function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'number' ? String(v) : v;
  // Formulalarni oldini olish (=, +, -, @ bilan boshlanuvchi matn)
  const safe = /^[=+\-@]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s;
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function buildCsv(rows: Array<Array<string | number | null | undefined>>, separator = ';'): string {
  return CSV_BOM + rows.map((r) => r.map(csvCell).join(separator)).join('\r\n') + '\r\n';
}

/** Brauzerda faylni yuklab olish (Blob URL) */
export function downloadTextFile(filename: string, content: string, mime = 'text/csv;charset=utf-8'): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
