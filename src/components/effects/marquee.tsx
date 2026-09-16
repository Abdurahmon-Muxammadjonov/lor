'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

export interface MarqueeProps {
  children: React.ReactNode;
  /** Tezlik: soniyada piksel (default 40). Davomiylik kontent kengligidan hisoblanadi */
  speed?: number;
  /** Hover da toʻxtatish (default true) */
  pauseOnHover?: boolean;
  /** Teskari yoʻnalish (chapdan oʻngga) */
  reverse?: boolean;
  /** Elementlar orasidagi masofa, px (default 48) */
  gap?: number;
  /** Chekkalardagi soʻnish maskasi (default true) */
  fade?: boolean;
  className?: string;
  /** Har bir nusxa konteyneri klassi */
  itemClassName?: string;
}

const FALLBACK_DURATION = 40;

/**
 * Uzluksiz gorizontal lenta: bolalar ikki marta chiziladi, `animate-marquee` (0 → -50%) CSS oʻzgaruvchi davomiylik bilan.
 * Reduced-motion da statik (gorizontal skroll qilinadigan) roʻyxat.
 *
 *   <Marquee speed={50}><Logo1 /><Logo2 />…</Marquee>
 */
export function Marquee({
  children,
  speed = 40,
  pauseOnHover = true,
  reverse = false,
  gap = 48,
  fade = true,
  className,
  itemClassName,
}: MarqueeProps) {
  const reduced = useReducedMotion();
  const copyRef = React.useRef<HTMLDivElement>(null);
  const [duration, setDuration] = React.useState<number>(FALLBACK_DURATION);

  React.useEffect(() => {
    const el = copyRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const width = el.getBoundingClientRect().width;
      if (width > 0 && speed > 0) setDuration(Math.max(4, width / speed));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [speed]);

  const maskStyle: React.CSSProperties | undefined = fade
    ? {
        maskImage: 'linear-gradient(to right, transparent, #000 8%, #000 92%, transparent)',
        WebkitMaskImage: 'linear-gradient(to right, transparent, #000 8%, #000 92%, transparent)',
      }
    : undefined;

  if (reduced) {
    return (
      <div className={cn('relative w-full overflow-x-auto scrollbar-none', className)} style={maskStyle}>
        <div className={cn('flex w-max items-center', itemClassName)} style={{ gap, paddingInline: gap / 2 }}>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn('group relative w-full overflow-hidden', className)}
      style={{ ...maskStyle, ['--marquee-duration' as string]: `${duration}s` }}
    >
      <div
        className={cn(
          'flex w-max animate-marquee [animation-duration:var(--marquee-duration)] will-change-transform',
          pauseOnHover && 'group-hover:[animation-play-state:paused]',
        )}
        style={{ animationDirection: reverse ? 'reverse' : 'normal' }}
      >
        <div ref={copyRef} className={cn('flex shrink-0 items-center', itemClassName)} style={{ gap, paddingRight: gap }}>
          {children}
        </div>
        <div aria-hidden="true" className={cn('flex shrink-0 items-center', itemClassName)} style={{ gap, paddingRight: gap }}>
          {children}
        </div>
      </div>
    </div>
  );
}
