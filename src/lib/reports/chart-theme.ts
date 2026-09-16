import type { PayMethod } from '@prisma/client';

/**
 * Hisobot grafiklari palitrasi ("Clinical Luxury Dark").
 * Kategorik ranglar dataviz validatoridan oʻtgan (dark rejim, yuza #131A2B, L 0.48–0.67 diapazoni,
 * CVD ΔE ≥ 8, kontrast ≥ 3:1). Brend accent #00D4FF faqat bitta seriyali grafiklarda (tushum ustunlari).
 * Rang har doim obyektga bogʻlangan (toʻlov usuli, bemor turi, dori) — filtr oʻzgarsa ham qayta boʻyalmaydi.
 */
export const CHART = {
  accent: '#00D4FF',
  accentDeep: '#00A3C4',
  violet: '#7C5CFF',
  mint: '#00AA79',
  danger: '#FF4D6D',
  grid: '#1F2A40',
  axis: '#8A99B8',
  surface: '#131A2B',
  cursor: 'rgba(138, 153, 184, 0.35)',
  text: '#EAF0FF',
  muted: '#8A99B8',
} as const;

export const METHOD_ORDER: readonly PayMethod[] = ['CASH', 'CARD', 'TRANSFER', 'CLICK', 'PAYME'] as const;

/** Toʻlov usuli → rang (bosh sahifa bilan bir xil, validatsiyadan oʻtgan: eng yomon qoʻshni juft ΔE 8.9) */
export const METHOD_COLORS: Record<PayMethod, string> = {
  CASH: '#00A3C4',
  CARD: '#7C5CFF',
  TRANSFER: '#00AA79',
  CLICK: '#C4862A',
  PAYME: '#DC4467',
};

/** Kattalar / bolalar (2 seriya, ΔE 15.2) */
export const TYPE_COLORS = { ADULT: '#00A3C4', CHILD: '#7C5CFF' } as const;

/** Dori bilan / dorisiz (2 seriya, ΔE 25.6) */
export const MED_COLORS = { MED: '#00AA79', NOMED: '#7C5CFF' } as const;

/** Recharts oʻq belgilarining umumiy uslubi */
export const AXIS_TICK = {
  fill: CHART.axis,
  fontSize: 11,
  fontFamily: 'var(--font-body), Inter, system-ui, sans-serif',
} as const;

export const CHART_HEIGHT = 260;
export const SMALL_CHART_HEIGHT = 140;
export const BAR_MAX = 24;
