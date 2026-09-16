import { format } from 'date-fns';
import { ru, uz } from 'date-fns/locale';
import type { Locale } from '@/i18n/config';

const dfLocale = (l: Locale) => (l === 'ru' ? ru : uz);

/** 1 250 000 → "1,25 mln" / "1,25 млн"; 250 000 → "250 ming" / "250 тыс."; oʻqda ishlatiladi (`digits` — kasr xonalari) */
export function formatCompactMoney(n: number, locale: Locale, digits = 2): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 1_000_000_000) return `${sign}${trimZero((abs / 1_000_000_000).toFixed(digits))} ${locale === 'ru' ? 'млрд' : 'mlrd'}`;
  if (abs >= 1_000_000) return `${sign}${trimZero((abs / 1_000_000).toFixed(digits))} ${locale === 'ru' ? 'млн' : 'mln'}`;
  if (abs >= 1_000) return `${sign}${Math.round(abs / 1_000)} ${locale === 'ru' ? 'тыс.' : 'ming'}`;
  return `${sign}${abs}`;
}

function trimZero(s: string): string {
  return s.replace(/\.?0+$/, '').replace('.', ',');
}

/** "2026-09-15" → "15 sen" / "15 сент." (oʻq belgilari) */
export function formatAxisDate(dateKey: string, locale: Locale): string {
  const d = new Date(`${dateKey}T00:00:00`);
  return format(d, 'd MMM', { locale: dfLocale(locale) });
}

/** "2026-09-15" → "15 sentabr, dushanba" / "15 сентября, понедельник" (tooltip) */
export function formatLongDate(dateKey: string, locale: Locale): string {
  const d = new Date(`${dateKey}T00:00:00`);
  return format(d, 'd MMMM, EEEE', { locale: dfLocale(locale) });
}

/** Foiz: 0.256 → "25,6 %" */
export function formatPercent(fraction: number, digits = 1): string {
  if (!Number.isFinite(fraction)) return '0 %';
  return `${(fraction * 100).toFixed(digits).replace(/\.0+$/, '').replace('.', ',')} %`;
}

/** Sonlarni guruhlash: 12345 → "12 345" */
export function formatCount(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
