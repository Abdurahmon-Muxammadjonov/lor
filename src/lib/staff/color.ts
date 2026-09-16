import { HEX_COLOR_RE, STAFF_COLORS } from './schemas';

/** #RRGGBB → rgba(r,g,b,a) — noaniq/notoʻgʻri rang uchun accent */
export function hexToRgba(hex: string, alpha: number): string {
  const safe = HEX_COLOR_RE.test(hex) ? hex : STAFF_COLORS[0];
  const r = parseInt(safe.slice(1, 3), 16);
  const g = parseInt(safe.slice(3, 5), 16);
  const b = parseInt(safe.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function safeHex(hex: string | null | undefined): string {
  return hex && HEX_COLOR_RE.test(hex) ? hex.toUpperCase() : STAFF_COLORS[0];
}

/** Avatar halqasi + yumshoq nur (inline style) */
export function ringStyle(hex: string): { boxShadow: string } {
  const c = safeHex(hex);
  return { boxShadow: `0 0 0 2px var(--bg-elevated), 0 0 0 4px ${c}, 0 0 18px ${hexToRgba(c, 0.45)}` };
}
