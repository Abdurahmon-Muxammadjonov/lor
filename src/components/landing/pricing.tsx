'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, Check, MessageSquareMore, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale } from '@/i18n/client';
import { formatMoney } from '@/lib/money';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { Counter } from '@/components/effects/counter';
import { GlowCard } from '@/components/effects/glow-card';
import { RevealGroup, RevealItem } from './reveal';
import { Tilt } from '@/components/effects/tilt';
import { SectionTitle } from '@/components/shared/section-title';
import { lc, PRICING_TIERS, yearlyPerMonth, yearlyPrice } from '@/data/landing-content';
import { Section } from './section';

type Billing = 'monthly' | 'yearly';

const GLOW = { start: 'cyan', pro: 'violet', clinic: 'mint' } as const;

/** Narxlar — 3 tarif, oylik/yillik almashtirgich (yillik −20%, animatsiyali narx), Tilt kartalar */
export function Pricing() {
  const { t, locale } = useLocale();
  const [billing, setBilling] = React.useState<Billing>('monthly');
  const currency = t('common.currency');

  return (
    <Section id="pricing">
      <SectionTitle
        eyebrow={t('landing.pricing.eyebrow')}
        title={t('landing.pricing.title')}
        description={t('landing.pricing.description')}
        align="center"
        size="lg"
        className="mx-auto"
      />

      <div className="mt-8 flex justify-center">
        <Segmented<Billing>
          value={billing}
          onChange={setBilling}
          size="lg"
          variant="accent"
          ariaLabel={t('landing.pricing.billingLabel')}
          options={[
            { value: 'monthly', label: t('landing.pricing.monthly') },
            {
              value: 'yearly',
              label: (
                <span className="inline-flex items-center gap-2">
                  {t('landing.pricing.yearly')}
                  <span className="rounded-full bg-[#00FFB2]/15 px-1.5 py-0.5 text-[10px] font-bold text-[#00FFB2]">
                    {t('landing.pricing.save')}
                  </span>
                </span>
              ),
            },
          ]}
        />
      </div>

      <RevealGroup className="mt-12 grid items-stretch gap-5 md:grid-cols-3" stagger={0.1} as="ul">
        {PRICING_TIERS.map((tier) => {
          const popular = Boolean(tier.popular);
          const perMonth = billing === 'yearly' ? yearlyPerMonth(tier.monthly) : tier.monthly;
          return (
            <RevealItem key={tier.key} as="li" className="flex">
              <Tilt
                max={7}
                scale={1.015}
                className={cn('w-full rounded-2xl', popular && 'md:-translate-y-2')}
                innerClassName="rounded-2xl"
              >
                {popular ? (
                  <Badge className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 bg-gradient-accent px-3 shadow-glow">
                    <Star className="fill-current" aria-hidden="true" />
                    {t('landing.pricing.popular')}
                  </Badge>
                ) : null}
                <GlowCard
                  glow={GLOW[tier.key]}
                  strong={popular}
                  className={cn('flex h-full w-full rounded-2xl', popular && 'shadow-glow-violet')}
                  contentClassName="flex h-full w-full flex-col p-6 sm:p-7"
                >
                  <h3 className="font-heading text-2xl font-bold text-text">{lc(tier.name, locale)}</h3>
                  <p className="mt-1 text-sm text-text-muted">{lc(tier.tagline, locale)}</p>

                  <div className="mt-6" aria-live="polite">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <Counter
                        to={perMonth}
                        immediate
                        duration={0.8}
                        className="font-heading text-3xl font-extrabold tracking-tight text-text sm:text-4xl"
                      />
                      <span className="text-sm text-text-muted">
                        {currency} {t('landing.pricing.perMonth')}
                      </span>
                    </div>
                    <p className="mt-1.5 min-h-[1.25rem] text-xs text-text-muted">
                      {billing === 'yearly'
                        ? `${formatMoney(yearlyPrice(tier.monthly), { suffix: currency })} ${t('landing.pricing.perYear')}`
                        : t('landing.pricing.monthlyHint')}
                    </p>
                  </div>

                  <div className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
                    {t('landing.pricing.includes')}
                  </div>
                  <ul className="mt-3 flex-1 space-y-2.5">
                    {tier.features.map((f) => (
                      <li key={f.uz} className="flex items-start gap-2.5 text-sm text-text">
                        <Check
                          className={cn(
                            'mt-0.5 size-4 shrink-0',
                            popular ? 'text-accent-2' : 'text-[#00FFB2]',
                          )}
                          aria-hidden="true"
                        />
                        <span>{lc(f, locale)}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-7">
                    {tier.cta === 'trial' ? (
                      <Button asChild variant={popular ? 'gradient' : 'outline'} size="lg" className="w-full">
                        <Link href="/login">
                          {t('landing.pricing.cta')}
                          <ArrowRight aria-hidden="true" />
                        </Link>
                      </Button>
                    ) : (
                      <Button asChild variant="outline" size="lg" className="w-full">
                        <a href="#contact">
                          <MessageSquareMore aria-hidden="true" />
                          {t('landing.pricing.ctaContact')}
                        </a>
                      </Button>
                    )}
                    {tier.cta === 'trial' ? (
                      <p className="mt-2 text-center text-xs text-text-muted">{t('landing.pricing.trial')}</p>
                    ) : null}
                  </div>
                </GlowCard>
              </Tilt>
            </RevealItem>
          );
        })}
      </RevealGroup>

      <p className="mt-8 text-center text-xs text-text-muted">{t('landing.pricing.vat')}</p>
    </Section>
  );
}
