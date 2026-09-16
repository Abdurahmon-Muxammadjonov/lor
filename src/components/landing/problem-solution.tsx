'use client';

import * as React from 'react';
import { useInView } from 'framer-motion';
import { CheckCircle2, MoveHorizontal, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale } from '@/i18n/client';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { SectionTitle } from '@/components/shared/section-title';
import { AFTER_ITEMS, BEFORE_ITEMS, lc } from '@/data/landing-content';
import { Section } from './section';

const AUTO_MS = 1800;

/**
 * "Oldin / Keyin" — ikki panel va ularni bir-biriga oʻtkazadigan slayder (range input, klaviatura bilan ham).
 * Koʻrinish maydoniga kirganda slayder oʻzi 0 → 100 ga suriladi (reduced-motion da darhol 100).
 */
export function ProblemSolution() {
  const { t, locale } = useLocale();
  const reduced = useReducedMotion();
  const ref = React.useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -20% 0px' });
  const [value, setValue] = React.useState(0);
  const touched = React.useRef(false);

  React.useEffect(() => {
    if (!inView || touched.current) return;
    if (reduced) {
      setValue(100);
      return;
    }
    let raf = 0;
    let start: number | null = null;
    const step = (now: number) => {
      if (touched.current) return;
      if (start === null) start = now;
      const p = Math.min(1, (now - start) / AUTO_MS);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(eased * 100));
      if (p < 1) raf = window.requestAnimationFrame(step);
    };
    raf = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(raf);
  }, [inView, reduced]);

  const mix = value / 100;
  // Kontrast (WCAG AA) saqlanishi uchun opacity 0.55 dan pastga tushmaydi
  const beforeStyle: React.CSSProperties = { opacity: 1 - mix * 0.45, filter: `grayscale(${mix})` };
  const afterStyle: React.CSSProperties = {
    opacity: 0.35 + mix * 0.65,
    boxShadow: `0 0 0 1px rgba(0,212,255,${0.08 + mix * 0.25}), 0 0 ${Math.round(mix * 48)}px rgba(0,212,255,${mix * 0.25})`,
  };

  return (
    <Section id="problem" className="py-16 md:py-24">
      <SectionTitle
        eyebrow={t('landing.problem.eyebrow')}
        title={t('landing.problem.title')}
        description={t('landing.problem.description')}
        align="center"
        size="lg"
        className="mx-auto"
      />

      <div ref={ref} className="mt-12">
        <div className="grid gap-5 md:grid-cols-2 md:gap-6">
          {/* Oldin */}
          <div
            className="bg-bg-elevated/70 rounded-2xl border border-line p-6 transition-[opacity,filter] duration-150 sm:p-8"
            style={beforeStyle}
            aria-label={t('landing.problem.before')}
            role="group"
          >
            <div className="mb-5 flex items-center gap-3">
              <span className="inline-flex size-9 items-center justify-center rounded-full border border-destructive/25 bg-destructive/10 text-danger">
                <XCircle className="size-5" aria-hidden="true" />
              </span>
              <h3 className="font-heading text-xl font-bold text-text">{t('landing.problem.before')}</h3>
            </div>
            <ul className="space-y-3">
              {BEFORE_ITEMS.map((item) => (
                <li key={item.uz} className="flex items-start gap-3 text-sm text-text sm:text-base">
                  <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-text-muted" />
                  <span className="decoration-danger/60 line-through decoration-1">{lc(item, locale)}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Keyin */}
          <div
            className="glass relative overflow-hidden rounded-2xl p-6 transition-opacity duration-150 sm:p-8"
            style={afterStyle}
            aria-label={t('landing.problem.after')}
            role="group"
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -right-20 -top-20 size-56 rounded-full bg-[#00D4FF]/20 blur-3xl transition-opacity"
              style={{ opacity: mix }}
            />
            <div className="relative mb-5 flex items-center gap-3">
              <span className="inline-flex size-9 items-center justify-center rounded-full border border-[#00FFB2]/25 bg-[#00FFB2]/10 text-[#00FFB2]">
                <CheckCircle2 className="size-5" aria-hidden="true" />
              </span>
              <h3 className="font-heading text-xl font-bold text-text">{t('landing.problem.after')}</h3>
            </div>
            <ul className="relative space-y-3">
              {AFTER_ITEMS.map((item, i) => (
                <li key={item.uz} className="flex items-start gap-3 text-sm text-text sm:text-base">
                  <CheckCircle2
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-[#00FFB2] transition-transform duration-300"
                    style={{ transform: `scale(${0.6 + Math.min(1, Math.max(0, mix * 6 - i)) * 0.4})` }}
                  />
                  <span>{lc(item, locale)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Slayder */}
        <div className="mx-auto mt-8 max-w-xl">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-text-muted">
            <span>{t('landing.problem.before')}</span>
            <span className="inline-flex items-center gap-1 normal-case tracking-normal">
              <MoveHorizontal className="size-3.5" aria-hidden="true" />
              {t('landing.problem.hint')}
            </span>
            <span>{t('landing.problem.after')}</span>
          </div>
          <div className="relative mt-3 h-10">
            <div
              aria-hidden="true"
              className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-bg-elevated ring-1 ring-line"
            />
            <div
              aria-hidden="true"
              className="absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-gradient-accent"
              style={{ width: `${value}%` }}
            />
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={value}
              onChange={(e) => {
                touched.current = true;
                setValue(Number(e.target.value));
              }}
              onPointerDown={() => {
                touched.current = true;
              }}
              aria-label={t('landing.problem.sliderLabel')}
              aria-valuetext={`${t('landing.problem.after')} ${value}%`}
              data-cursor="hover"
              className={cn(
                'absolute inset-0 h-10 w-full cursor-ew-resize appearance-none bg-transparent focus-visible:outline-none',
                '[&::-webkit-slider-runnable-track]:h-10 [&::-webkit-slider-runnable-track]:bg-transparent',
                '[&::-webkit-slider-thumb]:size-7 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-bg-base [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:shadow-glow [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110',
                '[&::-moz-range-thumb]:size-7 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-bg-base [&::-moz-range-thumb]:bg-accent [&::-moz-range-track]:bg-transparent',
                'focus-visible:[&::-webkit-slider-thumb]:ring-4 focus-visible:[&::-webkit-slider-thumb]:ring-ring/40',
              )}
            />
          </div>
        </div>
      </div>
    </Section>
  );
}
