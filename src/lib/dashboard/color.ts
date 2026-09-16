/** "#00D4FF" → "rgba(0, 212, 255, 0.15)"; notoʻgʻri hex boʻlsa accent rang */
export function hexAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const h = m?.[1] ?? '00D4FF';
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${Math.min(1, Math.max(0, alpha))})`;
}

export function safeHex(hex: string | null | undefined, fallback = '#00D4FF'): string {
  return hex && /^#?[0-9a-f]{6}$/i.test(hex.trim()) ? (hex.startsWith('#') ? hex : `#${hex}`) : fallback;
}
