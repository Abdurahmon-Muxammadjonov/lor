'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import type { QueueType } from '@prisma/client';
import { AlertTriangle, CheckCircle2, MonitorPlay, Phone, Printer, Ticket } from 'lucide-react';
import { cn, formatPhone } from '@/lib/utils';
import { useLocale } from '@/i18n/client';
import { api, ApiClientError, qs } from '@/lib/api/client';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { AuroraBackground } from '@/components/effects/aurora-background';
import { NoiseOverlay } from '@/components/effects/noise-overlay';
import { LangSwitch } from '@/components/shared/lang-switch';
import { LogoMark } from '@/components/shared/logo';
import { printerErrorText } from '@/lib/printer/messages';
import type { PrintResult } from '@/lib/printer/types';
import { kioskPrintTicket } from '@/lib/queue/kiosk-print';
import { queuePrefix, ticketPrintUrl } from '@/lib/queue/ticket';
import { QUEUE_TYPES, type DisplayStateDTO, type KioskConfig, type KioskTicketResultDTO } from '@/lib/queue/types';
import { LiveClock } from './live-clock';
import { QUEUE_TYPE_META, QueueTypeIcon } from './queue-type-meta';

export interface KioskScreenProps {
  config: KioskConfig;
}

type Phase = 'idle' | 'busy' | 'result';
type PrintPhase = 'idle' | 'printing' | 'ok' | 'fallback' | 'error';

const TAP_COOLDOWN_MS = 1500;
const IDLE_ATTRACT_MS = 30_000;
const WAITING_POLL_MS = 15_000;

