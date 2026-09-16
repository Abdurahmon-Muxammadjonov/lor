'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowRight, LogIn, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useT } from '@/i18n/client';
import { Logo } from '@/components/shared/logo';
import { LangSwitch } from '@/components/shared/lang-switch';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

const LINKS = [
  { key: 'features', href: '/#features' },
  { key: 'demo', href: '/#demo' },
  { key: 'pricing', href: '/#pricing' },
  { key: 'faq', href: '/#faq' },
] as const;

const SCROLL_THRESHOLD = 24;

/**
 * Yopishqoq navbar: boshida shaffof, 24px skrolldan soʻng shisha + ixchamlashadi (rAF bilan scroll tinglovchi).
 * Desktop: havolalar + LangSwitch + Kirish + Bepul sinab koʻrish. Mobil: Sheet menyu.
 */
export function Navbar() {
  const t = useT();
  const [scrolled, setScrolled] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      setScrolled(window.scrollY > SCROLL_THRESHOLD);
    };
    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-40 w-full transition-[background-color,border-color,box-shadow,backdrop-filter] duration-300',
        scrolled
          ? 'border-b border-line bg-background/80 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl'
          : 'border-b border-transparent bg-transparent',
      )}
      data-scrolled={scrolled ? 'true' : 'false'}
    >
      <nav
        aria-label={t('landing.nav.primary')}
        className={cn(
          'container flex items-center justify-between gap-4 transition-[height] duration-300',
          scrolled ? 'h-14 md:h-16' : 'h-16 md:h-20',
        )}
      >
        <Logo href="/" size={scrolled ? 'sm' : 'md'} className="transition-all" />

        <ul className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <li key={l.key}>
              <Link
                href={l.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-text-muted transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {t(`landing.nav.${l.key}`)}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2 sm:gap-3">
          <LangSwitch size="sm" className="hidden sm:inline-flex" />
          <Button asChild variant="outline" size="sm" className="hidden md:inline-flex">
            <Link href="/login">
              <LogIn aria-hidden="true" />
              {t('landing.nav.login')}
            </Link>
          </Button>
          <Button asChild variant="gradient" size="sm" className="hidden sm:inline-flex">
            <Link href="/login">
              {t('landing.nav.trial')}
              <ArrowRight aria-hidden="true" />
            </Link>
          </Button>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="md:hidden"
                aria-label={t('landing.nav.openMenu')}
              >
                <Menu aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[86vw] max-w-sm">
              <SheetHeader className="text-left">
                <SheetTitle>{t('landing.nav.menu')}</SheetTitle>
                <SheetDescription>{t('landing.nav.menuDescription')}</SheetDescription>
              </SheetHeader>
              <ul className="mt-2 flex flex-col gap-1">
                {LINKS.map((l) => (
                  <li key={l.key}>
                    <SheetClose asChild>
                      <Link
                        href={l.href}
                        className="flex items-center justify-between rounded-md px-3 py-3 text-base font-medium text-text transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {t(`landing.nav.${l.key}`)}
                        <ArrowRight className="size-4 text-text-muted" aria-hidden="true" />
                      </Link>
                    </SheetClose>
                  </li>
                ))}
              </ul>
              <div className="mt-auto flex flex-col gap-3 border-t border-line pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-muted">{t('common.language')}</span>
                  <LangSwitch size="sm" />
                </div>
                <SheetClose asChild>
                  <Button asChild variant="outline" size="lg">
                    <Link href="/login">
                      <LogIn aria-hidden="true" />
                      {t('landing.nav.login')}
                    </Link>
                  </Button>
                </SheetClose>
                <SheetClose asChild>
                  <Button asChild variant="gradient" size="lg">
                    <Link href="/login">
                      {t('landing.nav.trial')}
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  </Button>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}
