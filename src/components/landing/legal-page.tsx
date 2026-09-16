import Link from 'next/link';
import { ArrowLeft, Mail, MapPin, Phone } from 'lucide-react';
import { getLocale, getT } from '@/i18n/server';
import { fmtDateLong } from '@/lib/date';
import { formatPhone } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { lc, SITE, type LegalDocument } from '@/data/landing-content';

export interface LegalPageProps {
  doc: LegalDocument;
  /** "Shuningdek" havolasi */
  related: { href: string; label: string };
}

/** Huquqiy hujjat sahifasi (maxfiylik / shartlar): mundarija + boʻlimlar. Server komponent. */
export function LegalPage({ doc, related }: LegalPageProps) {
  const t = getT();
  const locale = getLocale();
  const updated = fmtDateLong(SITE.legalUpdated, locale);

  return (
    <article className="container py-12 md:py-16">
      <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[260px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Button asChild variant="ghost" size="sm" className="-ml-2 mb-4 text-text-muted">
            <Link href="/">
              <ArrowLeft aria-hidden="true" />
              {t('landing.legal.back')}
            </Link>
          </Button>
          <nav aria-label={t('landing.legal.toc')} className="glass p-4">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
              {t('landing.legal.toc')}
            </h2>
            <ol className="mt-3 space-y-1.5 text-sm">
              {doc.sections.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="block rounded-sm py-0.5 text-text-muted transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {lc(s.heading, locale)}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
          <div className="bg-bg-elevated/60 mt-4 rounded-xl border border-line p-4 text-sm">
            <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-text-muted">
              {t('landing.legal.contactTitle')}
            </h2>
            <address className="mt-3 space-y-2 not-italic text-text-muted">
              <a href={`tel:${SITE.phone}`} className="flex items-center gap-2 hover:text-text">
                <Phone className="size-4 shrink-0 text-accent" aria-hidden="true" />
                <span className="tabular">{formatPhone(SITE.phone) || SITE.phoneDisplay}</span>
              </a>
              <a href={`mailto:${SITE.email}`} className="flex items-center gap-2 hover:text-text">
                <Mail className="size-4 shrink-0 text-accent" aria-hidden="true" />
                {SITE.email}
              </a>
              <span className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                {lc(SITE.address, locale)}
              </span>
            </address>
          </div>
        </aside>

        <div className="min-w-0">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-text sm:text-4xl md:text-5xl">
            {lc(doc.title, locale)}
          </h1>
          <p className="mt-3 text-sm text-text-muted">{t('landing.legal.updated', { date: updated })}</p>
          <p className="mt-6 text-base leading-relaxed text-text sm:text-lg">{lc(doc.intro, locale)}</p>

          <div className="mt-10 space-y-10">
            {doc.sections.map((s) => (
              <section key={s.id} id={s.id} className="scroll-mt-24" aria-labelledby={`${s.id}-h`}>
                <h2 id={`${s.id}-h`} className="font-heading text-xl font-bold text-text sm:text-2xl">
                  {lc(s.heading, locale)}
                </h2>
                <div className="mt-3 space-y-3 text-sm leading-relaxed text-text-muted sm:text-base">
                  {s.paragraphs.map((p) => (
                    <p key={p.uz}>{lc(p, locale)}</p>
                  ))}
                  {s.bullets ? (
                    <ul className="list-disc space-y-1.5 pl-5 marker:text-accent">
                      {s.bullets.map((b) => (
                        <li key={b.uz}>{lc(b, locale)}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-14 flex flex-wrap items-center gap-3 border-t border-line pt-6 text-sm">
            <span className="text-text-muted">{t('landing.legal.related')}:</span>
            <Link href={related.href} className="font-medium text-accent underline-offset-4 hover:underline">
              {related.label}
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}
