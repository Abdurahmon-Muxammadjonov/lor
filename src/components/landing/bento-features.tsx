import type { ComponentType } from 'react';
import {
  BarChart3,
  Calculator,
  Ear,
  Languages,
  type LucideIcon,
  MessageCircle,
  Receipt,
  Ticket,
} from 'lucide-react';
import { getLocale, getT } from '@/i18n/server';
import { cn } from '@/lib/utils';
import { GlowCard } from '@/components/effects/glow-card';
import { RevealGroup, RevealItem } from './reveal';
import { SectionTitle } from '@/components/shared/section-title';
import { FEATURES, lc, type FeatureKey } from '@/data/landing-content';
import { Section } from './section';
import {
  AnatomyAnimation,
  CalcTilesAnimation,
  ReceiptTypingAnimation,
  ReportBarsAnimation,
  RolesToggleAnimation,
  SmsBubblesAnimation,
  TicketMiniAnimation,
} from './feature-animations';

interface BentoConfig {
  className: string;
  Icon: LucideIcon;
  Animation: ComponentType;
}

const BENTO: Record<FeatureKey, BentoConfig> = {
  calc: {
    className: 'md:col-span-2 lg:col-span-4 lg:row-span-2',
    Icon: Calculator,
    Animation: CalcTilesAnimation,
  },
  queue: { className: 'lg:col-span-2 lg:row-span-2', Icon: Ticket, Animation: TicketMiniAnimation },
  cashier: { className: 'lg:col-span-2', Icon: Receipt, Animation: ReceiptTypingAnimation },
  anatomy: { className: 'lg:col-span-2', Icon: Ear, Animation: AnatomyAnimation },
  reports: { className: 'lg:col-span-2', Icon: BarChart3, Animation: ReportBarsAnimation },
  sms: { className: 'lg:col-span-3', Icon: MessageCircle, Animation: SmsBubblesAnimation },
  roles: { className: 'md:col-span-2 lg:col-span-3', Icon: Languages, Animation: RolesToggleAnimation },
};

const ICON_TINT = {
  cyan: 'border-primary/25 bg-primary/10 text-accent',
  violet: 'border-[#7C5CFF]/30 bg-[#7C5CFF]/15 text-accent-2',
  mint: 'border-[#00FFB2]/25 bg-[#00FFB2]/10 text-[#00FFB2]',
} as const;

/** Bento imkoniyatlar — 7 ta assimetrik GlowCard, har birida mikro-animatsiya. Server komponent. */
export function BentoFeatures() {
  const t = getT();
  const locale = getLocale();

  return (
    <Section id="features">
      <SectionTitle
        eyebrow={t('landing.features.eyebrow')}
        title={t('landing.features.title')}
        description={t('landing.features.description')}
        align="center"
        size="lg"
        className="mx-auto"
      />
      <RevealGroup stagger={0.08} className="mt-14 grid gap-4 md:grid-cols-2 lg:grid-cols-6" as="ul">
        {FEATURES.map((f) => {
          const cfg = BENTO[f.key];
          const { Icon, Animation } = cfg;
          return (
            <RevealItem key={f.key} as="li" className={cn('flex min-w-0', cfg.className)}>
              <GlowCard
                glow={f.glow}
                className="flex h-full w-full rounded-2xl"
                contentClassName="flex h-full w-full flex-col p-5 sm:p-6"
              >
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'inline-flex size-10 shrink-0 items-center justify-center rounded-lg border',
                      ICON_TINT[f.glow],
                    )}
                  >
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-heading text-lg font-bold leading-tight text-text">
                      {lc(f.title, locale)}
                    </h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-text-muted">
                      {lc(f.description, locale)}
                    </p>
                  </div>
                </div>
                <div className="mt-5 flex-1">
                  <Animation />
                </div>
              </GlowCard>
            </RevealItem>
          );
        })}
      </RevealGroup>
    </Section>
  );
}
