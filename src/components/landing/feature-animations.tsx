'use client';

import * as React from 'react';
import { useInView } from 'framer-motion';
import { Check, Languages, Send, ShieldCheck, Smartphone, X } from 'lucide-react';
import type { Role } from '@prisma/client';
import { cn } from '@/lib/utils';
import { useLocale } from '@/i18n/client';
import { getMessages } from '@/i18n/messages';
import { makeT } from '@/i18n/t';
import type { Locale } from '@/i18n/config';
import { calcLine, calcVisit, formatQuantity, type PatientType } from '@/lib/calc';
import { can, type Permission } from '@/lib/permissions';
import { fmtDate } from '@/lib/date';
import { formatMoney } from '@/lib/money';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { Money } from '@/components/shared/money';
import { TicketAnimation } from '@/components/effects/ticket-animation';
import { DEMO_SERVICES, findDemoService } from '@/data/demo-services';
import { renderTemplate } from './template';

/** Tab yashirin boʻlsa toʻxtaydigan interval; reduced-motion da umuman ishlamaydi */
function useCycle(length: number, ms: number, enabled: boolean): number {
  const [i, setI] = React.useState(0);
  React.useEffect(() => {
    if (!enabled || length < 2) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') setI((v) => (v + 1) % length);
    }, ms);
    return () => window.clearInterval(id);
  }, [enabled, length, ms]);
  return i;
}

/* ─────────────────────────── (a) Kalkulyator plitkalari ─────────────────────────── */

const CALC_TILES: Array<{ patientType: PatientType; withMedicine: boolean }> = [
  { patientType: 'ADULT', withMedicine: false },
  { patientType: 'ADULT', withMedicine: true },
  { patientType: 'CHILD', withMedicine: false },
  { patientType: 'CHILD', withMedicine: true },
];
const CALC_QTYS = [1, 1.5, 2, 2.5] as const;
const CALC_STEPS = CALC_TILES.length * CALC_QTYS.length;

export function CalcTilesAnimation() {
  const { t, locale } = useLocale();
  const reduced = useReducedMotion();
  const step = useCycle(CALC_STEPS, 1500, !reduced);
  const service = DEMO_SERVICES[0];
  if (!service) return null;
  const active = step % CALC_TILES.length;
  const qtyIndex = reduced ? 1 : Math.floor(step / CALC_TILES.length) % CALC_QTYS.length;
  const qty = CALC_QTYS[qtyIndex] ?? 1;
  const tile = CALC_TILES[active] ?? CALC_TILES[0];
  const result = tile
    ? calcLine({ ...tile, quantity: qty, discountType: 'NONE', discountValue: 0 }, service)
    : null;
  const name = locale === 'ru' ? service.nameRu : service.name;

  return (
    <div className="flex h-full flex-col gap-3" role="img" aria-label={t('landing.features.calc.label')}>
      <div className="truncate text-xs font-semibold uppercase tracking-wider text-text-muted">{name}</div>
      <div className="grid grid-cols-2 gap-2">
        {CALC_TILES.map((tl, i) => {
          const price = calcLine(
            { ...tl, quantity: 1, discountType: 'NONE', discountValue: 0 },
            service,
          ).unitPrice.toNumber();
          const isActive = i === active;
          return (
            <div
              key={`${tl.patientType}-${tl.withMedicine}`}
              className={cn(
                'rounded-lg border px-3 py-2.5 transition-[border-color,background-color,box-shadow,transform] duration-300',
                isActive ? 'border-primary/40 bg-primary/10 shadow-glow' : 'bg-bg-elevated/60 border-line',
                isActive && !reduced && 'scale-[1.02]',
              )}
            >
              <div className="text-[11px] text-text-muted">
                {tl.patientType === 'ADULT'
                  ? t('landing.features.calc.adult')
                  : t('landing.features.calc.child')}{' '}
                · {tl.withMedicine ? t('landing.features.calc.med') : t('landing.features.calc.noMed')}
              </div>
              <Money
                value={price}
                className={cn('mt-1 block text-sm font-bold', isActive ? 'text-accent' : 'text-text')}
              />
            </div>
          );
        })}
      </div>

      {/* Miqdor — 0.5 qadam */}
      <div className="bg-bg-elevated/60 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          {t('landing.features.calc.qty')} · {t('landing.demo.unit.seans')}
        </span>
        <div className="flex items-center gap-1">
          {CALC_QTYS.map((q, i) => (
            <span
              key={q}
              className={cn(
                'tabular inline-flex h-7 min-w-[2.25rem] items-center justify-center rounded-md px-1.5 text-xs font-bold transition-[background-color,color,box-shadow] duration-300',
                i === qtyIndex
                  ? 'bg-gradient-accent text-bg-base shadow-glow'
                  : 'bg-bg-base text-text-muted ring-1 ring-line',
              )}
            >
              {formatQuantity(q)}
            </span>
          ))}
        </div>
      </div>

      {result ? (
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#00FFB2]/25 bg-[#00FFB2]/10 px-3 py-2 text-sm">
          <span className="tabular text-text-muted">
            <span className="font-bold text-text">{formatQuantity(result.quantity)}</span>{' '}
            {t('landing.demo.unit.seans')} × <Money value={result.unitPrice.toNumber()} suffix={null} />
          </span>
          <span className="font-heading text-base font-extrabold text-[#00FFB2]">
            <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              {t('landing.features.calc.result')}
            </span>
            <Money
              key={step}
              value={result.net.toNumber()}
              className={cn(!reduced && 'duration-300 animate-in fade-in zoom-in-95')}
            />
          </span>
        </div>
      ) : null}
    </div>
  );
}

