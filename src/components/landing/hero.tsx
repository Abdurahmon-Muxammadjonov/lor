import Link from 'next/link';
import {
  ArrowRight,
  Calculator,
  MessageSquareText,
  PlayCircle,
  Printer,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { getT } from '@/i18n/server';
import { formatMoney } from '@/lib/money';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { AuroraBackground } from '@/components/effects/aurora-background';
import { Magnetic } from '@/components/effects/magnetic';
import { Tilt } from '@/components/effects/tilt';
import { RotatingWords } from './rotating-words';
import { DashboardPreviewLoader } from './dashboard-preview-loader';

const WORD_KEYS = ['w1', 'w2', 'w3', 'w4', 'w5'] as const;

/** Kirish animatsiyasi (CSS, faqat opacity/transform; reduced-motion da oʻchadi) */
const ENTER =
  'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:fill-mode-both';

/**
 * Hero — server komponent. Sarlavha statik (LCP), qolganlari CSS bilan kiradi;
 * oʻngda dynamic yuklanadigan mini dashboard (Tilt + nur) va suzuvchi chiplar.
 */
export function Hero() {
  const t = getT();
  const words = WORD_KEYS.map((k) => t(`landing.hero.words.${k}`));
  const revenue = formatMoney(8_450_000, { suffix: t('common.currency') });

  const chips = [
    {
      key: 'ticket',
      Icon: Printer,
      text: `${t('landing.hero.chips.ticket')} · A-014`,
      className: '-top-3 left-3 sm:-left-6 sm:top-[42%]',
      delay: '0s',
      color: 'text-accent',
    },
    {
      key: 'revenue',
      Icon: Wallet,
      text: `${t('landing.hero.chips.revenue')} · ${revenue}`,
      className: '-bottom-3 right-3 sm:-bottom-4 sm:right-6',
      delay: '-2s',
      color: 'text-[#00FFB2]',
    },
    {
      key: 'sms',
      Icon: MessageSquareText,
      text: t('landing.hero.chips.sms'),
      className: '-right-6 top-[30%] hidden sm:flex',
      delay: '-4s',
      color: 'text-accent-2',
    },
    {
      key: 'calc',
      Icon: Calculator,
      text: t('landing.hero.chips.calc'),
      className: '-bottom-4 left-6 hidden sm:flex',
      delay: '-1s',
      color: 'text-accent',
    },
  ] as const;

  return (
    <section className="relative isolate overflow-hidden pb-16 pt-10 md:pb-24 md:pt-16 lg:pt-20">
      <AuroraBackground intensity="high" />
      <div className="container grid items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
        {/* Matn */}
        <div className="max-w-2xl">
          <span
            className={cn(
              'inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-semibold text-accent',
              ENTER,
              'motion-safe:duration-500',
            )}
          >
            <Sparkles className="size-3.5" aria-hidden="true" />
            {t('landing.hero.eyebrow')}
          </span>

          <h1 className="mt-5 font-heading text-4xl font-extrabold leading-[1.05] tracking-tight text-text sm:text-5xl lg:text-6xl">
            {t('landing.hero.title1')}{' '}
            <span className="text-gradient">{t('landing.hero.titleGradient')}</span>{' '}
            {t('landing.hero.title2')}
          </h1>

          <p
            className={cn(
              'mt-5 text-lg text-text-muted sm:text-xl',
              ENTER,
              'motion-safe:delay-100 motion-safe:duration-700',
            )}
          >
            {t('landing.hero.rotatingPrefix')} <RotatingWords words={words} className="text-text" />
          </p>

          <p
            className={cn(
              'mt-4 max-w-xl text-pretty text-base leading-relaxed text-text-muted sm:text-lg',
              ENTER,
              'motion-safe:delay-150 motion-safe:duration-700',
            )}
          >
            {t('landing.hero.description')}
          </p>

          <div
            className={cn(
              'mt-8 flex flex-col gap-3 sm:flex-row sm:items-center',
              ENTER,
              'motion-safe:delay-200 motion-safe:duration-700',
            )}
          >
            <Magnetic className="w-full sm:w-auto">
              <Button asChild variant="gradient" size="xl" className="w-full shadow-glow sm:w-auto">
                <Link href="/login">
                  {t('landing.hero.ctaPrimary')}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Button>
            </Magnetic>
            <Magnetic className="w-full sm:w-auto">
              <Button
                asChild
                variant="outline"
                size="xl"
                className="bg-bg-base/40 w-full backdrop-blur sm:w-auto"
              >
                <a href="#demo">
                  <PlayCircle aria-hidden="true" />
                  {t('landing.hero.ctaSecondary')}
                </a>
              </Button>
            </Magnetic>
          </div>

          <p
            className={cn(
              'mt-5 text-sm text-text-muted',
              ENTER,
              'motion-safe:delay-300 motion-safe:duration-700',
            )}
          >
            {t('landing.hero.trust')}
          </p>
        </div>

        {/* Dashboard namunasi */}
        <div
          className={cn(
            'relative mx-auto w-full max-w-[560px] lg:max-w-none',
            ENTER,
            'motion-safe:delay-200 motion-safe:duration-1000',
          )}
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-6 -z-10 rounded-[32px] bg-gradient-accent-soft opacity-70 blur-2xl"
          />
          <Tilt max={6} scale={1.01} className="rounded-2xl" innerClassName="rounded-2xl">
            <DashboardPreviewLoader />
          </Tilt>

          {chips.map((c) => (
            <div
              key={c.key}
              aria-hidden="true"
              style={{ animationDelay: c.delay }}
              className={cn(
                'glass pointer-events-none absolute z-20 flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium text-text shadow-card motion-safe:animate-float',
                c.className,
              )}
            >
              <c.Icon className={cn('size-3.5', c.color)} aria-hidden="true" />
              <span className="tabular">{c.text}</span>
            </div>
          ))}
          <span className="sr-only">{t('landing.hero.previewLabel')}</span>
        </div>
      </div>
    </section>
  );
}
