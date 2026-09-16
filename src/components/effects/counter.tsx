'use client';

import * as React from 'react';
import { useInView } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

export interface CounterProps {
  /** Yakuniy qiymat */
  to: number;
  /** Boshlangʻich qiymat (default 0) */
  from?: number;
  /** Davomiylik, soniya (default 1.6) */
  duration?: number;
  suffix?: string;
  prefix?: string;
  /** Kasr xonalar (default 0) */
  decimals?: number;
  /** Minglar ajratgichi (default oddiy probel) */
  separator?: string;
  /** Kasr ajratgichi (default vergul — UZ/RU) */
  decimalSeparator?: string;
  className?: string;
  /** Koʻrinish maydoniga kirishini kutmasdan darhol boshlash */
  immediate?: boolean;
}

const easeOutExpo = (t: number): number => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/** 1234567.891 → "1 234 567,89" */
export function formatCounterValue(n: number, decimals = 0, separator = ' ', decimalSeparator = ','): string {
  if (!Number.isFinite(n)) return '0';
  const fixed = Math.abs(n).toFixed(Math.max(0, decimals));
  const [intPart = '0', fracPart] = fixed.split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
  const sign = n < 0 && Number(fixed) !== 0 ? '−' : '';
  return fracPart ? `${sign}${grouped}${decimalSeparator}${fracPart}` : `${sign}${grouped}`;
}

/**
 * Raqamli hisoblagich — koʻrinish maydoniga kirganda `from` dan `to` gacha easeOutExpo bilan sanaydi (rAF).
 * `to` oʻzgarsa joriy qiymatdan yangi qiymatga qayta sanaydi. Reduced-motion da yakuniy qiymat darhol.
 *
 *   <Counter to={12500} suffix="+" />
 */
export function Counter({
  to,
  from = 0,
  duration = 1.6,
  suffix,
  prefix,
  decimals = 0,
  separator = ' ',
  decimalSeparator = ',',
  className,
  immediate = false,
}: CounterProps) {
  const reduced = useReducedMotion();
  const ref = React.useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: '0px 0px -10% 0px' });
  const shouldRun = immediate || inView;

  const [value, setValue] = React.useState<number>(reduced ? to : from);
  const currentRef = React.useRef<number>(reduced ? to : from);
  const rafRef = React.useRef<number>(0);

  React.useEffect(() => {
    if (!shouldRun) return;
    if (rafRef.current) window.cancelAnimationFrame(rafRef.current);

    if (reduced || duration <= 0) {
      currentRef.current = to;
      setValue(to);
      return;
    }

    const start = currentRef.current;
    const delta = to - start;
    if (delta === 0) return;
    const total = duration * 1000;
    let startTime: number | null = null;

    const step = (now: number) => {
      if (startTime === null) startTime = now;
      const progress = Math.min(1, (now - startTime) / total);
      const eased = easeOutExpo(progress);
      const next = start + delta * eased;
      currentRef.current = next;
      setValue(next);
      if (progress < 1) {
        rafRef.current = window.requestAnimationFrame(step);
      } else {
        currentRef.current = to;
        setValue(to);
        rafRef.current = 0;
      }
    };
    rafRef.current = window.requestAnimationFrame(step);

    return () => {
      if (rafRef.current) window.cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    };
  }, [shouldRun, to, duration, reduced]);

  const finalText = `${prefix ?? ''}${formatCounterValue(to, decimals, separator, decimalSeparator)}${suffix ?? ''}`;
  const liveText = `${prefix ?? ''}${formatCounterValue(value, decimals, separator, decimalSeparator)}${suffix ?? ''}`;

  return (
    <span ref={ref} className={cn('tabular', className)}>
      <span aria-hidden="true">{liveText}</span>
      <span className="sr-only">{finalText}</span>
    </span>
  );
}
