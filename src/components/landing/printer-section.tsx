import { Globe, MonitorPlay, Network, Printer, TabletSmartphone, Usb, type LucideIcon } from 'lucide-react';
import { getT } from '@/i18n/server';
import { cn } from '@/lib/utils';
import { Reveal, RevealGroup, RevealItem } from './reveal';
import { TicketAnimation } from '@/components/effects/ticket-animation';
import { SectionTitle } from '@/components/shared/section-title';
import { Section } from './section';

const STEPS: Array<{ key: 'kiosk' | 'printer' | 'display'; Icon: LucideIcon; tint: string; image: string }> =
  [
    {
      key: 'kiosk',
      Icon: TabletSmartphone,
      tint: 'border-primary/25 bg-primary/10 text-accent',
      image: '/images/kiosk.svg',
    },
    {
      key: 'printer',
      Icon: Printer,
      tint: 'border-[#7C5CFF]/30 bg-[#7C5CFF]/15 text-accent-2',
      image: '/images/printer.svg',
    },
    {
      key: 'display',
      Icon: MonitorPlay,
      tint: 'border-[#00FFB2]/25 bg-[#00FFB2]/10 text-[#00FFB2]',
      image: '/images/tv-display.svg',
    },
  ];

const TRANSPORTS: Array<{ key: 'webusb' | 'qz' | 'network' | 'browser'; Icon: LucideIcon }> = [
  { key: 'webusb', Icon: Usb },
  { key: 'qz', Icon: Printer },
  { key: 'network', Icon: Network },
  { key: 'browser', Icon: Globe },
];

/** Navbat printeri boʻlimi: katta talon animatsiyasi + 3 qadam + ulanish turlari. Server komponent. */
export function PrinterSection() {
  const t = getT();
  return (
    <Section id="printer" className="overflow-x-clip">
      <div className="grid items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
        <Reveal className="order-2 lg:order-1">
          <div className="relative mx-auto max-w-md">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-8 -z-10 rounded-full bg-[#7C5CFF]/20 blur-3xl"
            />
            <div className="glass rounded-3xl p-6 sm:p-10">
              <TicketAnimation
                number="A-014"
                ahead={3}
                avgMinutes={5}
                interval={6500}
                className="scale-100 sm:my-6 sm:scale-110"
              />
            </div>
            <span className="sr-only">{t('landing.printer.ticketLabel')}</span>
          </div>
        </Reveal>

        <div className="order-1 lg:order-2">
          <SectionTitle
            eyebrow={t('landing.printer.eyebrow')}
            title={t('landing.printer.title')}
            description={t('landing.printer.description')}
            size="lg"
          />

          <RevealGroup as="ol" className="mt-10 space-y-4" stagger={0.1}>
            {STEPS.map((s, i) => (
              <RevealItem key={s.key} as="li" className="relative flex gap-4">
                {i < STEPS.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className="absolute left-6 top-14 h-[calc(100%-1.5rem)] w-px bg-gradient-to-b from-line to-transparent"
                  />
                ) : null}
                <span
                  aria-hidden="true"
                  className={cn(
                    'relative inline-flex size-12 shrink-0 items-center justify-center rounded-xl border',
                    s.tint,
                  )}
                >
                  <s.Icon className="size-6" />
                  <span className="absolute -right-1.5 -top-1.5 inline-flex size-5 items-center justify-center rounded-full bg-bg-elevated text-[10px] font-bold text-text ring-1 ring-line">
                    {i + 1}
                  </span>
                </span>
                <div className="min-w-0 flex-1 pt-1">
                  <h3 className="font-heading text-lg font-bold text-text">
                    <span className="sr-only">
                      {i + 1}-{t('landing.printer.step')}:{' '}
                    </span>
                    {t(`landing.printer.steps.${s.key}.title`)}
                  </h3>
                  <p className="mt-1 text-sm leading-relaxed text-text-muted">
                    {t(`landing.printer.steps.${s.key}.desc`)}
                  </p>
                </div>
                {/* Qoʻlda chizilgan illyustratsiya (dekorativ) */}
                <img
                  src={s.image}
                  alt=""
                  width={72}
                  height={72}
                  loading="lazy"
                  decoding="async"
                  className="bg-bg-elevated/60 hidden size-[72px] shrink-0 self-center rounded-xl border border-line p-1.5 sm:block"
                />
              </RevealItem>
            ))}
          </RevealGroup>

          <Reveal delay={0.2} className="mt-10">
            <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
              {t('landing.printer.transportsTitle')}
            </h3>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {TRANSPORTS.map((tr) => (
                <li
                  key={tr.key}
                  className="bg-bg-elevated/60 flex items-center gap-2.5 rounded-lg border border-line px-3 py-2.5 text-sm text-text"
                >
                  <tr.Icon className="size-4 shrink-0 text-accent" aria-hidden="true" />
                  {t(`landing.printer.transports.${tr.key}`)}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </Section>
  );
}