/* ─────────────────────────── (b) Talon printeri (kichik) ─────────────────────────── */

export function TicketMiniAnimation() {
  return (
    <div className="relative h-[280px] overflow-hidden lg:h-[300px]">
      <div className="origin-top scale-[0.72] sm:scale-[0.8]">
        <TicketAnimation number="A-014" ahead={3} avgMinutes={5} interval={7000} />
      </div>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-[#131A2B] to-transparent"
      />
    </div>
  );
}

/* ─────────────────────────── (c) Chek — qatorlar yozilishi ─────────────────────────── */

const RECEIPT_INPUTS = [
  {
    code: 'N-001',
    patientType: 'ADULT' as const,
    withMedicine: false,
    quantity: 1.5,
    discountType: 'NONE' as const,
    discountValue: 0,
  },
  {
    code: 'E-001',
    patientType: 'CHILD' as const,
    withMedicine: false,
    quantity: 1,
    discountType: 'NONE' as const,
    discountValue: 0,
  },
  {
    code: 'F-002',
    patientType: 'ADULT' as const,
    withMedicine: false,
    quantity: 5,
    discountType: 'PERCENT' as const,
    discountValue: 10,
  },
];

export function ReceiptTypingAnimation() {
  const { t, locale } = useLocale();
  const reduced = useReducedMotion();
  const lines = React.useMemo(
    () =>
      RECEIPT_INPUTS.flatMap((input) => {
        const s = findDemoService(input.code);
        if (!s) return [];
        const r = calcLine(input, s);
        return [
          {
            code: input.code,
            name: locale === 'ru' ? s.nameRu : s.name,
            qty: formatQuantity(r.quantity),
            net: r.net.toNumber(),
          },
        ];
      }),
    [locale],
  );
  const totals = React.useMemo(
    () =>
      calcVisit(
        lines.map((l) => l.net),
        { type: 'NONE', value: 0 },
        [],
        100,
      ),
    [lines],
  );
  const steps = lines.length + 3; // qatorlar + jami + toʻlandi + rahmat
  const [shown, setShown] = React.useState(reduced ? steps : 0);

  React.useEffect(() => {
    if (reduced) {
      setShown(steps);
      return;
    }
    let timer = 0;
    const tickStep = () => {
      setShown((n) => {
        const next = n >= steps ? 0 : n + 1;
        timer = window.setTimeout(tickStep, next === steps ? 2600 : next === 0 ? 400 : 480);
        return next;
      });
    };
    timer = window.setTimeout(tickStep, 400);
    return () => window.clearTimeout(timer);
  }, [reduced, steps]);

  const row = (visible: boolean, key: string, children: React.ReactNode, className?: string) => (
    <div
      key={key}
      className={cn(
        'flex justify-between gap-2 transition-opacity duration-300',
        visible ? 'opacity-100' : 'opacity-0',
        className,
      )}
      aria-hidden={!visible}
    >
      {children}
    </div>
  );

  return (
    <div
      className="mx-auto w-full max-w-[260px] rounded-md bg-[#F7F7F2] px-4 py-3 font-mono text-[11px] leading-snug text-[#0F1320] shadow-[0_18px_40px_-16px_rgba(0,0,0,0.8)]"
      role="img"
      aria-label={t('landing.features.cashier.label')}
    >
      <div className="text-center text-xs font-bold tracking-wide">
        Shifo LOR · {t('landing.features.cashier.receipt')}
      </div>
      <div className="my-1.5 border-t border-dashed border-[#B8BCC8]" />
      {lines.map((l, i) =>
        row(
          shown > i,
          l.code,
          <>
            <span className="min-w-0 flex-1 truncate">
              {l.name} × {l.qty}
            </span>
            <span className="tabular shrink-0">{formatMoney(l.net, { suffix: '' })}</span>
          </>,
        ),
      )}
      <div className="my-1.5 border-t border-dashed border-[#B8BCC8]" />
      {row(
        shown > lines.length,
        'total',
        <>
          <span className="font-bold">{t('landing.features.cashier.total')}</span>
          <span className="tabular font-bold">{formatMoney(totals.total, { suffix: '' })}</span>
        </>,
      )}
      {row(
        shown > lines.length + 1,
        'paid',
        <>
          <span>
            {t('landing.features.cashier.paid')} · {t('landing.features.cashier.cash')}
          </span>
          <span className="tabular">{formatMoney(totals.total, { suffix: '' })}</span>
        </>,
      )}
      {row(
        shown > lines.length + 2,
        'thanks',
        <span className="w-full text-center">{t('landing.features.cashier.thanks')}</span>,
        'mt-1.5 text-[10px]',
      )}
    </div>
  );
}

/* ─────────────────────────── (d) LOR anatomiyasi ─────────────────────────── */

const REGIONS = [
  { key: 'ear', organ: 'EAR', cx: 54, cy: 62, side: 'LEFT' },
  { key: 'nose', organ: 'NOSE', cx: 132, cy: 66, side: 'BOTH' },
  { key: 'throat', organ: 'THROAT', cx: 104, cy: 112, side: 'RIGHT' },
] as const;

export function AnatomyAnimation() {
  const { t } = useLocale();
  const reduced = useReducedMotion();
  const active = useCycle(REGIONS.length, 2200, !reduced);
  const region = REGIONS[active] ?? REGIONS[0];

  return (
    <div
      className="flex h-full items-center gap-3"
      role="img"
      aria-label={t('landing.features.anatomy.label')}
    >
      <svg viewBox="0 0 160 140" className="h-36 w-auto shrink-0" aria-hidden="true">
        <defs>
          <linearGradient id="lor-anatomy-stroke" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#00D4FF" />
            <stop offset="1" stopColor="#7C5CFF" />
          </linearGradient>
        </defs>
        {/* Bosh profili (qoʻlda chizilgan) */}
        <path
          d="M46 22 C72 4 112 8 126 38 C133 52 129 58 136 66 C139 70 132 72 134 77 C136 81 129 85 131 92 C127 98 118 97 112 100 C106 106 102 120 96 132 L60 132 C62 120 58 110 50 100 C34 84 28 48 46 22 Z"
          fill="rgba(0,212,255,0.04)"
          stroke="url(#lor-anatomy-stroke)"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        {/* Quloq */}
        <path
          d="M60 50 C48 46 44 66 53 74 C58 78 64 74 63 66 C62 60 58 58 56 60"
          fill="none"
          stroke="#8A99B8"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
        {/* Burun / lab chizigʻi */}
        <path
          d="M126 46 C130 56 128 60 134 66 C137 70 130 72 132 76"
          fill="none"
          stroke="#8A99B8"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
        {/* Tomoq / hiqildoq */}
        <path
          d="M100 104 C104 112 104 122 100 130"
          fill="none"
          stroke="#8A99B8"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeDasharray="3 3"
        />
        {REGIONS.map((r, i) => {
          const on = i === active;
          return (
            <g key={r.key}>
              {on && !reduced ? (
                <circle
                  cx={r.cx}
                  cy={r.cy}
                  r="10"
                  fill="none"
                  stroke="#00D4FF"
                  strokeWidth="1.5"
                  className="animate-pulse-ring [transform-box:fill-box] [transform-origin:center]"
                />
              ) : null}
              <circle
                cx={r.cx}
                cy={r.cy}
                r={on ? 7 : 5}
                fill={on ? '#00D4FF' : '#1F2A40'}
                stroke={on ? '#00D4FF' : '#8A99B8'}
                strokeWidth="1.5"
                className="transition-all duration-300"
              />
            </g>
          );
        })}
      </svg>
      <div className="min-w-0 flex-1 space-y-2">
        {REGIONS.map((r, i) => (
          <div
            key={r.key}
            className={cn(
              'flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors duration-300',
              i === active
                ? 'border-primary/40 bg-primary/10 text-text'
                : 'bg-bg-elevated/60 border-line text-text-muted',
            )}
          >
            <span className="font-semibold">{t(`common.organ.${r.organ}`)}</span>
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                i === active ? 'bg-accent text-bg-base' : 'bg-secondary text-text-muted',
              )}
            >
              {t(`common.side.${r.side}`)}
            </span>
          </div>
        ))}
        <p className="truncate text-[10px] text-text-muted">
          {t('landing.features.anatomy.side')} · {t(`common.organ.${region.organ}`)}
        </p>
      </div>
    </div>
  );
}

