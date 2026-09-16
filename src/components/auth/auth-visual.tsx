'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, Sparkles, Stethoscope, Users, Wallet } from 'lucide-react';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useT } from '@/i18n/client';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';

/**
 * Auth sahifalarining oʻng ustuni: aurora fon, jonli navbat mock-kartasi va suzuvchi statistika chiplari.
 * Faqat `lg` va undan keng ekranlarda koʻrsatiladi (layout yashiradi). `prefers-reduced-motion` hurmat qilinadi.
 */

const QUEUE_START = 12;
const QUEUE_END = 19;
const TICK_MS = 3200;
const TICK_REDUCED_MS = 8000;
const TODAY_REVENUE = 4_850_000;
const TODAY_PATIENTS = 128;

function ticketNumber(seq: number): string {
  return `A-${String(seq).padStart(3, '0')}`;
}

export interface AuthVisualProps {
  className?: string;
}

export function AuthVisual({ className }: AuthVisualProps) {
  const t = useT();
  const reduced = useReducedMotion();
  const [seq, setSeq] = useState(QUEUE_START);

  useEffect(() => {
    const id = window.setInterval(
      () => setSeq((s) => (s >= QUEUE_END ? QUEUE_START : s + 1)),
      reduced ? TICK_REDUCED_MS : TICK_MS,
    );
    return () => window.clearInterval(id);
  }, [reduced]);

  const current = ticketNumber(seq);
  const upcoming = [1, 2, 3].map((i) => ticketNumber(seq + i));
  const waiting = QUEUE_END - seq + 4;

  const stats = [
    {
      key: 'revenue',
      icon: Wallet,
      label: t('auth.visual.stat1'),
      value: formatMoney(TODAY_REVENUE, { suffix: t('common.currency') }),
      tone: 'text-accent bg-primary/15',
      position: 'left-[-8%] top-[6%]',
      delay: '0s',
    },
    {
      key: 'queue',
      icon: Activity,
      label: t('auth.visual.stat2'),
      value: `${waiting} · ${t('auth.visual.waiting')}`,
      tone: 'text-[#00FFB2] bg-[#00FFB2]/15',
      position: 'right-[-10%] top-[34%]',
      delay: '1.4s',
    },
    {
      key: 'patients',
      icon: Users,
      label: t('auth.visual.stat3'),
      value: `${TODAY_PATIENTS} · ${t('auth.visual.today')}`,
      tone: 'text-[#B9A7FF] bg-[#7C5CFF]/20',
      position: 'bottom-[-6%] left-[4%]',
      delay: '2.6s',
    },
  ] as const;

  return (
    <div className={cn('relative h-full min-h-dvh w-full overflow-hidden bg-bg-elevated', className)}>
      {/* ── Aurora fon ── */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div
          className={cn(
            'absolute -left-1/4 -top-1/4 size-[70%] rounded-full opacity-60 blur-3xl',
            'bg-[radial-gradient(circle_at_center,rgba(0,212,255,0.55),transparent_62%)]',
            !reduced && 'animate-aurora',
          )}
        />
        <div
          className={cn(
            'absolute -right-1/4 top-1/4 size-[65%] rounded-full opacity-50 blur-3xl',
            'bg-[radial-gradient(circle_at_center,rgba(124,92,255,0.6),transparent_62%)]',
            !reduced && 'animate-aurora-slow',
          )}
        />
        <div
          className={cn(
            'absolute -bottom-1/4 left-1/4 size-[55%] rounded-full opacity-40 blur-3xl',
            'bg-[radial-gradient(circle_at_center,rgba(0,255,178,0.45),transparent_62%)]',
            !reduced && 'animate-aurora',
          )}
          style={{ animationDelay: '-14s' }}
        />
        <div className="bg-grid bg-grid-fade absolute inset-0 opacity-70" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(6,8,16,0.9),rgba(6,8,16,0.2)_60%,transparent)]" />
      </div>

      {/* ── Markaziy sahna ── */}
      <div className="relative z-10 flex h-full min-h-dvh flex-col justify-between px-12 py-12 xl:px-16">
        <div className="flex flex-1 items-center justify-center">
          <div className="relative w-full max-w-[400px]">
            {/* Shisha karta — jonli navbat */}
            <div className="glass noise p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                  <span className="relative flex size-2">
                    <span
                      className={cn(
                        'absolute inline-flex size-full rounded-full bg-[#00FFB2] opacity-75',
                        !reduced && 'animate-pulse-ring',
                      )}
                    />
                    <span className="relative inline-flex size-2 rounded-full bg-[#00FFB2]" />
                  </span>
                  {t('auth.visual.queueLabel')}
                </div>
                <span className="rounded-full border border-[#00FFB2]/20 bg-[#00FFB2]/10 px-2 py-0.5 text-[11px] font-semibold text-[#00FFB2]">
                  {t('auth.visual.live')}
                </span>
              </div>

              <p className="mt-6 text-xs text-text-muted">{t('auth.visual.nowServing')}</p>
              <div className="relative mt-1 h-16 overflow-hidden" aria-live="polite" aria-atomic="true">
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.div
                    key={current}
                    initial={reduced ? { opacity: 0 } : { y: 48, opacity: 0, filter: 'blur(6px)' }}
                    animate={reduced ? { opacity: 1 } : { y: 0, opacity: 1, filter: 'blur(0px)' }}
                    exit={reduced ? { opacity: 0 } : { y: -48, opacity: 0, filter: 'blur(6px)' }}
                    transition={reduced ? { duration: 0.2 } : { type: 'spring', stiffness: 260, damping: 26 }}
                    className="text-gradient tabular absolute inset-0 font-heading text-6xl font-extrabold leading-none tracking-tight"
                  >
                    {current}
                  </motion.div>
                </AnimatePresence>
              </div>

              <div className="mt-4 flex items-center gap-2 text-sm text-text">
                <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-accent">
                  <Stethoscope className="size-4" aria-hidden="true" />
                </span>
                <span className="truncate">{t('auth.visual.doctor')}</span>
                <span className="text-text-muted">·</span>
                <span className="text-text-muted">{t('auth.visual.room')} 3</span>
              </div>

              <div className="mt-5 border-t border-border/70 pt-4">
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-text-muted">
                  {t('auth.visual.next')}
                </p>
                <div className="flex gap-2">
                  {upcoming.map((n, i) => (
                    <span
                      key={n}
                      className={cn(
                        'tabular rounded-md border px-2.5 py-1 text-xs font-semibold',
                        i === 0
                          ? 'border-primary/30 bg-primary/10 text-accent'
                          : 'bg-bg-elevated/60 border-border/70 text-text-muted',
                      )}
                    >
                      {n}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Suzuvchi statistika chiplari */}
            {stats.map((s) => (
              <div
                key={s.key}
                className={cn(
                  'glass-strong absolute flex items-center gap-3 px-4 py-3',
                  s.position,
                  !reduced && 'animate-float',
                )}
                style={{ animationDelay: s.delay }}
              >
                <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', s.tone)}>
                  <s.icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] leading-tight text-text-muted">{s.label}</p>
                  <p className="tabular mt-0.5 whitespace-nowrap font-heading text-sm font-semibold text-text">
                    {s.value}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Matn */}
        <div className="max-w-md">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-accent">
            <Sparkles className="size-3.5" aria-hidden="true" />
            {t('auth.visual.badge')}
          </span>
          <h2 className="mt-4 font-heading text-3xl font-bold leading-tight text-text xl:text-4xl">
            {t('auth.visual.title')}
          </h2>
          <p className="mt-3 text-base leading-relaxed text-text-muted">{t('auth.visual.subtitle')}</p>
        </div>
      </div>
    </div>
  );
}
