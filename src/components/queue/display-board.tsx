'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { DoorOpen, Maximize2, Minimize2, Phone, Volume2, VolumeX } from 'lucide-react';
import { cn, formatPhone } from '@/lib/utils';
import { useLocale } from '@/i18n/client';
import { api, qs } from '@/lib/api/client';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { AuroraBackground } from '@/components/effects/aurora-background';
import { Marquee } from '@/components/effects/marquee';
import { LogoMark } from '@/components/shared/logo';
import { useQueueRealtime } from '@/lib/realtime/use-queue-realtime';
import type { QueueEvent } from '@/lib/realtime/types';
import { DisplayAudio, speakAnnouncement, spellNumber } from '@/lib/queue/display-audio';
import { tzTime } from '@/lib/queue/ticket';
import { QUEUE_TYPES, type DisplayCalledDTO, type DisplayConfig, type DisplayStateDTO } from '@/lib/queue/types';
import { LiveClock } from './live-clock';
import { QUEUE_TYPE_META, QueueTypeIcon } from './queue-type-meta';
import { RealtimeBadge } from './realtime-badge';

export interface DisplayBoardProps {
  config: DisplayConfig;
}

const ANNOUNCE_GAP_MS = 10_000;
const FLASH_MS = 6000;

/** TV tablo: katta "chaqirilmoqda" paneli, oxirgi 5 chaqiruv, kutayotganlar, soat; signal + ovozli eʼlon */
export function DisplayBoard({ config }: DisplayBoardProps) {
  const { t, locale } = useLocale();
  const reduced = useReducedMotion();
  const [state, setState] = React.useState<DisplayStateDTO>(config.initial);
  const [flash, setFlash] = React.useState<{ id: string; until: number } | null>(null);
  const [soundOn, setSoundOn] = React.useState(config.displaySound);
  const [audioReady, setAudioReady] = React.useState(false);
  const [needsGesture, setNeedsGesture] = React.useState(config.displaySound || config.displayVoice);
  const [isFullscreen, setIsFullscreen] = React.useState(false);
  const audioRef = React.useRef<DisplayAudio | null>(null);
  const soundOnRef = React.useRef(soundOn);
  const announcedAt = React.useRef<Map<string, number>>(new Map());
  const seenCalledAt = React.useRef<Map<string, string>>(new Map());
  const seenEventAt = React.useRef<Map<string, string>>(new Map());
  const refreshTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateUrl = `/api/display/state${qs({ key: config.key })}`;
  const streamUrl = `/api/display/stream${qs({ key: config.key })}`;

  React.useEffect(() => {
    soundOnRef.current = soundOn;
  }, [soundOn]);

  // Dastlabki holat — eski chaqiruvlar eʼlon qilinmaydi
  React.useEffect(() => {
    for (const c of config.initial.called) if (c.calledAt) seenCalledAt.current.set(c.id, c.calledAt);
  }, [config.initial]);

  React.useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);

  React.useEffect(() => {
    if (!flash) return;
    const id = setTimeout(() => setFlash(null), Math.max(0, flash.until - Date.now()));
    return () => clearTimeout(id);
  }, [flash]);

  const announce = React.useCallback(
    (id: string, number: string, room: string | null) => {
      const now = Date.now();
      const last = announcedAt.current.get(id) ?? 0;
      if (now - last < ANNOUNCE_GAP_MS) return;
      announcedAt.current.set(id, now);
      setFlash({ id, until: now + FLASH_MS });
      if (!soundOnRef.current) return;
      audioRef.current?.chime();
      if (config.displayVoice) {
        const text = room ? t('queue.display.speech', { number: spellNumber(number), room }) : t('queue.display.speechNoRoom', { number: spellNumber(number) });
        window.setTimeout(() => speakAnnouncement({ locale, text }), 700);
      }
    },
    [config.displayVoice, locale, t],
  );

  const applySnapshot = React.useCallback(
    (snap: DisplayStateDTO) => {
      setState(snap);
      for (const c of snap.called) {
        if (c.status !== 'CALLED' || !c.calledAt) continue;
        const prev = seenCalledAt.current.get(c.id);
        seenCalledAt.current.set(c.id, c.calledAt);
        if (prev !== undefined && prev !== c.calledAt) announce(c.id, c.number, c.room);
        else if (prev === undefined && Date.now() - new Date(c.calledAt).getTime() < 15_000) announce(c.id, c.number, c.room);
      }
    },
    [announce],
  );

  const refresh = React.useCallback(() => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(async () => {
      try {
        applySnapshot(await api.get<DisplayStateDTO>(stateUrl));
      } catch {
        // keyingi hodisa/soʻrovda tiklanadi
      }
    }, 250);
  }, [applySnapshot, stateUrl]);

  const onEvent = React.useCallback(
    (ev: QueueEvent) => {
      if (ev.type === 'called') {
        const prev = seenEventAt.current.get(ev.queueId);
        if (prev !== ev.at) {
          seenEventAt.current.set(ev.queueId, ev.at);
          announce(ev.queueId, ev.number, ev.room);
        }
      }
      refresh();
    },
    [announce, refresh],
  );

  const realtime = useQueueRealtime<DisplayStateDTO>({ url: streamUrl, clinicId: config.clinicId, onSnapshot: applySnapshot, onEvent });

  // ── Ovoz / butun ekran ──
  const unlockAudio = React.useCallback(async () => {
    if (!audioRef.current) audioRef.current = new DisplayAudio();
    const ok = await audioRef.current.unlock();
    setAudioReady(ok);
    setNeedsGesture(false);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.getVoices();
  }, []);

  const toggleFullscreen = React.useCallback(async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      // brauzer ruxsat bermadi — eʼtiborsiz
    }
  }, []);

  const start = async () => {
    await unlockAudio();
    await toggleFullscreen();
  };

  const current = state.current;
  const others = state.called.filter((c) => c.id !== current?.id).slice(0, 4);
  const isFlashing = (c: DisplayCalledDTO | null) => !!c && flash?.id === c.id;

  return (
    <div className="relative isolate flex h-full w-full flex-col overflow-hidden">
      <AuroraBackground intensity="low" />

      {/* Yuqori panel */}
      <header className="z-10 flex items-center justify-between gap-4 px-6 py-4 lg:px-10">
        <div className="flex min-w-0 items-center gap-3">
          <LogoMark size={44} className="shrink-0" />
          <div className="min-w-0">
            <div className="truncate font-heading text-xl font-bold leading-tight text-text lg:text-3xl">{config.clinicName}</div>
            <div className="flex items-center gap-3 text-sm text-text-muted lg:text-base">
              <span>{t('queue.display.title')}</span>
              <RealtimeBadge status={realtime.status} compact className="h-6" />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <LiveClock withSeconds timeClassName="text-3xl lg:text-5xl" dateClassName="text-sm lg:text-lg" />
          <div className="ml-2 flex flex-col gap-1">
            <button
              type="button"
              onClick={() => {
                if (!audioReady) void unlockAudio();
                setSoundOn((v) => !v);
              }}
              className="glass flex size-10 items-center justify-center rounded-lg text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={soundOn ? t('queue.display.soundOn') : t('queue.display.soundOff')}
              aria-pressed={soundOn}
              title={soundOn ? t('queue.display.soundOn') : t('queue.display.soundOff')}
            >
              {soundOn ? <Volume2 className="size-5" aria-hidden="true" /> : <VolumeX className="size-5" aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={() => void toggleFullscreen()}
              className="glass flex size-10 items-center justify-center rounded-lg text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={isFullscreen ? t('queue.display.exitFullscreen') : t('queue.display.fullscreen')}
              title={isFullscreen ? t('queue.display.exitFullscreen') : t('queue.display.fullscreen')}
            >
              {isFullscreen ? <Minimize2 className="size-5" aria-hidden="true" /> : <Maximize2 className="size-5" aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>

      {/* Asosiy */}
      <main className="z-10 grid flex-1 min-h-0 grid-cols-1 gap-5 px-6 pb-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:px-10">
        {/* Chap: hozir chaqirilmoqda */}
        <section className="flex min-h-0 flex-col gap-4" aria-live="polite" aria-atomic="true">
          <div
            className={cn(
              'glass-strong relative flex flex-1 flex-col items-center justify-center overflow-hidden rounded-3xl border px-6 py-8 text-center transition-shadow duration-500',
              isFlashing(current) ? 'border-primary/60 shadow-glow-lg' : 'border-line',
            )}
          >
            {isFlashing(current) && !reduced ? (
              <motion.div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-accent-soft"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.9, 0.2, 0.9, 0] }}
                transition={{ duration: 2.4, times: [0, 0.15, 0.4, 0.6, 1] }}
              />
            ) : null}
            <p className="text-lg font-semibold uppercase tracking-[0.3em] text-text-muted lg:text-2xl">
              {current?.status === 'SERVING' ? t('queue.display.inService') : t('queue.display.nowCalling')}
            </p>
            <AnimatePresence mode="wait" initial={false}>
              {current ? (
                <motion.div
                  key={`${current.id}:${current.calledAt ?? ''}`}
                  initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.7, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: -10 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                  className="flex flex-col items-center"
                >
                  <div
                    className={cn('tabular font-heading font-black leading-none tracking-tight text-gradient', 'text-[clamp(96px,20vw,280px)]')}
                    style={{ textShadow: '0 0 80px rgba(0,212,255,0.3)' }}
                  >
                    {current.number}
                  </div>
                  {current.room ? (
                    <div className="mt-3 flex items-center gap-3 font-heading text-4xl font-bold text-text lg:text-6xl">
                      <DoorOpen className="size-9 text-accent lg:size-14" aria-hidden="true" />
                      {t('queue.display.room', { room: current.room })}
                    </div>
                  ) : null}
                  {current.doctorName ? <div className="mt-2 text-xl text-text-muted lg:text-3xl">{current.doctorName}</div> : null}
                </motion.div>
              ) : (
                <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-10">
                  <div className="font-heading text-4xl font-bold text-text lg:text-6xl">{t('queue.display.noCalls')}</div>
                  <p className="mt-3 text-lg text-text-muted lg:text-2xl">{t('queue.display.noCallsHint')}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {others.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {others.map((c) => (
                <motion.div
                  key={c.id}
                  layout={!reduced}
                  className={cn('glass flex items-center justify-between rounded-2xl border px-4 py-3', isFlashing(c) ? 'border-primary/60 shadow-glow' : 'border-line')}
                >
                  <span className={cn('tabular font-heading text-3xl font-extrabold lg:text-4xl', QUEUE_TYPE_META[c.type].text)}>{c.number}</span>
                  <span className="text-right">
                    <span className="block text-xs uppercase tracking-wide text-text-muted">{c.status === 'SERVING' ? t('queue.display.inService') : t('queue.display.roomLabel')}</span>
                    <span className="tabular block font-heading text-2xl font-bold text-text lg:text-3xl">{c.room ?? '—'}</span>
                  </span>
                </motion.div>
              ))}
            </div>
          ) : null}
        </section>

        {/* Oʻng: oxirgi chaqiruvlar + kutayotganlar */}
        <aside className="flex min-h-0 flex-col gap-4">
          <div className="glass flex min-h-0 flex-1 flex-col rounded-3xl border border-line p-5">
            <h2 className="mb-3 font-heading text-lg font-semibold uppercase tracking-wide text-text-muted lg:text-xl">{t('queue.display.recent')}</h2>
            <div className="mb-2 grid grid-cols-[1fr_auto_auto] gap-3 text-xs uppercase tracking-wide text-text-muted">
              <span>{t('queue.display.ticket')}</span>
              <span>{t('queue.display.roomLabel')}</span>
              <span>{t('queue.display.time')}</span>
            </div>
            <ul className="scrollbar-none min-h-0 flex-1 space-y-2 overflow-y-auto">
              <AnimatePresence initial={false}>
                {state.called.length === 0 ? (
                  <li className="py-6 text-center text-text-muted">{t('queue.display.noCalls')}</li>
                ) : (
                  state.called.map((c) => (
                    <motion.li
                      key={c.id}
                      layout={!reduced}
                      initial={reduced ? false : { opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      className={cn(
                        'grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-xl border px-3 py-2',
                        c.id === current?.id ? 'border-primary/40 bg-primary/10' : 'border-line bg-popover/50',
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <QueueTypeIcon type={c.type} className={cn('size-5', QUEUE_TYPE_META[c.type].text)} />
                        <span className="tabular font-heading text-2xl font-bold text-text lg:text-3xl">{c.number}</span>
                      </span>
                      <span className="tabular font-heading text-xl font-semibold text-text lg:text-2xl">{c.room ?? '—'}</span>
                      <span className="tabular text-sm text-text-muted lg:text-base">{c.calledAt ? tzTime(c.calledAt) : ''}</span>
                    </motion.li>
                  ))
                )}
              </AnimatePresence>
            </ul>
          </div>

          <div className="glass rounded-3xl border border-line p-5">
            <div className="flex items-end justify-between">
              <span className="font-heading text-lg font-semibold uppercase tracking-wide text-text-muted lg:text-xl">{t('queue.display.waiting')}</span>
              <span className="tabular font-heading text-5xl font-black text-text lg:text-6xl">{state.waitingCount}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {QUEUE_TYPES.filter((x) => state.waitingByType[x] > 0 || x === 'DOCTOR').map((x) => (
                <div key={x} className={cn('flex items-center justify-between rounded-lg border px-3 py-1.5', QUEUE_TYPE_META[x].border, QUEUE_TYPE_META[x].soft)}>
                  <span className="flex items-center gap-2 text-sm text-text">
                    <QueueTypeIcon type={x} className={cn('size-4', QUEUE_TYPE_META[x].text)} />
                    <span className="truncate">{t(`common.queueType.${x}`)}</span>
                  </span>
                  <span className="tabular font-heading text-xl font-bold text-text">{state.waitingByType[x]}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </main>

      {/* Pastki ticker */}
      <footer className="z-10 border-t border-line bg-popover/60 py-2 text-base text-text-muted lg:text-xl">
        <Marquee speed={60} pauseOnHover={false} gap={96}>
          <span>{t('queue.display.ticker')}</span>
          {config.clinicPhone ? (
            <span className="tabular inline-flex items-center gap-2">
              <Phone className="size-4" aria-hidden="true" />
              {t('queue.display.clinicPhone')}: {formatPhone(config.clinicPhone) || config.clinicPhone}
            </span>
          ) : null}
          <span>{config.clinicName}</span>
        </Marquee>
      </footer>

      {/* Ovozni yoqish uchun harakat kerak (brauzer talabi) */}
      {needsGesture ? (
        <div className="absolute inset-0 z-20 flex items-end justify-center bg-background/40 p-6 backdrop-blur-[2px] lg:items-center">
          <button
            type="button"
            onClick={() => void start()}
            className="glass-strong flex items-center gap-4 rounded-2xl border border-primary/40 px-6 py-5 text-left shadow-glow transition-transform hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40"
            autoFocus
          >
            <span className="flex size-14 items-center justify-center rounded-xl bg-primary/10 text-accent">
              <Volume2 className="size-7" aria-hidden="true" />
            </span>
            <span>
              <span className="block font-heading text-xl font-bold text-text">{t('queue.display.enableSound')}</span>
              <span className="block text-sm text-text-muted">{t('queue.display.tapToStart')}</span>
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
