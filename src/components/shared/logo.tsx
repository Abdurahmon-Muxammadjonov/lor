import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export type LogoSize = 'sm' | 'md' | 'lg';

export interface LogoProps {
  size?: LogoSize;
  /** "LOR CRM" soʻz belgisini koʻrsatish (default true) */
  withText?: boolean;
  /** Berilsa <Link> boʻladi */
  href?: string;
  className?: string;
  /** Faqat belgi uchun klass */
  markClassName?: string;
}

const SIZE: Record<LogoSize, { mark: number; text: string; gap: string }> = {
  sm: { mark: 24, text: 'text-base', gap: 'gap-2' },
  md: { mark: 32, text: 'text-lg', gap: 'gap-2.5' },
  lg: { mark: 44, text: 'text-2xl', gap: 'gap-3' },
};

export interface LogoMarkProps {
  size?: number;
  className?: string;
  title?: string;
}

/** Belgi (quloq + tovush toʻlqinlari) — public/icons/icon.svg bilan bir xil dizayn, inline SVG */
export function LogoMark({ size = 32, className, title }: LogoMarkProps) {
  const id = React.useId().replace(/:/g, '');
  const accent = `lor-accent-${id}`;
  const bg = `lor-bg-${id}`;
  const halo = `lor-halo-${id}`;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={cn('shrink-0', className)}
    >
      <defs>
        <linearGradient id={accent} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#00D4FF" />
          <stop offset="1" stopColor="#7C5CFF" />
        </linearGradient>
        <linearGradient id={bg} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#111828" />
          <stop offset="1" stopColor="#060810" />
        </linearGradient>
        <radialGradient id={halo} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#00D4FF" stopOpacity="0.22" />
          <stop offset="1" stopColor="#00D4FF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill={`url(#${bg})`} />
      <rect x="0.5" y="0.5" width="63" height="63" rx="13.5" fill="none" stroke="#1F2A40" />
      <circle cx="30" cy="32" r="22" fill={`url(#${halo})`} />
      <path
        d="M25 47 C25 42 18.5 39 18.5 29.5 C18.5 21 24.5 14.5 32 14.5 C39.5 14.5 44.5 20 44.5 26.5 C44.5 32 41 34.5 38 36.5"
        fill="none"
        stroke={`url(#${accent})`}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M25 47 C25 50.5 28.5 52.5 32 51" fill="none" stroke={`url(#${accent})`} strokeWidth="4" strokeLinecap="round" />
      <path
        d="M27.5 31 C27.5 25.5 31 22.5 34.5 22.5 C37.5 22.5 39 24.5 39 27"
        fill="none"
        stroke={`url(#${accent})`}
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeOpacity="0.85"
      />
      <path d="M48 24.5 A10 10 0 0 1 48 39.5" fill="none" stroke="#00D4FF" strokeWidth="2.6" strokeLinecap="round" strokeOpacity="0.9" />
      <path d="M52.5 20.5 A16 16 0 0 1 52.5 43.5" fill="none" stroke="#7C5CFF" strokeWidth="2.4" strokeLinecap="round" strokeOpacity="0.75" />
      <circle cx="45" cy="32" r="1.8" fill="#00FFB2" />
    </svg>
  );
}

/**
 * Logotip: belgi + "LOR CRM" soʻz belgisi (font-heading, gradient).
 *
 *   <Logo href="/" size="lg" />
 */
export function Logo({ size = 'md', withText = true, href, className, markClassName }: LogoProps) {
  const s = SIZE[size];
  const content = (
    <>
      <LogoMark size={s.mark} className={markClassName} title={withText ? undefined : 'LOR CRM'} />
      {withText ? (
        <span className={cn('font-heading font-extrabold leading-none tracking-tight', s.text)}>
          <span className="text-gradient">LOR</span>
          <span className="text-text"> CRM</span>
        </span>
      ) : null}
    </>
  );
  const classes = cn('inline-flex select-none items-center', s.gap, className);

  if (href) {
    return (
      <Link href={href} className={cn(classes, 'rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg-base')} aria-label="LOR CRM">
        {content}
      </Link>
    );
  }
  return <span className={classes}>{content}</span>;
}