/** Kiosk ekrani: 4 ta katta tugma → talon raqami (katta), oldindagilar/kutish, avtomatik chop etish, hisoblagich */
export function KioskScreen({ config }: KioskScreenProps) {
  const { t, locale } = useLocale();
  const reduced = useReducedMotion();
  const [phase, setPhase] = React.useState<Phase>('idle');
  const [result, setResult] = React.useState<KioskTicketResultDTO | null>(null);
  const [printPhase, setPrintPhase] = React.useState<PrintPhase>('idle');
  const [printError, setPrintError] = React.useState<string>('');
  const [countdown, setCountdown] = React.useState(0);
  const [waiting, setWaiting] = React.useState<Record<QueueType, number> | null>(null);
  const [attract, setAttract] = React.useState(false);
  const lastTapRef = React.useRef(0);
  const busyRef = React.useRef(false);
  const resultShownAt = React.useRef(0);
  const idleTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const types = React.useMemo(() => {
    const enabled = QUEUE_TYPES.filter((x) => config.queue.enabledTypes.includes(x));
    return enabled.length ? enabled : [...QUEUE_TYPES];
  }, [config.queue.enabledTypes]);

  // ── Kutayotganlar soni (tablo holatidan) ──
  React.useEffect(() => {
    let disposed = false;
    const load = async () => {
      try {
        const s = await api.get<DisplayStateDTO>(`/api/display/state${qs({ key: config.key })}`);
        if (!disposed) setWaiting(s.waitingByType);
      } catch {
        // koʻrsatkich ixtiyoriy — jim
      }
    };
    void load();
    const id = setInterval(() => void load(), WAITING_POLL_MS);
    return () => {
      disposed = true;
      clearInterval(id);
    };
  }, [config.key]);

  // ── Boʻsh turganda jalb qiluvchi animatsiya ──
  const resetIdle = React.useCallback(() => {
    setAttract(false);
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setAttract(true), IDLE_ATTRACT_MS);
  }, []);
  React.useEffect(() => {
    resetIdle();
    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'touchstart'];
    for (const e of events) window.addEventListener(e, resetIdle, { passive: true });
    return () => {
      for (const e of events) window.removeEventListener(e, resetIdle);
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [resetIdle]);

  // ── Natija hisoblagichi ──
  React.useEffect(() => {
    if (phase !== 'result') return;
    if (countdown <= 0) {
      setPhase('idle');
      setResult(null);
      setPrintPhase('idle');
      return;
    }
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [phase, countdown]);

  const reportPrint = React.useCallback(
    (r: PrintResult) => {
      if (r.ok && !r.fallback) setPrintPhase('ok');
      else if (r.ok) setPrintPhase('fallback');
      else {
        setPrintPhase('error');
        setPrintError(printerErrorText(locale, r.errorCode));
      }
    },
    [locale],
  );

  const take = React.useCallback(
    async (type: QueueType) => {
      const now = Date.now();
      if (busyRef.current || now - lastTapRef.current < TAP_COOLDOWN_MS) return;
      lastTapRef.current = now;
      busyRef.current = true;
      setPhase('busy');
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        toast.error(t('queue.kiosk.offline'));
        busyRef.current = false;
        setPhase('idle');
        return;
      }
      try {
        const res = await api.post<KioskTicketResultDTO>('/api/kiosk/ticket', { key: config.key, type, locale });
        setResult(res);
        setCountdown(Math.max(2, res.showSeconds || config.queue.kioskShowSeconds));
        resultShownAt.current = Date.now();
        setPhase('result');
        setWaiting((w) => (w ? { ...w, [type]: w[type] + 1 } : w));
        if (config.printer.autoPrintTicket) {
          setPrintPhase('printing');
          void kioskPrintTicket(res.ticketData, config.printer, config.key, ticketPrintUrl(res.ticket.id, config.key)).then(reportPrint);
        } else {
          setPrintPhase('idle');
        }
      } catch (err) {
        const desc =
          err instanceof ApiClientError
            ? err.code === 'RATE_LIMITED'
              ? t('queue.errors.rateLimited')
              : err.code === 'NOT_FOUND'
                ? t('queue.errors.kioskKey')
                : err.message
            : t('queue.kiosk.errorDesc');
        toast.error(t('queue.kiosk.errorTitle'), { description: desc, duration: 6000 });
        setPhase('idle');
      } finally {
        busyRef.current = false;
      }
    },
    [config, locale, reportPrint, t],
  );

  const dismissResult = () => {
    if (phase !== 'result' || Date.now() - resultShownAt.current < 800) return;
    setCountdown(0);
  };

  const showSeconds = Math.max(2, result?.showSeconds ?? config.queue.kioskShowSeconds);
  const ringR = 30;
  const ringC = 2 * Math.PI * ringR;
  const ringProgress = result ? Math.max(0, Math.min(1, countdown / showSeconds)) : 0;

  return (
    <div className="relative isolate flex h-full w-full flex-col overflow-hidden" onPointerDown={phase === 'result' ? dismissResult : undefined}>
      <AuroraBackground intensity="high" />
      <NoiseOverlay />

      {/* Yuqori panel */}
      <header className="safe-top z-10 flex items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <LogoMark size={40} className="shrink-0" />
          <div className="min-w-0">
            <div className="truncate font-heading text-lg font-bold leading-tight text-text sm:text-2xl">{config.clinicName}</div>
            {config.clinicPhone ? (
              <div className="tabular flex items-center gap-1.5 text-xs text-text-muted sm:text-sm">
                <Phone className="size-3.5" aria-hidden="true" />
                {formatPhone(config.clinicPhone) || config.clinicPhone}
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <LiveClock withDate timeClassName="text-xl sm:text-3xl" dateClassName="hidden sm:block" />
          <LangSwitch variant="pill" size="md" />
        </div>
      </header>

      {/* Asosiy qism */}
      <main className="z-10 flex flex-1 flex-col items-center justify-center px-5 pb-6 sm:px-10">
        <AnimatePresence mode="wait" initial={false}>
          {phase === 'result' && result ? (
            <motion.section
              key="result"
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 220, damping: 20 }}
              className="flex w-full max-w-3xl flex-col items-center text-center"
              aria-live="assertive"
              role="status"
            >
              <p className="text-lg font-medium uppercase tracking-[0.2em] text-text-muted sm:text-2xl">{t('queue.kiosk.yourNumber')}</p>
              <div
                className={cn('tabular mt-2 font-heading font-black leading-none tracking-tight text-gradient', 'text-[clamp(88px,22vw,220px)]')}
                style={{ textShadow: '0 0 60px rgba(0,212,255,0.35)' }}
              >
                {result.ticket.number}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-base sm:text-xl">
                <span className="glass rounded-full px-5 py-2 text-text">
                  {t('queue.kiosk.ahead')}: <strong className="tabular">{t('queue.kiosk.aheadUnit', { n: result.ticket.ahead })}</strong>
                </span>
                <span className="glass rounded-full px-5 py-2 text-text">
                  {t('queue.kiosk.wait')}: <strong className="tabular">{t('queue.kiosk.waitUnit', { n: result.ticket.waitMin })}</strong>
                </span>
              </div>
              <p className="mt-6 text-xl font-semibold text-text sm:text-3xl">{t('queue.kiosk.takeTicket')}</p>
              <div className="mt-3 flex min-h-8 items-center gap-2 text-sm text-text-muted sm:text-lg" aria-live="polite">
                {printPhase === 'printing' ? (
                  <>
                    <Printer className="size-5 animate-pulse text-accent" aria-hidden="true" />
                    {t('queue.kiosk.printing')}
                  </>
                ) : printPhase === 'ok' || printPhase === 'fallback' ? (
                  <>
                    <CheckCircle2 className="size-5 text-[#00FFB2]" aria-hidden="true" />
                    {t('queue.kiosk.printed')}
                  </>
                ) : printPhase === 'error' ? (
                  <>
                    <AlertTriangle className="size-5 text-warning" aria-hidden="true" />
                    {t('queue.kiosk.printFailed')}
                    {printError ? <span className="sr-only">{printError}</span> : null}
                  </>
                ) : (
                  <>
                    <MonitorPlay className="size-5 text-accent" aria-hidden="true" />
                    {t('queue.kiosk.display')}
                  </>
                )}
              </div>
              <div className="mt-8 flex items-center gap-4 text-text-muted">
                <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden="true" className="-rotate-90">
                  <circle cx="36" cy="36" r={ringR} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
                  <circle
                    cx="36"
                    cy="36"
                    r={ringR}
                    fill="none"
                    stroke="url(#kiosk-ring)"
                    strokeWidth="5"
                    strokeLinecap="round"
                    strokeDasharray={ringC}
                    strokeDashoffset={ringC * (1 - ringProgress)}
                    style={{ transition: reduced ? undefined : 'stroke-dashoffset 1s linear' }}
                  />
                  <defs>
                    <linearGradient id="kiosk-ring" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#00D4FF" />
                      <stop offset="100%" stopColor="#7C5CFF" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="text-left text-sm sm:text-base">
                  <div className="tabular">{t('queue.kiosk.returning', { s: countdown })}</div>
                  <div className="text-xs opacity-70">{t('queue.kiosk.tapToContinue')}</div>
                </div>
              </div>
            </motion.section>
          ) : (
            <motion.section
              key="tiles"
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="flex w-full max-w-4xl flex-col items-center"
            >
              <h1 className="text-balance text-center font-heading text-3xl font-extrabold tracking-tight text-text sm:text-5xl">{t('queue.kiosk.welcome')}</h1>
              <p className="mt-2 text-center text-base text-text-muted sm:text-xl">{t('queue.kiosk.chooseService')}</p>

              <div className={cn('mt-8 grid w-full gap-4 sm:gap-6', types.length === 1 ? 'grid-cols-1 max-w-md' : 'grid-cols-1 sm:grid-cols-2')} role="group" aria-label={t('queue.kiosk.chooseService')}>
                {types.map((type, i) => {
                  const meta = QUEUE_TYPE_META[type];
                  const count = waiting?.[type];
                  return (
                    <motion.button
                      key={type}
                      type="button"
                      onClick={() => void take(type)}
                      disabled={phase === 'busy'}
                      whileTap={reduced ? undefined : { scale: 0.97 }}
                      whileHover={reduced ? undefined : { scale: 1.015 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                      className={cn(
                        'glass-strong relative flex min-h-[9.5rem] items-center gap-5 rounded-2xl border p-5 text-left sm:min-h-[12rem] sm:p-7',
                        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40 disabled:opacity-60',
                        meta.border,
                        attract && !reduced && 'animate-float',
                      )}
                      style={attract && !reduced ? { animationDelay: `${i * 0.35}s` } : undefined}
                      aria-label={`${t(`common.queueType.${type}`)} — ${t('queue.kiosk.tapToGet')}`}
                      data-cursor="hover"
                    >
                      <span className={cn('flex size-20 shrink-0 items-center justify-center rounded-2xl sm:size-24', meta.soft, meta.text, meta.glow)}>
                        <QueueTypeIcon type={type} className="size-10 sm:size-12" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-heading text-2xl font-bold leading-tight text-text sm:text-3xl">{t(`common.queueType.${type}`)}</span>
                        <span className="mt-1 block text-sm text-text-muted sm:text-base">{t('queue.kiosk.tapToGet')}</span>
                        {typeof count === 'number' ? (
                          <span className="tabular mt-2 inline-block rounded-full border border-line bg-popover/70 px-2.5 py-0.5 text-xs text-text-muted sm:text-sm">
                            {t('queue.kiosk.waitingNow', { n: count })}
                          </span>
                        ) : null}
                      </span>
                      <span className={cn('tabular absolute right-4 top-3 font-heading text-3xl font-black opacity-40 sm:text-4xl', meta.text)} aria-hidden="true">
                        {queuePrefix(type, config.queue)}
                      </span>
                    </motion.button>
                  );
                })}
              </div>

              {phase === 'busy' ? (
                <p className="mt-6 flex items-center gap-2 text-text-muted" role="status" aria-live="polite">
                  <Ticket className="size-5 animate-pulse text-accent" aria-hidden="true" />
                  {t('queue.kiosk.busy')}
                </p>
              ) : attract ? (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 2.4, repeat: Infinity }}
                  className="mt-6 text-sm uppercase tracking-[0.3em] text-text-muted"
                  aria-hidden="true"
                >
                  {t('queue.kiosk.idleHint')}
                </motion.p>
              ) : (
                <p className="mt-6 text-sm text-text-muted">{t('queue.kiosk.display')}</p>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <footer className="safe-bottom z-10 px-5 pb-4 text-center text-xs text-text-muted sm:text-sm">{config.ticketFooter}</footer>
    </div>
  );
}
