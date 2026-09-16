'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { QueueEvent, RealtimeStatus } from './types';

export type { QueueEvent, QueueEventType, RealtimeStatus } from './types';

/**
 * Navbat jonli yangilanishlari (client).
 *
 *   useQueueRealtime<Board>({ url: '/api/queue/stream', onSnapshot, onEvent })
 *   useQueueRealtime<DisplayState>({ url: '/api/display/stream?key=…', clinicId, onEvent })
 *
 * 1) EventSource (SSE): `snapshot` → onSnapshot, `queue` → onEvent; uzilsa avtomatik qayta ulanadi.
 * 2) Ketma-ket 2 ta xatodan soʻng — 3 s polling: GET url.replace('/stream', '/state') → onSnapshot;
 *    orqa fonda SSE ga qaytishga urinadi (30 s → 60 s → … 5 daqiqa).
 * 3) NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY va `clinicId` boʻlsa — qoʻshimcha ravishda
 *    Supabase Realtime (`postgres_changes`, jadval "Queue", clinicId filtri) → onEvent.
 */

export interface UseQueueRealtimeOptions<S> {
  /** SSE manzili (`…/stream`); `/state` — polling zaxirasi */
  url: string | null;
  enabled?: boolean;
  /** Supabase Realtime filtri uchun (ixtiyoriy) */
  clinicId?: string | null;
  onSnapshot?: (snapshot: S) => void;
  onEvent?: (event: QueueEvent) => void;
  /** Polling oraligʻi (default 3000 ms) */
  pollMs?: number;
  /** Nechta ketma-ket SSE xatosidan soʻng pollingga oʻtiladi (default 2) */
  maxSseErrors?: number;
}

export interface UseQueueRealtimeResult {
  status: RealtimeStatus;
  /** Oxirgi snapshot/hodisa vaqti */
  lastEventAt: Date | null;
  /** Supabase kanali faol */
  supabase: boolean;
  /** SSE ga qayta ulanishga majburlash */
  reconnect: () => void;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export function stateUrlFor(streamUrl: string): string {
  return streamUrl.includes('/stream') ? streamUrl.replace('/stream', '/state') : streamUrl;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));

/** Supabase `postgres_changes` qatori (Queue) → QueueEvent (null — noaniq yuk) */
export function queueEventFromSupabase(eventType: string, row: unknown, old?: unknown): QueueEvent | null {
  if (!isRecord(row) || typeof row.id !== 'string') return null;
  const status = str(row.status) as QueueEvent['status'];
  const calledAt = str(row.calledAt);
  const oldCalledAt = isRecord(old) ? str(old.calledAt) : '';
  let type: QueueEvent['type'] = 'updated';
  if (eventType === 'INSERT') type = 'created';
  else if (status === 'CALLED' && calledAt && calledAt !== oldCalledAt) type = 'called';
  return {
    type,
    queueId: row.id,
    number: str(row.number),
    status,
    queueType: str(row.type) as QueueEvent['queueType'],
    room: row.room == null ? null : str(row.room),
    doctorId: row.doctorId == null ? null : str(row.doctorId),
    at: str(row.updatedAt) || new Date().toISOString(),
  };
}

const RETRY_STEPS_MS = [30_000, 60_000, 120_000, 300_000] as const;

