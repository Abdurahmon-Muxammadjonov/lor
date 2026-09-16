'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

export interface RotatingWordsProps {
  words: string[];
  /** Almashish oraligʻi, ms (default 2400) */
  interval?: number;
  className?: string;
}

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

/**
 * Aylanuvchi soʻzlar (hero subtitle). Kenglik eng uzun soʻzga qarab oldindan band qilinadi — layout sakramaydi.
 * Skrin-rider uchun barcha soʻzlar bir marta oʻqiladi; tab yashirin boʻlsa toʻxtaydi; reduced-motion — animatsiyasiz.
 */
export function RotatingWords({ words, interval = 2400, className }: RotatingWordsProps) {
  const reduced = useReducedMotion();
  const [index, setIndex] = React.useState(0);

  React.useEffect(() => {
    if (words.length < 2) return;
    const id = window.setInterval(
      () => {
        if (document.visibilityState === 'visible') setIndex((i) => (i + 1) % words.length);
      },
      Math.max(1200, interval),
    );
    return () => window.clearInterval(id);
  }, [words.length, interval]);

  const word = words[index] ?? words[0] ?? '';

  return (
    <span className={cn('relative inline-grid align-baseline', className)}>
      <span className="sr-only">{words.join(', ')}</span>
      {words.map((w) => (
        <span
          key={w}
          aria-hidden="true"
          className="invisible col-start-1 row-start-1 whitespace-nowrap font-semibold"
        >
          {w}
        </span>
      ))}
      {reduced ? (
        <span
          aria-hidden="true"
          className="text-gradient col-start-1 row-start-1 whitespace-nowrap font-semibold"
        >
          {word}
        </span>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={word}
            aria-hidden="true"
            className="text-gradient col-start-1 row-start-1 whitespace-nowrap font-semibold will-change-transform"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -14 }}
            transition={{ duration: 0.32, ease: EASE }}
          >
            {word}
          </motion.span>
        </AnimatePresence>
      )}
    </span>
  );
}
