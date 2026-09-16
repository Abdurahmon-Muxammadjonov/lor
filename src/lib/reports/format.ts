import type { Locale } from '@/i18n/config';

/** 1 250 000 → "1,25 mln" / "1,25 млн"; 250 000 → "250 ming" / "250 тыс." (oʻq belgilari, ixcham kartalar) */
export function formatCompactMoney(n: number, locale: Locale, digits = 1): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 1_000_000_000) return `${sign}${trimZero((abs / 1_000_000_000).toFixed(digits))} ${locale === 'ru' ? 'млрд' : 'mlrd'}`;
  if (abs >= 1_000_000) return `${sign}${trimZero((abs / 1_000_000).toFixed(digits))} ${locale === 'ru' ? 'млн' : 'mln'}`;
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)} ${locale === 'ru' ? 'тыс.' : 'ming'}`;
  return `${sign}${Math.round(abs)}`;
}

function trimZero(s: string): string {
  return s.replace(/\.?0+$/, '').replace('.', ',');
}

/** Foiz (0..100) → "25,6 %" */
export function formatPercent(percent: number, digits = 1): string {
  if (!Number.isFinite(percent)) return '0 %';
  return `${percent.toFixed(digits).replace(/\.0+$/, '').replace('.', ',')} %`;
}

/** Sonlarni guruhlash: 12345 → "12 345" */
export function formatCount(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/** Miqdor (0.5 qadam): 1.5 → "1,5", 2 → "2" */
export function formatQty(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const rounded = Math.round(n * 2) / 2;
  return Number.isInteger(rounded) ? formatCount(rounded) : `${formatCount(Math.floor(rounded))},5`;
}

/** Ulush (%) hisoblash, 2 kasr */
export function sharePercent(part: number, total: number): number {
  if (!total || !Number.isFinite(part / total)) return 0;
  return Math.round((part / total) * 10000) / 100;
}

/** Oʻzgarish foizi (oldingi davr 0 boʻlsa null) */
export function deltaPercent(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}
