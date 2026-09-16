import { EventEmitter } from 'node:events';
import type { QueueStatus, QueueType } from '@prisma/client';
import type { QueueEvent, QueueEventInput, QueueEventType } from './types';

export type { QueueEvent, QueueEventInput, QueueEventType } from './types';

/**
 * Server tomonidagi navbat hodisalari (FAQAT SERVER — node:events).
 *
 * Xotiradagi EventEmitter bitta Node jarayoni ichida SSE oqimlarini darhol uygʻotadi;
 * bardoshli signal esa `Queue.updatedAt` — SSE har 2 s DB ni soʻraydi (serverless da ham ishlaydi).
 * Dev rejimida HMR emitterni yoʻqotmasin deb `globalThis` da saqlanadi.
 */

const KEY = '__lorQueueEmitter';
const g = globalThis as unknown as { [KEY]?: EventEmitter };

function emitter(): EventEmitter {
  if (!g[KEY]) {
    const e = new EventEmitter();
    e.setMaxListeners(0);
    g[KEY] = e;
  }
  return g[KEY];
}

const channel = (clinicId: string) => `queue:${clinicId}`;

/** Hodisani eʼlon qilish (xato tashlamaydi) */
export function publishQueueEvent(clinicId: string, event: QueueEventInput): QueueEvent {
  const full: QueueEvent = { ...event, at: event.at ?? new Date().toISOString() };
  try {
    emitter().emit(channel(clinicId), full);
  } catch {
    // tinglovchi xatosi eʼlon qiluvchiga taʼsir qilmasin
  }
  return full;
}

/** Obuna; qaytgan funksiya obunani bekor qiladi */
export function subscribeQueueEvents(clinicId: string, listener: (event: QueueEvent) => void): () => void {
  const e = emitter();
  const name = channel(clinicId);
  e.on(name, listener);
  return () => {
    e.off(name, listener);
  };
}

/** Faol tinglovchilar soni (diagnostika/test) */
export function queueListenerCount(clinicId: string): number {
  return emitter().listenerCount(channel(clinicId));
}

export interface QueueEventRow {
  id: string;
  number: string;
  status: QueueStatus;
  type: QueueType;
  room: string | null;
  doctorId: string | null;
  createdAt: Date;
  calledAt: Date | null;
  updatedAt: Date;
}

/** DB qatori → hodisa turi: `since` dan keyin yaratilgan → created; chaqiruv vaqti yangilangan → called; aks holda updated */
export function classifyRowEvent(row: Pick<QueueEventRow, 'status' | 'createdAt' | 'calledAt'>, since: Date | null): QueueEventType {
  if (since && row.createdAt.getTime() >= since.getTime()) return 'created';
  if (row.status === 'CALLED' && row.calledAt && (!since || row.calledAt.getTime() >= since.getTime())) return 'called';
  return 'updated';
}

/** DB qatori → QueueEvent */
export function queueEventFromRow(row: QueueEventRow, since: Date | null, type?: QueueEventType): QueueEvent {
  return {
    type: type ?? classifyRowEvent(row, since),
    queueId: row.id,
    number: row.number,
    status: row.status,
    queueType: row.type,
    room: row.room,
    doctorId: row.doctorId,
    at: row.updatedAt.toISOString(),
  };
}
