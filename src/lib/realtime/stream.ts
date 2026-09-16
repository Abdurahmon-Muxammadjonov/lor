import { subscribeQueueEvents } from './queue-events';
import type { QueueEvent, SseEventName } from './types';

/**
 * SSE (text/event-stream) javobi — FAQAT SERVER.
 *
 *   return makeSse(req, { clinicId, snapshot: () => getBoard(...), poll: (since) => pollQueueEvents(...) });
 *
 * Oqim: `retry` → `event: snapshot` (dastlabki holat) → har `intervalMs` (2 s) DB dan `updatedAt >= lastSeen`
 * qatorlarni soʻrab `event: queue` yuboradi (serverless da ham ishlaydi); xotiradagi emitter hodisasi
 * kelsa — soʻrovni darhol bajaradi. Har `heartbeatMs` (15 s) `: ping`. Mijoz uzsa (abort) yoki
 * `maxDurationMs` oʻtsa yopiladi (EventSource oʻzi qayta ulanadi).
 */

export interface SseSource<S> {
  clinicId: string;
  /** Dastlabki toʻliq holat */
  snapshot: () => Promise<S>;
  /** `since` dan keyingi hodisalar (updatedAt boʻyicha oʻsish tartibida) */
  poll: (since: Date) => Promise<QueueEvent[]>;
  intervalMs?: number;
  heartbeatMs?: number;
  maxDurationMs?: number;
  /** Mijozga tavsiya etiladigan qayta ulanish vaqti (ms) */
  retryMs?: number;
}

export const SSE_HEADERS: Record<string, string> = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache, no-store, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};

/** Bitta SSE xabari matni (test qilinadi) */
export function formatSseMessage(event: SseEventName, data: unknown, id?: string): string {
  const payload = JSON.stringify(data);
  const lines = [`event: ${event}`];
  if (id) lines.push(`id: ${id}`);
  lines.push(`data: ${payload}`);
  return `${lines.join('\n')}\n\n`;
}

export function makeSse<S>(req: Request, source: SseSource<S>): Response {
  const intervalMs = source.intervalMs ?? 2000;
  const heartbeatMs = source.heartbeatMs ?? 15_000;
  const maxDurationMs = source.maxDurationMs ?? 5 * 60_000;
  const retryMs = source.retryMs ?? 2000;
  const encoder = new TextEncoder();

  let stop: (() => void) | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let polling = false;
      let pending = false;
      let lastSeen = new Date();
      /** Yuborilgan (id → at) — `>=` soʻrovi tufayli takrorlanishlarni oldini oladi */
      const seen = new Map<string, string>();
      let timers: ReturnType<typeof setInterval>[] = [];
      let lifeTimer: ReturnType<typeof setTimeout> | null = null;
      let unsubscribe: (() => void) | null = null;

      const write = (text: string): boolean => {
        if (closed) return false;
        try {
          controller.enqueue(encoder.encode(text));
          return true;
        } catch {
          cleanup();
          return false;
        }
      };

      const cleanup = () => {
        if (closed) return;
        closed = true;
        for (const t of timers) clearInterval(t);
        timers = [];
        if (lifeTimer) clearTimeout(lifeTimer);
        lifeTimer = null;
        if (unsubscribe) unsubscribe();
        unsubscribe = null;
        req.signal.removeEventListener('abort', cleanup);
        try {
          controller.close();
        } catch {
          // allaqachon yopilgan
        }
      };

      const sendEvents = (events: QueueEvent[]) => {
        for (const ev of events) {
          const prev = seen.get(ev.queueId);
          if (prev === ev.at) continue;
          seen.set(ev.queueId, ev.at);
          if (!write(formatSseMessage('queue', ev, `${ev.queueId}:${ev.at}`))) return;
          const at = new Date(ev.at);
          if (!Number.isNaN(at.getTime()) && at.getTime() > lastSeen.getTime()) lastSeen = at;
        }
        // Eski yozuvlarni tozalash (lastSeen dan 2 daqiqa oldingilar)
        if (seen.size > 500) {
          const cutoff = lastSeen.getTime() - 120_000;
          for (const [id, at] of seen) if (new Date(at).getTime() < cutoff) seen.delete(id);
        }
      };

      const runPoll = async () => {
        if (closed) return;
        if (polling) {
          pending = true;
          return;
        }
        polling = true;
        try {
          const events = await source.poll(lastSeen);
          if (!closed) sendEvents(events);
        } catch {
          // vaqtinchalik DB xatosi — keyingi soʻrovda qayta uriniladi
        } finally {
          polling = false;
          if (pending && !closed) {
            pending = false;
            void runPoll();
          }
        }
      };

      stop = cleanup;
      req.signal.addEventListener('abort', cleanup);
      if (req.signal.aborted) {
        cleanup();
        return;
      }

      write(`retry: ${retryMs}\n\n`);

      void (async () => {
        try {
          const snap = await source.snapshot();
          if (!write(formatSseMessage('snapshot', snap))) return;
        } catch {
          write(formatSseMessage('snapshot', null));
        }
        if (closed) return;
        timers.push(setInterval(() => void runPoll(), intervalMs));
        timers.push(setInterval(() => write(': ping\n\n'), heartbeatMs));
        lifeTimer = setTimeout(cleanup, maxDurationMs);
        unsubscribe = subscribeQueueEvents(source.clinicId, () => void runPoll());
      })();
    },
    cancel() {
      // mijoz uzdi (abort kelmagan boʻlsa ham) — taymerlar va obunani tozalaymiz
      if (stop) stop();
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
