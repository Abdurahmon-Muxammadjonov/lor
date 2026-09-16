'use client';

import * as React from 'react';
import { RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale } from '@/i18n/client';
import { fmtDate, fmtTime } from '@/lib/date';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

export interface TicketAnimationProps {
  /** Navbat raqami (default "A-001") */
  number?: string;
  clinicName?: string;
  /** Xizmat nomi (default: "Shifokor qabuli" / "Приём врача") */
  service?: string;
  /** Oldindagi odamlar soni (default 3) */
  ahead?: number;
  /** Bir bemorga oʻrtacha daqiqa (default 5) */
  avgMinutes?: number;
  /** Har 6 soniyada qayta chop etish (default true) */
  autoplay?: boolean;
  /** Takrorlash oraligʻi, ms (default 6000) */
  interval?: number;
  className?: string;
}

const LABELS = {
  uz: {
    ahead: 'Oldingizda',
    people: 'kishi',
    wait: 'Kutish',
    footer: 'Sogʻ boʻling!',
    replay: 'Qayta chop etish',
    printer: 'Termo printer · 58 mm',
    printing: 'Chop etilmoqda…',
    ready: 'Tayyor',
    ticket: 'Navbat taloni',
  },
  ru: {
    ahead: 'Перед вами',
    people: 'чел.',
    wait: 'Ожидание',
    footer: 'Будьте здоровы!',
    replay: 'Напечатать снова',
    printer: 'Термопринтер · 58 мм',
    printing: 'Печать…',
    ready: 'Готов',
    ticket: 'Талон очереди',
  },
} as const;

const TICKET_WIDTH = 220;
const TOOTH = 10;
const TOOTH_DEPTH = 6;

/** Pastki qirqilgan (zigzag) chekka uchun clip-path */
function zigzagClipPath(width: number): string {
  const points: string[] = ['0 0', '100% 0', `100% calc(100% - ${TOOTH_DEPTH}px)`];
  const teeth = Math.floor(width / TOOTH);
  for (let i = teeth; i > 0; i--) {
    points.push(`${(i - 0.5) * TOOTH}px 100%`);
    points.push(`${(i - 1) * TOOTH}px calc(100% - ${TOOTH_DEPTH}px)`);
  }
  return `polygon(${points.join(', ')})`;
}

/** Sodda deterministik hash (QR taqlidi uchun) */
function hash(s: string, seed: number): number {
  let h = 2166136261 ^ seed;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** 17×17 QR-koʻrinishidagi naqsh — bitta SVG path */
function qrPath(seed: string): string {
  const N = 17;
  const cells: string[] = [];
  const finder = (ox: number, oy: number) => {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const ring = x === 0 || y === 0 || x === 6 || y === 6;
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        if (ring || core) cells.push(`M${ox + x} ${oy + y}h1v1h-1z`);
      }
    }
  };
  finder(0, 0);
  finder(N - 7, 0);
  finder(0, N - 7);
  const inFinder = (x: number, y: number) =>
    (x < 8 && y < 8) || (x >= N - 8 && y < 8) || (x < 8 && y >= N - 8);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (inFinder(x, y)) continue;
      if (hash(seed, x * 31 + y * 17) % 100 < 45) cells.push(`M${x} ${y}h1v1h-1z`);
    }
  }
  return cells.join('');
}

/**
 * Termo printer maketi: korpus + slotdan sirpanib chiqadigan navbat taloni (`animate-ticket-out`).
 * Autoplay da har 6 soniyada qayta chop etadi (faqat tab koʻrinib turganda). Reduced-motion da statik.
 *
 *   <TicketAnimation number="A-012" clinicName="Shifo LOR" />
 */
