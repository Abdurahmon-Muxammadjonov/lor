import type { PayMethod } from '@prisma/client';

/**
 * Grafiklar palitrasi ("Clinical Luxury Dark").
 * Kategorik ranglar dataviz validatoridan oʻtgan (dark rejim, yuza #131A2B): yorugʻlik diapazoni,
 * xroma, CVD ajratish (eng yomon qoʻshni juft ΔE 8.9), oddiy koʻrish (ΔE 17.7) va kontrast ≥ 3:1.
 * Tartib qatʼiy — rang har doim toʻlov usuliga bogʻlanadi (filtr oʻzgarsa ham qayta boʻyalmaydi).
 */
export const CHART = {
  /** Bitta seriyali grafik (tushum) — brend accent */
  accent: '#00D4FF',
  grid: '#1F2A40',
  axis: '#8A99B8',
  /** Shisha karta yuzasi — belgilar atrofidagi 2px halqa / boʻshliq rangi */
  surface: '#131A2B',
  cursor: 'rgba(138, 153, 184, 0.55)',
  text: '#EAF0FF',
  muted: '#8A99B8',
} as const;

export const METHOD_ORDER: readonly PayMethod[] = ['CASH', 'CARD', 'TRANSFER', 'CLICK', 'PAYME'] as const;

export const METHOD_COLORS: Record<PayMethod, string> = {
  CASH: '#00A3C4',
  CARD: '#7C5CFF',
  TRANSFER: '#00AA79',
  CLICK: '#C4862A',
  PAYME: '#DC4467',
};

/** Recharts oʻq belgilarining umumiy uslubi */
export const AXIS_TICK = {
  fill: CHART.axis,
  fontSize: 11,
  fontFamily: 'var(--font-body), Inter, system-ui, sans-serif',
} as const;

export const CHART_HEIGHT = 260;
