'use client';

import * as React from 'react';
import { LayoutGroup, motion } from 'framer-motion';
import { Check, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LOCALES, LOCALE_LABELS, type Locale } from '@/i18n/config';
import { useLocale } from '@/i18n/client';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type LangSwitchVariant = 'pill' | 'menu' | 'text';

export interface LangSwitchProps {
  variant?: LangSwitchVariant;
  className?: string;
  /** `pill` uchun oʻlcham */
  size?: 'sm' | 'md';
}

const SHORT: Record<Locale, string> = { uz: 'UZ', ru: 'RU' };

/**
 * Til almashtirgich (UZ / RU). Cookie `NEXT_LOCALE` ni yozadi va sahifani yangilaydi (`setLocale`).
 *
 *   <LangSwitch />                 — sirpanuvchi indikatorli pill
 *   <LangSwitch variant="menu" />  — globus ikonkali menyu
 *   <LangSwitch variant="text" />  — "UZ · RU" matn
 */
export function LangSwitch({ variant = 'pill', className, size = 'md' }: LangSwitchProps) {
  const { locale, setLocale, t } = useLocale();
  const reduced = useReducedMotion();
  const id = React.useId();
  const [pending, setPending] = React.useState<Locale | null>(null);

  React.useEffect(() => {
    setPending(null);
  }, [locale]);

  const change = (l: Locale) => {
    if (l === locale) return;
    setPending(l);
    setLocale(l);
  };

  const label = t('common.language');

  if (variant === 'menu') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className={cn('gap-1.5 px-2', className)} aria-label={label} title={label}>
            <Globe aria-hidden="true" />
            <span className="text-xs font-semibold tracking-wide">{SHORT[pending ?? locale]}</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[9rem]">
          {LOCALES.map((l) => (
            <DropdownMenuItem key={l} onSelect={() => change(l)} className="justify-between" aria-current={l === locale ? 'true' : undefined}>
              <span className="flex items-center gap-2">
                <span className="w-6 text-xs font-bold text-text-muted">{SHORT[l]}</span>
                {LOCALE_LABELS[l]}
              </span>
              {l === locale ? <Check className="text-accent" aria-hidden="true" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (variant === 'text') {
    return (
      <div role="group" aria-label={label} className={cn('inline-flex items-center gap-1 text-xs font-semibold tracking-wide', className)}>
        {LOCALES.map((l, i) => (
          <React.Fragment key={l}>
            {i > 0 ? (
              <span aria-hidden="true" className="text-muted-foreground/60">
                ·
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => change(l)}
              aria-pressed={l === locale}
              aria-label={LOCALE_LABELS[l]}
              className={cn(
                'rounded-sm px-1 py-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                l === (pending ?? locale) ? 'text-accent' : 'text-text-muted hover:text-text',
              )}
            >
              {SHORT[l]}
            </button>
          </React.Fragment>
        ))}
      </div>
    );
  }

  const active = pending ?? locale;
  return (
    <LayoutGroup id={id}>
      <div
        role="group"
        aria-label={label}
        className={cn(
          'relative inline-flex items-center rounded-full border border-line bg-bg-elevated p-0.5',
          size === 'sm' ? 'h-8' : 'h-9',
          className,
        )}
      >
        {LOCALES.map((l) => {
          const isActive = l === active;
          return (
            <button
              key={l}
              type="button"
              onClick={() => change(l)}
              aria-pressed={l === locale}
              aria-label={LOCALE_LABELS[l]}
              title={LOCALE_LABELS[l]}
              className={cn(
                'relative inline-flex h-full items-center justify-center rounded-full font-semibold tracking-wide transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-elevated',
                size === 'sm' ? 'min-w-[2.25rem] px-2 text-[11px]' : 'min-w-[2.75rem] px-3 text-xs',
                isActive ? 'text-bg-base' : 'text-text-muted hover:text-text',
              )}
            >
              {isActive ? (
                <motion.span
                  layoutId={`${id}-lang-indicator`}
                  aria-hidden="true"
                  className="absolute inset-0 rounded-full bg-gradient-accent shadow-[0_0_0_1px_rgba(0,212,255,0.2),0_4px_14px_-4px_rgba(0,212,255,0.5)]"
                  transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 42, mass: 0.8 }}
                />
              ) : null}
              <span className="relative z-10">{SHORT[l]}</span>
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}
