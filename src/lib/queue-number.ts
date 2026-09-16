import type { QueueType } from '@prisma/client';
import type { QueueSettings } from './settings/types';

/** Navbat raqami formati: A-001 */
export function formatQueueNumber(prefix: string, seq: number): string {
  return `${prefix}-${String(seq).padStart(3, '0')}`;
}

export function prefixForType(type: QueueType, settings: QueueSettings): string {
  return settings.prefixes[type];
}

export function parseQueueNumber(num: string): { prefix: string; seq: number } | null {
  const m = /^([A-Z])-(\d{3,})$/.exec(num);
  if (!m) return null;
  return { prefix: m[1]!, seq: Number(m[2]) };
}

/** Taxminiy kutish vaqti (daqiqa) */
export function estimateWait(ahead: number, avgServiceMinutes: number): number {
  return Math.max(0, ahead) * Math.max(1, avgServiceMinutes);
}

/** Bemor karta raqami: 2026-00042 */
export function formatCardNumber(year: number, seq: number): string {
  return `${year}-${String(seq).padStart(5, '0')}`;
}

/** Chek raqami: 20260915-0042 */
export function formatReceiptNo(dateKey: string, seq: number): string {
  return `${dateKey.replace(/-/g, '')}-${String(seq).padStart(4, '0')}`;
}
