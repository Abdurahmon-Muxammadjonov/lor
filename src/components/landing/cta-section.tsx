import { CheckCircle2, Mail, Phone, Send } from 'lucide-react';
import { getT } from '@/i18n/server';
import { formatPhone } from '@/lib/utils';
import { Reveal } from './reveal';
import { SITE } from '@/data/landing-content';
import { LeadForm } from './lead-form';
import { Section } from './section';

const BENEFIT_KEYS = ['b1', 'b2', 'b3'] as const;

/** Yakuniy CTA — gradient lenta + soʻrov formasi (#contact). Server komponent. */
export function CtaSection() {
  const t = getT();
  return (
    <Section id="contact" className="pb-24">
      <Reveal>
        <div className="relative isolate overflow-hidden rounded-3xl border border-line">
          {/* Gradient fon */}
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-accent opacity-[0.16]" />
          <div
            aria-hidden="true"
            className="absolute -left-24 -top-24 -z-10 size-72 rounded-full bg-[#00D4FF]/25 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-24 -right-24 -z-10 size-72 rounded-full bg-[#7C5CFF]/30 blur-3xl"
          />
          <div aria-hidden="true" className="bg-grid bg-grid-fade absolute inset-0 -z-10 opacity-40" />

          <div className="grid gap-10 p-6 sm:p-10 lg:grid-cols-[1fr_1fr] lg:gap-14 lg:p-14">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                <span aria-hidden="true" className="h-px w-6 bg-gradient-accent" />
                {t('landing.cta.eyebrow')}
              </div>
              <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight text-text sm:text-4xl md:text-5xl">
                {t('landing.cta.title')}
              </h2>
              <p className="mt-4 max-w-lg text-base leading-relaxed text-text-muted sm:text-lg">
                {t('landing.cta.description')}
              </p>
              <ul className="mt-6 space-y-3">
                {BENEFIT_KEYS.map((k) => (
                  <li key={k} className="flex items-start gap-3 text-sm text-text sm:text-base">
                    <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#00FFB2]" aria-hidden="true" />
                    {t(`landing.cta.benefits.${k}`)}
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex flex-wrap gap-3 text-sm">
                <a
                  href={`tel:${SITE.phone}`}
                  className="bg-bg-base/60 inline-flex items-center gap-2 rounded-full border border-line px-3.5 py-2 text-text transition-colors hover:border-[#2B3A57] hover:text-accent"
                >
                  <Phone className="size-4 text-accent" aria-hidden="true" />
                  <span className="tabular">{formatPhone(SITE.phone) || SITE.phoneDisplay}</span>
                </a>
                <a
                  href={SITE.telegramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-bg-base/60 inline-flex items-center gap-2 rounded-full border border-line px-3.5 py-2 text-text transition-colors hover:border-[#2B3A57] hover:text-accent"
                >
                  <Send className="size-4 text-accent" aria-hidden="true" />
                  {SITE.telegram}
                </a>
                <a
                  href={`mailto:${SITE.email}`}
                  className="bg-bg-base/60 inline-flex items-center gap-2 rounded-full border border-line px-3.5 py-2 text-text transition-colors hover:border-[#2B3A57] hover:text-accent"
                >
                  <Mail className="size-4 text-accent" aria-hidden="true" />
                  {SITE.email}
                </a>
              </div>
            </div>

            <div className="glass-strong relative rounded-2xl p-5 sm:p-7">
              <LeadForm />
            </div>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}
