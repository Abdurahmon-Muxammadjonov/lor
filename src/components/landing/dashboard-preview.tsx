'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { Activity, Calculator } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale } from '@/i18n/client';
import { fmtDate } from '@/lib/date';
import { calcLine } from '@/lib/calc';
import { formatQuantity } from '@/lib/calc';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { Badge } from '@/components/ui/badge';
import { LogoMark } from '@/components/shared/logo';
import { Money } from '@/components/shared/money';
import { StatCard } from '@/components/shared/stat-card';
import { StatusBadge } from '@/components/shared/status-badge';
import { DEMO_SERVICES } from '@/data/demo-services';

const TICK_MS = 3000;
const START_SEQ = 14;
const ROWS = 4;

const NAMES = [
  'Karimova D.',
  'Rahimov B.',
  'Toshmatova N.',
  'Yusupov A.',
  'Saidova M.',
  'Qodirov J.',
  'Ergasheva Z.',
  'Mirzayev S.',
];
const DOCTORS = [
  { name: 'Dr. Aliyev', room: '3' },
  { name: 'Dr. Nazarova', room: '5' },
] as const;
const QTY_CYCLE = [1, 1.5, 2, 2.5] as const;
/** Haftalik tushum, mln soʻm */
const WEEK = [6.2, 7.1, 5.8, 8.4, 7.9, 9.3, 8.45] as const;
const DAY_KEYS = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'] as const;
const CALC_SERVICE = DEMO_SERVICES[0];

type QueueStatus = 'SERVING' | 'CALLED' | 'WAITING';

interface QueueRow {
  seq: number;
  number: string;
  name: string;
  doctor: (typeof DOCTORS)[number];
  status: QueueStatus;
}

function pad3(n: number): string {
  return String(n).padStart(3, '0');
}

function buildRows(base: number): QueueRow[] {
  return Array.from({ length: ROWS }, (_, i) => {
    const seq = base + i;
    return {
      seq,
      number: `A-${pad3(seq)}`,
      name: NAMES[seq % NAMES.length] ?? NAMES[0] ?? '',
      doctor: DOCTORS[seq % DOCTORS.length] ?? DOCTORS[0],
      status: i === 0 ? 'SERVING' : i === 1 ? 'CALLED' : 'WAITING',
    };
  });
}

/**
 * Hero dagi "jonli" mini dashboard: statistika, haftalik diagramma, har 3 soniyada oldinga siljiydigan navbat
 * va haqiqiy calcLine bilan hisoblanadigan kalkulyator qatori. Faqat brauzerda (dynamic, ssr:false).
 */
