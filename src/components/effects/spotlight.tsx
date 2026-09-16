'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useHasFinePointer, useIsMobile } from '@/hooks/use-media-query';

export interface SpotlightProps {
  className?: string;
  /** Radius, px (default 520) */
  size?: number;
  /** Rang (rgb kanallari) — default cyan */
  rgb?: string;
  /** Maksimal shaffoflik (default 0.08) */
  opacity?: number;
}

/**
 * Sahifa darajasidagi kursor yorugʻligi — juda past shaffoflikdagi radial gradient sichqonchaga ergashadi.
 * Faqat desktop (pointer: fine), reduced-motion da koʻrsatilmaydi. rAF bilan cheklangan.
 */
export function Spotlight({ className, size = 520, rgb = '0, 212, 255', opacity = 0.08 }: SpotlightProps) {
  const fine = useHasFinePointer();
  const mobile = useIsMobile();
  const reduced = useReducedMotion();
  const enabled = fine && !mobile && !reduced;
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!enabled) return;
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    let x = window.innerWidth / 2;
    let y = window.innerHeight / 3;
    let shown = false;

    const paint = () => {
      raf = 0;
      el.style.setProperty('--sx', `${x}px`);
      el.style.setProperty('--sy', `${y}px`);
      if (!shown) {
        shown = true;
        el.style.opacity = '1';
      }
    };
    const onMove = (e: MouseEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (!raf) raf = window.requestAnimationFrame(paint);
    };
    const hide = () => {
      shown = false;
      el.style.opacity = '0';
    };
    const onOut = (e: MouseEvent) => {
      if (e.relatedTarget === null) hide();
    };

    document.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseout', onOut, { passive: true });
    window.addEventListener('blur', hide);
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseout', onOut);
      window.removeEventListener('blur', hide);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn('pointer-events-none fixed inset-0 z-0 opacity-0 transition-opacity duration-500', className)}
      style={{
        ['--sx' as string]: '50%',
        ['--sy' as string]: '33%',
        background: `radial-gradient(${size}px circle at var(--sx) var(--sy), rgba(${rgb}, ${opacity}), transparent 70%)`,
      }}
    />
  );
}
