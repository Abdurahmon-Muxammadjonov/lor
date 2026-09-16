import Link from 'next/link';
import { Facebook, Instagram, Mail, MapPin, Phone, Send, Youtube } from 'lucide-react';
import { getLocale, getT } from '@/i18n/server';
import { Logo } from '@/components/shared/logo';
import { LangSwitch } from '@/components/shared/lang-switch';
import { FOOTER_COLUMNS, SITE, lc } from '@/data/landing-content';
import { formatPhone } from '@/lib/utils';
import { MadeInUzbekistan } from './made-in-uz';

const SOCIALS = [
  { key: 'telegram', href: SITE.telegramUrl, Icon: Send, label: 'Telegram' },
  { key: 'instagram', href: SITE.instagramUrl, Icon: Instagram, label: 'Instagram' },
  { key: 'youtube', href: SITE.youtubeUrl, Icon: Youtube, label: 'YouTube' },
  { key: 'facebook', href: SITE.facebookUrl, Icon: Facebook, label: 'Facebook' },
] as const;

/** Landing footer — server komponent (getT/getLocale) */
export function Footer() {
  const t = getT();
  const locale = getLocale();
  const year = new Date().getFullYear();

  return (
    <footer className="bg-bg-elevated/60 relative border-t border-line">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#00D4FF]/40 to-transparent"
      />
      <div className="container py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1.2fr]">
          {/* Brend */}
          <div className="flex flex-col gap-4">
            <Logo href="/" size="md" />
            <p className="max-w-xs text-sm leading-relaxed text-text-muted">
              {t('landing.footer.description')}
            </p>
            <ul className="flex items-center gap-2" aria-label={t('landing.footer.social')}>
              {SOCIALS.map(({ key, href, Icon, label }) => (
                <li key={key}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    title={label}
                    className="inline-flex size-9 items-center justify-center rounded-md border border-line bg-bg-base text-text-muted transition-colors hover:border-[#2B3A57] hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Icon className="size-4" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Ustunlar */}
          <nav aria-label={t('landing.footer.nav')} className="contents">
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.key}>
                <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-text">
                  {t(`landing.footer.${col.key}`)}
                </h2>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {col.links.map((l) => (
                    <li key={l.key}>
                      {l.external ? (
                        <a
                          href={l.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-sm text-sm text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {t(`landing.footer.links.${l.key}`)}
                        </a>
                      ) : (
                        <Link
                          href={l.href}
                          className="rounded-sm text-sm text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {t(`landing.footer.links.${l.key}`)}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          {/* Aloqa */}
          <div>
            <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-text">
              {t('landing.footer.contact')}
            </h2>
            <address className="mt-4 flex flex-col gap-2.5 text-sm not-italic text-text-muted">
              <a
                href={`tel:${SITE.phone}`}
                className="inline-flex items-center gap-2 transition-colors hover:text-text"
              >
                <Phone className="size-4 shrink-0 text-accent" aria-hidden="true" />
                <span className="tabular">{formatPhone(SITE.phone) || SITE.phoneDisplay}</span>
              </a>
              <a
                href={`mailto:${SITE.email}`}
                className="inline-flex items-center gap-2 transition-colors hover:text-text"
              >
                <Mail className="size-4 shrink-0 text-accent" aria-hidden="true" />
                {SITE.email}
              </a>
              <a
                href={SITE.telegramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 transition-colors hover:text-text"
              >
                <Send className="size-4 shrink-0 text-accent" aria-hidden="true" />
                {SITE.telegram}
              </a>
              <span className="inline-flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden="true" />
                <span>{lc(SITE.address, locale)}</span>
              </span>
            </address>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-line pt-6 text-xs text-text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {lc(SITE.legalEntity, locale)}. {t('landing.footer.rights')}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <MadeInUzbekistan label={t('landing.footer.madeIn')} />
            <LangSwitch variant="text" />
          </div>
        </div>
      </div>
    </footer>
  );
}
