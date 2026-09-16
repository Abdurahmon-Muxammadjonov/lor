import { Info } from 'lucide-react';
import { getT } from '@/i18n/server';
import { SectionTitle } from '@/components/shared/section-title';
import { Reveal } from './reveal';
import { Section } from './section';
import { DemoCalculatorLoader } from './demo-calculator-loader';

/** Interaktiv demo boʻlimi (#demo) — sarlavha server tomonda, kalkulyator brauzerda yuklanadi */
export function DemoSection() {
  const t = getT();
  return (
    <Section id="demo" className="bg-bg-elevated/30">
      <SectionTitle
        eyebrow={t('landing.demo.eyebrow')}
        title={t('landing.demo.title')}
        description={t('landing.demo.description')}
        align="center"
        size="lg"
        className="mx-auto"
      />
      <Reveal className="mt-12">
        <DemoCalculatorLoader />
      </Reveal>
      <p className="mx-auto mt-6 flex max-w-3xl items-start gap-2 rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-text">
        <Info className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
        <span>{t('landing.demo.note')}</span>
      </p>
    </Section>
  );
}