export function DashboardPreview() {
  const { t, locale } = useLocale();
  const reduced = useReducedMotion();
  const [tick, setTick] = React.useState(0);
  const [today] = React.useState(() => new Date());

  React.useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') setTick((n) => n + 1);
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const rows = React.useMemo(() => buildRows(START_SEQ + tick), [tick]);
  const qty = QTY_CYCLE[tick % QTY_CYCLE.length] ?? 1;
  const calc = React.useMemo(
    () =>
      CALC_SERVICE
        ? calcLine(
            {
              patientType: 'ADULT',
              withMedicine: false,
              quantity: qty,
              discountType: 'NONE',
              discountValue: 0,
            },
            CALC_SERVICE,
          )
        : null,
    [qty],
  );
  const chartData = React.useMemo(
    () => WEEK.map((v, i) => ({ day: t(`landing.hero.preview.days.${DAY_KEYS[i] ?? 'mo'}`), v })),
    [t],
  );
  const serviceName = CALC_SERVICE ? (locale === 'ru' ? CALC_SERVICE.nameRu : CALC_SERVICE.name) : '';
  const revenueMln = `8,45 ${t('landing.hero.preview.million')}`;

  return (
    <div
      className="glass-strong w-full p-4 text-left sm:p-5"
      aria-label={t('landing.hero.previewLabel')}
      role="group"
    >
      {/* Sarlavha */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <LogoMark size={22} />
          <span className="truncate font-heading text-sm font-bold text-text">Shifo LOR</span>
          <span className="hidden text-xs text-text-muted sm:inline">
            · {t('landing.hero.preview.today')}, {fmtDate(today, locale)}
          </span>
        </div>
        <Badge variant="success" dot className="shrink-0">
          {t('landing.hero.preview.live')}
        </Badge>
      </div>

      {/* Statistika */}
      <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard
          title={t('landing.hero.preview.patients')}
          value={42}
          delta={12}
          accent="cyan"
          className="p-3 sm:p-4 [&_.font-heading]:text-lg sm:[&_.font-heading]:text-2xl"
        />
        <StatCard
          title={t('landing.hero.preview.revenue')}
          value={revenueMln}
          delta={8.5}
          accent="mint"
          className="p-3 sm:p-4 [&_.font-heading]:text-lg sm:[&_.font-heading]:text-2xl"
        />
        <StatCard
          title={t('landing.hero.preview.queue')}
          value={7}
          hint={`A-${pad3(START_SEQ + tick)}`}
          accent="violet"
          className="p-3 sm:p-4 [&_.font-heading]:text-lg sm:[&_.font-heading]:text-2xl"
        />
      </div>

      {/* Diagramma */}
      <div className="bg-bg-elevated/70 mt-4 rounded-lg border border-line p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold uppercase tracking-wider text-text-muted">
            {t('landing.hero.preview.chartTitle')}
          </span>
          <span className="inline-flex items-center gap-1 text-[#00FFB2]">
            <Activity className="size-3.5" aria-hidden="true" />
            +18%
          </span>
        </div>
        <div className="mt-2 h-[110px] w-full" aria-hidden="true">
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 480, height: 110 }}>
            <AreaChart data={chartData} margin={{ top: 6, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="lor-preview-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00D4FF" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#7C5CFF" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="day"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#8A99B8', fontSize: 10 }}
                interval={0}
                height={16}
              />
              <YAxis hide domain={[0, 10.5]} />
              <Area
                type="monotone"
                dataKey="v"
                stroke="#00D4FF"
                strokeWidth={2}
                fill="url(#lor-preview-fill)"
                isAnimationActive={false}
                dot={false}
                activeDot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Jonli navbat */}
      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-semibold uppercase tracking-wider text-text-muted">
            {t('landing.hero.preview.liveQueue')}
          </span>
          <span className="tabular text-text-muted">{ROWS}</span>
        </div>
        <ul className="space-y-1.5" aria-live="off">
          <AnimatePresence initial={false} mode="popLayout">
            {rows.map((r) => (
              <motion.li
                key={r.seq}
                layout={!reduced}
                initial={reduced ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduced ? undefined : { opacity: 0, y: -10 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className={cn(
                  'flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs sm:gap-3 sm:text-sm',
                  r.status === 'SERVING'
                    ? 'border-primary/25 bg-primary/10'
                    : 'bg-bg-elevated/60 border-line',
                )}
              >
                <span
                  className={cn(
                    'tabular w-14 shrink-0 font-heading font-bold',
                    r.status === 'SERVING' ? 'text-accent' : 'text-text',
                  )}
                >
                  {r.number}
                </span>
                <span className="min-w-0 flex-1 truncate text-text">{r.name}</span>
                <span className="hidden shrink-0 text-text-muted sm:inline">
                  {r.doctor.name} · {r.doctor.room}-{t('landing.hero.preview.room')}
                </span>
                <StatusBadge kind="queue" status={r.status} className="shrink-0" />
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>

      {/* Kalkulyator qatori */}
      {calc && CALC_SERVICE ? (
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-[#7C5CFF]/30 bg-[#7C5CFF]/10 px-3 py-2.5 text-xs sm:text-sm">
          <span className="inline-flex items-center gap-1.5 font-semibold uppercase tracking-wider text-text-muted">
            <Calculator className="size-3.5 text-accent-2" aria-hidden="true" />
            {t('landing.hero.preview.calcTitle')}
          </span>
          <span className="min-w-0 flex-1 truncate text-text">{serviceName}</span>
          <span className="tabular whitespace-nowrap text-text">
            <span
              key={qty}
              className={cn(
                'inline-block font-bold text-accent',
                !reduced && 'duration-300 animate-in fade-in zoom-in-95',
              )}
            >
              {formatQuantity(calc.quantity)}
            </span>{' '}
            × <Money value={calc.unitPrice.toNumber()} suffix={null} /> ={' '}
            <Money value={calc.gross.toNumber()} className="font-bold text-[#00FFB2]" />
          </span>
        </div>
      ) : null}
    </div>
  );
}
