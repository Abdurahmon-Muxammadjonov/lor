import { getLocale, getT } from '@/i18n/server';
import { cn } from '@/lib/utils';
import { Marquee } from '@/components/effects/marquee';
import { CLINIC_WORDMARKS, lc, type ClinicWordmark } from '@/data/landing-content';

const STYLE: Record<ClinicWordmark['style'], string> = {
  serif: 'font-serif italic tracking-tight',
  wide: 'font-heading uppercase tracking-[0.28em] text-sm',
  mono: 'font-mono tracking-tight',
  bold: 'font-heading font-extrabold tracking-tight',
  light: 'font-light tracking-[0.12em]',
};

function Wordmark({ item, locale }: { item: ClinicWordmark; locale: 'uz' | 'ru' }) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-0.5 px-2 text-text-muted transition-colors hover:text-text">
      <span className={cn('whitespace-nowrap text-lg leading-none sm:text-xl', STYLE[item.style])}>
        {item.name}
      </span>
      <span className="text-[10px] uppercase tracking-[0.2em] text-text-muted">{lc(item.city, locale)}</span>
    </div>
  );
}

/** Ishonch lentasi — 10 ta uslublangan klinika soʻz belgisi, ikki yoʻnalishda */
export function TrustMarquee() {
  const t = getT();
  const locale = getLocale();
  const first = CLINIC_WORDMARKS.slice(0, 5);
  const second = CLINIC_WORDMARKS.slice(5);

  return (
    <section
      aria-label={t('landing.trust.sr')}
      className="border-line/60 bg-bg-elevated/40 relative border-y py-10"
    >
      <div className="container">
        <p className="mb-6 text-center text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
          {t('landing.trust.title')}
        </p>
      </div>
      <div className="flex flex-col gap-5">
        <Marquee speed={36} gap={64}>
          {first.map((c) => (
            <Wordmark key={c.name} item={c} locale={locale} />
          ))}
        </Marquee>
        <Marquee speed={30} gap={64} reverse>
          {second.map((c) => (
            <Wordmark key={c.name} item={c} locale={locale} />
          ))}
        </Marquee>
      </div>
    </section>
  );
}