export function useQueueRealtime<S = unknown>(options: UseQueueRealtimeOptions<S>): UseQueueRealtimeResult {
  const { url, enabled = true, clinicId = null, pollMs = 3000, maxSseErrors = 2 } = options;
  const [status, setStatus] = useState<RealtimeStatus>('idle');
  const [lastEventAt, setLastEventAt] = useState<Date | null>(null);
  const [supabaseActive, setSupabaseActive] = useState(false);
  const [generation, setGeneration] = useState(0);

  const onSnapshotRef = useRef(options.onSnapshot);
  const onEventRef = useRef(options.onEvent);
  useEffect(() => {
    onSnapshotRef.current = options.onSnapshot;
    onEventRef.current = options.onEvent;
  });

  const reconnect = useCallback(() => setGeneration((g) => g + 1), []);

  // ── SSE + polling ──
  useEffect(() => {
    if (!enabled || !url || typeof window === 'undefined') {
      setStatus('idle');
      return;
    }

    let disposed = false;
    let es: EventSource | null = null;
    let errors = 0;
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryStep = 0;
    let pollInFlight = false;
    const stateUrl = stateUrlFor(url);

    const touch = () => setLastEventAt(new Date());

    const stopPolling = () => {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    };

    const closeSse = () => {
      if (es) {
        es.onopen = null;
        es.onerror = null;
        es.close();
      }
      es = null;
    };

    const pollOnce = async () => {
      if (disposed || pollInFlight) return;
      pollInFlight = true;
      try {
        const res = await fetch(stateUrl, { credentials: 'same-origin', headers: { Accept: 'application/json' }, cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { ok: boolean; data?: S };
        if (!json.ok || json.data === undefined) throw new Error('bad payload');
        if (disposed) return;
        setStatus('polling');
        touch();
        onSnapshotRef.current?.(json.data);
      } catch {
        if (!disposed) setStatus('offline');
      } finally {
        pollInFlight = false;
      }
    };

    const startPolling = () => {
      if (pollTimer || disposed) return;
      setStatus('polling');
      void pollOnce();
      pollTimer = setInterval(() => void pollOnce(), pollMs);
      const delay = RETRY_STEPS_MS[Math.min(retryStep, RETRY_STEPS_MS.length - 1)] ?? 30_000;
      retryStep += 1;
      retryTimer = setTimeout(() => {
        if (disposed) return;
        errors = 0;
        stopPolling();
        openSse();
      }, delay);
    };

    const openSse = () => {
      if (disposed) return;
      if (typeof EventSource === 'undefined') {
        startPolling();
        return;
      }
      setStatus('connecting');
      const source = new EventSource(url, { withCredentials: true });
      es = source;
      source.onopen = () => {
        if (disposed || es !== source) return;
        errors = 0;
        retryStep = 0;
        setStatus('live');
      };
      source.addEventListener('snapshot', (e: MessageEvent<string>) => {
        if (disposed || es !== source) return;
        try {
          const data = JSON.parse(e.data) as S | null;
          touch();
          if (data !== null) onSnapshotRef.current?.(data);
        } catch {
          // notoʻgʻri JSON — eʼtiborsiz
        }
      });
      source.addEventListener('queue', (e: MessageEvent<string>) => {
        if (disposed || es !== source) return;
        try {
          const ev = JSON.parse(e.data) as QueueEvent;
          touch();
          onEventRef.current?.(ev);
        } catch {
          // notoʻgʻri JSON — eʼtiborsiz
        }
      });
      source.onerror = () => {
        if (disposed || es !== source) return;
        errors += 1;
        // readyState CLOSED — brauzer qayta urinmaydi (masalan 401/404); CONNECTING — oʻzi qayta ulanadi
        if (errors >= maxSseErrors || source.readyState === EventSource.CLOSED) {
          closeSse();
          startPolling();
        } else {
          setStatus('connecting');
        }
      };
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible' && !es && !pollTimer && !disposed) openSse();
    };
    document.addEventListener('visibilitychange', onVisible);
    openSse();

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', onVisible);
      closeSse();
      stopPolling();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [url, enabled, pollMs, maxSseErrors, generation]);

  // ── Supabase Realtime (ixtiyoriy) ──
  useEffect(() => {
    if (!enabled || !clinicId || !SUPABASE_URL || !SUPABASE_ANON_KEY || typeof window === 'undefined') {
      setSupabaseActive(false);
      return;
    }
    let disposed = false;
    let cleanup: (() => void) | null = null;

    void (async () => {
      try {
        const mod = await import('@supabase/supabase-js');
        if (disposed) return;
        const client = mod.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
        const channel = client
          .channel(`queue:${clinicId}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'Queue', filter: `clinicId=eq.${clinicId}` },
            (payload: { eventType: string; new: unknown; old: unknown }) => {
              if (disposed) return;
              const ev = queueEventFromSupabase(payload.eventType, payload.new, payload.old);
              if (ev) {
                setLastEventAt(new Date());
                onEventRef.current?.(ev);
              }
            },
          )
          .subscribe((state: string) => {
            if (!disposed) setSupabaseActive(state === 'SUBSCRIBED');
          });
        cleanup = () => {
          void client.removeChannel(channel);
        };
      } catch {
        if (!disposed) setSupabaseActive(false);
      }
    })();

    return () => {
      disposed = true;
      setSupabaseActive(false);
      if (cleanup) cleanup();
    };
  }, [enabled, clinicId]);

  return { status, lastEventAt, supabase: supabaseActive, reconnect };
}