/* ─────────────────────────── (e) Hisobotlar — oʻsuvchi ustunlar ─────────────────────────── */

const BARS = [45, 62, 38, 80, 70, 95, 84] as const;

export function ReportBarsAnimation() {
  const { t } = useLocale();
  const reduced = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' });
  const grow = reduced || inView;

  return (
    <div
      ref={ref}
      className="flex h-full flex-col"
      role="img"
      aria-label={t('landing.features.reports.label')}
    >
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold uppercase tracking-wider text-text-muted">
          {t('landing.features.reports.title')}
        </span>
        <span className="tabular font-semibold text-[#00FFB2]">
          +18% {t('landing.features.reports.growth')}
        </span>
      </div>
      <div className="mt-3 flex h-28 items-end gap-1.5">
        {BARS.map((h, i) => (
          <div key={i} className="bg-bg-elevated/60 relative h-full flex-1 overflow-hidden rounded-t-sm">
            <div
              className={cn(
                'absolute inset-x-0 bottom-0 origin-bottom rounded-t-sm bg-gradient-to-t from-[#7C5CFF] to-[#00D4FF] transition-transform duration-700 ease-out',
                i === BARS.length - 2 && 'shadow-glow',
              )}
              style={{
                height: `${h}%`,
                transform: grow ? 'scaleY(1)' : 'scaleY(0)',
                transitionDelay: reduced ? '0ms' : `${i * 80}ms`,
              }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────── (f) SMS / Telegram pufakchalari ─────────────────────────── */

export function SmsBubblesAnimation() {
  const { t, locale } = useLocale();
  const reduced = useReducedMotion();
  const [shown, setShown] = React.useState(reduced ? 3 : 0);

  React.useEffect(() => {
    if (reduced) {
      setShown(3);
      return;
    }
    let timer = 0;
    const next = () => {
      setShown((n) => {
        const v = n >= 3 ? 0 : n + 1;
        timer = window.setTimeout(next, v === 3 ? 3200 : v === 0 ? 500 : 1400);
        return v;
      });
    };
    timer = window.setTimeout(next, 500);
    return () => window.clearTimeout(timer);
  }, [reduced]);

  const tomorrow = React.useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return fmtDate(d, locale);
  }, [locale]);

  const bubbles = [
    {
      key: 'confirm',
      side: 'left' as const,
      channel: t('landing.features.sms.channel'),
      Icon: Smartphone,
      text: renderTemplate(t('landing.features.sms.confirm'), {
        clinic: 'Shifo LOR',
        name: 'Dilnoza',
        date: tomorrow,
        time: '10:30',
        doctor: 'Dr. Aliyev',
      }),
    },
    {
      key: 'reminder',
      side: 'left' as const,
      channel: t('landing.features.sms.telegram'),
      Icon: Send,
      text: renderTemplate(t('landing.features.sms.reminder'), { time: '10:30' }),
    },
    {
      key: 'reply',
      side: 'right' as const,
      channel: t('landing.features.sms.telegram'),
      Icon: Send,
      text: t('landing.features.sms.reply'),
    },
  ];

  return (
    <div
      className="flex h-full flex-col justify-end gap-2"
      role="img"
      aria-label={t('landing.features.sms.label')}
    >
      {bubbles.map((b, i) => {
        const visible = shown > i;
        return (
          <div
            key={b.key}
            aria-hidden={!visible}
            className={cn(
              'flex max-w-[88%] flex-col gap-1 transition-[opacity,transform] duration-300 ease-out',
              b.side === 'right' ? 'items-end self-end' : 'items-start self-start',
              visible ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
            )}
          >
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              <b.Icon className="size-3" aria-hidden="true" />
              {b.channel}
            </span>
            <p
              className={cn(
                'rounded-2xl px-3 py-2 text-xs leading-relaxed',
                b.side === 'right'
                  ? 'rounded-br-sm bg-gradient-accent text-bg-base'
                  : 'rounded-bl-sm border border-line bg-bg-elevated text-text',
              )}
            >
              {b.text}
            </p>
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────── (g) UZ/RU + rollar ─────────────────────────── */

const ROLE_ROWS: Role[] = ['ADMIN', 'DOCTOR', 'CASHIER'];
const PERM_COLS: Array<{ key: 'canPrice' | 'canPay' | 'canQueue'; perm: Permission }> = [
  { key: 'canPrice', perm: 'services.write' },
  { key: 'canPay', perm: 'payments.write' },
  { key: 'canQueue', perm: 'queue.manage' },
];
const LOCALES: Locale[] = ['uz', 'ru'];

export function RolesToggleAnimation() {
  const { t: tCurrent, locale: current } = useLocale();
  const reduced = useReducedMotion();
  const step = useCycle(2, 2600, !reduced);
  // Joriy tildan boshlab almashinadi: uz → ru → uz …
  const shownLocale: Locale = LOCALES[(LOCALES.indexOf(current) + step) % LOCALES.length] ?? current;
  const t = React.useMemo(() => makeT(getMessages(), shownLocale), [shownLocale]);

  return (
    <div
      className="flex h-full flex-col gap-3"
      role="img"
      aria-label={tCurrent('landing.features.roles.label')}
    >
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-muted">
          <Languages className="size-3.5" aria-hidden="true" />
          {tCurrent('landing.features.roles.lang')}
        </span>
        <span className="relative inline-flex h-7 items-center rounded-full border border-line bg-bg-elevated p-0.5 text-[11px] font-bold">
          <span
            aria-hidden="true"
            className="absolute left-0.5 top-0.5 h-6 w-9 rounded-full bg-gradient-accent transition-transform duration-300"
            style={{ transform: shownLocale === 'ru' ? 'translateX(100%)' : 'translateX(0)' }}
          />
          <span
            className={cn(
              'relative z-10 w-9 text-center transition-colors',
              shownLocale === 'uz' ? 'text-bg-base' : 'text-text-muted',
            )}
          >
            UZ
          </span>
          <span
            className={cn(
              'relative z-10 w-9 text-center transition-colors',
              shownLocale === 'ru' ? 'text-bg-base' : 'text-text-muted',
            )}
          >
            RU
          </span>
        </span>
      </div>
      <div
        key={shownLocale}
        className={cn(
          'overflow-hidden rounded-lg border border-line',
          !reduced && 'duration-300 animate-in fade-in',
        )}
      >
        <table className="w-full text-[11px]">
          <thead>
            <tr className="bg-bg-elevated/70 text-text-muted">
              <th scope="col" className="px-2 py-1.5 text-left font-semibold">
                <span className="inline-flex items-center gap-1">
                  <ShieldCheck className="size-3" aria-hidden="true" />
                  {t('landing.features.roles.roles')}
                </span>
              </th>
              {PERM_COLS.map((c) => (
                <th key={c.key} scope="col" className="px-1 py-1.5 text-center font-semibold">
                  {t(`landing.features.roles.${c.key}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROLE_ROWS.map((role) => (
              <tr key={role} className="border-t border-line">
                <th scope="row" className="px-2 py-1.5 text-left font-semibold text-text">
                  {t(`common.role.${role}`)}
                </th>
                {PERM_COLS.map((c) => {
                  const ok = can(role, c.perm);
                  return (
                    <td key={c.key} className="px-1 py-1.5 text-center">
                      <span
                        className={cn(
                          'inline-flex size-5 items-center justify-center rounded-full',
                          ok ? 'bg-[#00FFB2]/15 text-[#00FFB2]' : 'bg-destructive/10 text-danger',
                        )}
                        title={ok ? t('landing.features.roles.allowed') : t('landing.features.roles.denied')}
                      >
                        {ok ? (
                          <Check className="size-3" aria-hidden="true" />
                        ) : (
                          <X className="size-3" aria-hidden="true" />
                        )}
                        <span className="sr-only">
                          {ok ? t('landing.features.roles.allowed') : t('landing.features.roles.denied')}
                        </span>
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
