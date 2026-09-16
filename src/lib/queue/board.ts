import type { QueueStatus, QueueType } from '@prisma/client';
import { QUEUE_TYPES, type DisplayCalledDTO, type QueueBoardDTO, type QueueRowDTO, type QueueStatsDTO } from './types';

/**
 * Taxta (board) uchun sof guruhlash va statistika — DB siz, testlanadi.
 * Kirish: serialize qilingan qatorlar (Date → ISO string).
 */

const ms = (v: string | null | undefined): number => (v ? new Date(v).getTime() : 0);

function byAsc(key: 'createdAt' | 'seq') {
  return (a: QueueRowDTO, b: QueueRowDTO) => (key === 'seq' ? a.seq - b.seq : ms(a.createdAt) - ms(b.createdAt));
}

function byDesc(key: 'calledAt' | 'servedAt' | 'doneAt' | 'updatedAt') {
  return (a: QueueRowDTO, b: QueueRowDTO) => ms(b[key]) - ms(a[key]) || b.seq - a.seq;
}

function average(values: number[]): number | null {
  if (!values.length) return null;
  const sum = values.reduce((acc, v) => acc + v, 0);
  return Math.round(sum / values.length);
}

function minutesBetween(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  const diff = (ms(to) - ms(from)) / 60_000;
  return diff >= 0 ? diff : null;
}

export function emptyTypeStats(): Record<QueueType, { waiting: number; active: number; done: number; total: number }> {
  const out = {} as Record<QueueType, { waiting: number; active: number; done: number; total: number }>;
  for (const t of QUEUE_TYPES) out[t] = { waiting: 0, active: 0, done: 0, total: 0 };
  return out;
}

/** Qatorlar → statistika */
export function computeStats(rows: QueueRowDTO[]): QueueStatsDTO {
  const byType = emptyTypeStats();
  const counts: Record<QueueStatus, number> = { WAITING: 0, CALLED: 0, SERVING: 0, DONE: 0, SKIPPED: 0 };
  const waits: number[] = [];
  const services: number[] = [];
  for (const r of rows) {
    counts[r.status] += 1;
    const ts = byType[r.type];
    ts.total += 1;
    if (r.status === 'WAITING') ts.waiting += 1;
    else if (r.status === 'CALLED' || r.status === 'SERVING') ts.active += 1;
    else if (r.status === 'DONE') ts.done += 1;
    const w = minutesBetween(r.createdAt, r.calledAt);
    if (w !== null) waits.push(w);
    const s = minutesBetween(r.servedAt, r.doneAt);
    if (s !== null) services.push(s);
  }
  return {
    waiting: counts.WAITING,
    called: counts.CALLED,
    serving: counts.SERVING,
    done: counts.DONE,
    skipped: counts.SKIPPED,
    total: rows.length,
    avgWaitMin: average(waits),
    avgServiceMin: average(services),
    byType,
  };
}

/** Qatorlar → ustunlar (kutmoqda: kelish tartibida; qolganlari: eng yangisi birinchi) */
export function groupBoard(rows: QueueRowDTO[], dateKey: string, now: Date = new Date()): QueueBoardDTO {
  const waiting = rows.filter((r) => r.status === 'WAITING').sort(byAsc('createdAt'));
  const called = rows.filter((r) => r.status === 'CALLED').sort(byDesc('calledAt'));
  const serving = rows.filter((r) => r.status === 'SERVING').sort(byDesc('servedAt'));
  const done = rows.filter((r) => r.status === 'DONE').sort(byDesc('doneAt'));
  const skipped = rows.filter((r) => r.status === 'SKIPPED').sort(byDesc('updatedAt'));
  return { dateKey, waiting, called, serving, done, skipped, stats: computeStats(rows), now: now.toISOString() };
}

/** Taxtadagi barcha qatorlar (ustunlardan yigʻilgan) */
export function boardRows(board: QueueBoardDTO): QueueRowDTO[] {
  return [...board.waiting, ...board.called, ...board.serving, ...board.done, ...board.skipped];
}

/** Bitta talon oldida kutayotganlar (xuddi shu tur, oldinroq olingan, hali WAITING) */
export function aheadOf(rows: QueueRowDTO[], row: Pick<QueueRowDTO, 'id' | 'type' | 'createdAt' | 'seq' | 'prefix'>): number {
  return rows.filter(
    (r) =>
      r.id !== row.id &&
      r.type === row.type &&
      r.status === 'WAITING' &&
      (r.prefix === row.prefix ? r.seq < row.seq : ms(r.createdAt) < ms(row.createdAt)),
  ).length;
}

/** Tablo uchun: oxirgi chaqiruvlar (CALLED/SERVING, eng yangisi birinchi) */
export function displayCalled(rows: QueueRowDTO[], limit = 5): DisplayCalledDTO[] {
  return rows
    .filter((r): r is QueueRowDTO & { status: 'CALLED' | 'SERVING' } => r.status === 'CALLED' || r.status === 'SERVING')
    .sort((a, b) => ms(b.calledAt ?? b.updatedAt) - ms(a.calledAt ?? a.updatedAt))
    .slice(0, limit)
    .map((r) => ({
      id: r.id,
      number: r.number,
      type: r.type,
      status: r.status,
      room: r.room ?? r.doctor?.room ?? null,
      doctorName: r.doctor?.fullName ?? null,
      calledAt: r.calledAt,
    }));
}

/** Tablo: kutayotganlar soni turlar boʻyicha */
export function waitingByType(rows: QueueRowDTO[]): Record<QueueType, number> {
  const out = {} as Record<QueueType, number>;
  for (const t of QUEUE_TYPES) out[t] = 0;
  for (const r of rows) if (r.status === 'WAITING') out[r.type] += 1;
  return out;
}

/** Foydalanuvchi (shifokor) uchun "joriy" talon: oʻziga biriktirilgan CALLED/SERVING dan eng yangisi */
export function currentTicketFor(board: QueueBoardDTO, userId: string): QueueRowDTO | null {
  const serving = board.serving.filter((r) => r.doctorId === userId).sort((a, b) => ms(b.servedAt ?? b.updatedAt) - ms(a.servedAt ?? a.updatedAt));
  if (serving.length) return serving[0] ?? null;
  const called = board.called.filter((r) => r.doctorId === userId).sort((a, b) => ms(b.calledAt ?? b.updatedAt) - ms(a.calledAt ?? a.updatedAt));
  return called[0] ?? null;
}

/** Bemor talonni olganidan beri necha daqiqa kutmoqda */
export function waitedMinutes(row: Pick<QueueRowDTO, 'createdAt'>, now: Date | string): number {
  return Math.max(0, Math.floor((ms(typeof now === 'string' ? now : now.toISOString()) - ms(row.createdAt)) / 60_000));
}
