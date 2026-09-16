import { Building2, Clock3, IdCard, Ticket, type LucideIcon } from 'lucide-react';
import { getT } from '@/i18n/server';
import { Counter } from '@/components/effects/counter';
import { RevealGroup, RevealItem } from './reveal';
import { SectionTitle } from '@/components/shared/section-title';
import { STATS, type StatItem } from '@/data/landing-content';
import { Section } from './section';

const ICONS: Record<StatItem['key'], LucideIcon> = {
  clinics: Building2,
  patients: IdCard,
  tickets: Ticket,
  hours: Clock3,
};

/** Statistika — shisha lentada 4 ta animatsiyali hisoblagich. Server komponent. */
export function StatsBand() {
  const t = getT();
  return (
    <Section id="stats" className="py-16 md:py-20">
      <SectionTitle
        eyebrow={t('landing.stats.eyebrow')}
        title={t('landing.stats.title')}
        align="center"
        size="md"
        className="mx-auto"
      />
      <RevealGroup
        as="ul"
        className="glass-strong bg-line/40 mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl lg:grid-cols-4"
        stagger={0.08}
      >
        {STATS.map((s) => {
          const Icon = ICONS[s.key];
          return (
            <RevealItem
              key={s.key}
              as="li"
              className="bg-bg-elevated/80 flex flex-col items-center gap-2 px-4 py-8 text-center sm:py-10"
            >
              <span
                aria-hidden="true"
                className="inline-flex size-10 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-accent"
              >
                <Icon className="size-5" />
              </span>
              <Counter
                to={s.value}
                suffix={s.suffix}
                duration={2}
                className="text-gradient font-heading text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl"
              />
              <span className="text-sm text-text-muted">{t(`landing.stats.${s.key}`)}</span>
            </RevealItem>
          );
        })}
      </RevealGroup>
    </Section>
  );
}
