import type { QueueStatus, QueueType } from '@prisma/client';

/** Navbat hodisasi — SSE `event: queue`, Supabase postgres_changes va xotiradagi emitter uchun bir xil shakl */
export type QueueEventType = 'created' | 'called' | 'updated';

export interface QueueEvent {
  type: QueueEventType;
  queueId: string;
  number: string;
  status: QueueStatus;
  queueType: QueueType;
  room: string | null;
  doctorId: string | null;
  /** ISO — qator `updatedAt` (bardoshli signal) */
  at: string;
}

export type QueueEventInput = Omit<QueueEvent, 'at'> & { at?: string };

/** SSE oqimidagi nomlangan hodisalar */
export type SseEventName = 'snapshot' | 'queue' | 'ping';

export type RealtimeStatus = 'idle' | 'connecting' | 'live' | 'polling' | 'offline';
