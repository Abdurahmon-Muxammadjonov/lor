import { getLocale, getT } from '@/i18n/server';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Reveal } from './reveal';
import { SectionTitle } from '@/components/shared/section-title';
import { FAQ, lc } from '@/data/landing-content';
import { JsonLd } from './json-ld';
import { Section } from './section';

/** FAQ — 8 ta savol, Accordion + schema.org FAQPage. Server komponent. */
export function Faq() {
  const t = getT();
  const locale = getLocale();
  const first = FAQ[0];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map((f) => ({
      '@type': 'Question',
      name: lc(f.q, locale),
      acceptedAnswer: { '@type': 'Answer', text: lc(f.a, locale) },
    })),
  };

  return (
    <Section id="faq" className="bg-bg-elevated/30">
      <JsonLd data={jsonLd} />
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionTitle
          eyebrow={t('landing.faq.eyebrow')}
          title={t('landing.faq.title')}
          description={t('landing.faq.description')}
          size="lg"
        />
        <Reveal>
          <Accordion
            type="single"
            collapsible
            defaultValue={first?.id}
            className="glass divide-y divide-line px-5 sm:px-7"
          >
            {FAQ.map((f) => (
              <AccordionItem key={f.id} value={f.id} className="border-b-0">
                <AccordionTrigger className="py-5 text-base font-semibold sm:text-lg">
                  {lc(f.q, locale)}
                </AccordionTrigger>
                <AccordionContent className="pb-5 text-sm leading-relaxed text-text-muted sm:text-base">
                  {lc(f.a, locale)}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </Section>
  );
}