export function TicketAnimation({
  number = 'A-001',
  clinicName,
  service,
  ahead = 3,
  avgMinutes = 5,
  autoplay = true,
  interval = 6000,
  className,
}: TicketAnimationProps) {
  const { locale, t } = useLocale();
  const L = LABELS[locale];
  const reduced = useReducedMotion();

  const [run, setRun] = React.useState(0);
  const [printing, setPrinting] = React.useState(false);
  const [now, setNow] = React.useState<Date | null>(null);

  const clinic = clinicName ?? t('common.appName');
  const serviceName = service ?? t('common.queueType.DOCTOR');
  const waitMin = Math.max(0, Math.round(ahead * avgMinutes));
  const clip = React.useMemo(() => zigzagClipPath(TICKET_WIDTH), []);
  const qr = React.useMemo(() => qrPath(`${number}|${clinic}`), [number, clinic]);

  // Har chop etishda sana/vaqt yangilanadi (faqat brauzerda — gidratsiya mos kelishi uchun)
  React.useEffect(() => {
    setNow(new Date());
    if (reduced) return;
    setPrinting(true);
    const id = window.setTimeout(() => setPrinting(false), 1000);
    return () => window.clearTimeout(id);
  }, [run, reduced]);

  // Avtomatik takrorlash
  React.useEffect(() => {
    if (!autoplay || reduced) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') setRun((r) => r + 1);
    }, Math.max(2000, interval));
    return () => window.clearInterval(id);
  }, [autoplay, reduced, interval, run]);

  const replay = () => setRun((r) => r + 1);

  return (
    <div className={cn('relative mx-auto w-[280px] select-none', className)} data-cursor="hover">
      {/* Printer korpusi */}
      <div className="relative z-20 rounded-2xl border border-line bg-gradient-to-b from-[#1B2540] to-[#0D1220] p-4 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden="true"
              className={cn(
                'size-2 shrink-0 rounded-full',
                printing ? 'animate-pulse bg-warning shadow-[0_0_8px_rgba(255,181,71,0.8)]' : 'bg-[#00FFB2] shadow-[0_0_8px_rgba(0,255,178,0.8)]',
              )}
            />
            <span className="truncate text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
              {printing ? L.printing : L.printer}
            </span>
          </div>
          <button
            type="button"
            onClick={replay}
            aria-label={L.replay}
            title={L.replay}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-line bg-bg-elevated text-text-muted transition-colors hover:border-[#2B3A57] hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
          </button>
        </div>
        {/* Slot */}
        <div className="mt-3 h-2.5 rounded-full border border-line bg-bg-base shadow-[inset_0_2px_4px_rgba(0,0,0,0.7)]" />
        <div className="mx-auto mt-2 h-1 w-16 rounded-full bg-line" aria-hidden="true" />
      </div>

      {/* Talon oynasi */}
      <div className="relative z-10 -mt-5 overflow-hidden px-4 pb-3 pt-5" role="img" aria-label={`${L.ticket}: ${number}`}>
        <div
          key={run}
          className={cn(
            'mx-auto bg-[#F7F7F2] text-[#0F1320] shadow-[0_18px_40px_-16px_rgba(0,0,0,0.8)] will-change-transform',
            !reduced && 'animate-ticket-out',
          )}
          style={{ width: TICKET_WIDTH, clipPath: clip }}
        >
          <div className="px-4 pb-5 pt-4 font-mono text-[11px] leading-tight">
            <div className="text-center text-[12px] font-bold uppercase tracking-wide">{clinic}</div>
            <div className="my-2 border-t border-dashed border-[#B8BCC8]" />
            <div className="text-center text-[9px] uppercase tracking-[0.2em] text-[#5A6275]">{t('common.queueNumber')}</div>
            <div className="mt-1 text-center font-heading text-[44px] font-extrabold leading-none tracking-tight">{number}</div>
            <div className="mt-2 text-center text-[11px] font-semibold">{serviceName}</div>
            <div className="my-2 border-t border-dashed border-[#B8BCC8]" />
            <div className="flex justify-between tabular">
              <span>{now ? fmtDate(now, locale) : ''}</span>
              <span>{now ? fmtTime(now, locale) : ''}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span>{L.ahead}</span>
              <span className="tabular">
                {ahead} {L.people}
              </span>
            </div>
            <div className="mt-1 flex justify-between">
              <span>{L.wait}</span>
              <span className="tabular">
                ≈ {waitMin} {t('common.minutes')}
              </span>
            </div>
            <div className="my-2 border-t border-dashed border-[#B8BCC8]" />
            <svg viewBox="0 0 17 17" width="52" height="52" className="mx-auto" aria-hidden="true" shapeRendering="crispEdges">
              <path d={qr} fill="#0F1320" />
            </svg>
            <div className="mt-2 text-center text-[10px] font-semibold">{L.footer}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
