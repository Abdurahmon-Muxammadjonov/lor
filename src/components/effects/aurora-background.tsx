'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useIsMobile } from '@/hooks/use-media-query';

export type AuroraIntensity = 'low' | 'high';

export interface AuroraBackgroundProps {
  className?: string;
  /** `high` — yorqinroq va kattaroq dogʻlar (landing hero); `low` — dashboard foni */
  intensity?: AuroraIntensity;
  /** Nozik toʻr qatlamini yashirish */
  hideGrid?: boolean;
}

interface Blob {
  /** Tailwind joylashuv/oʻlcham klasslari */
  position: string;
  /** Radial gradient rangi */
  color: string;
  /** Animatsiya klassi */
  animation: string;
  /** Mobilda ham koʻrsatiladi */
  essential: boolean;
}

const BLOBS: Blob[] = [
  {
    position: '-left-[15%] -top-[20%] h-[60vmax] w-[60vmax]',
    color: 'rgba(0, 212, 255, VAR)',
    animation: 'animate-aurora',
    essential: true,
  },
  {
    position: '-right-[20%] -top-[10%] h-[55vmax] w-[55vmax]',
    color: 'rgba(124, 92, 255, VAR)',
    animation: 'animate-aurora-slow',
    essential: true,
  },
  {
    position: '-bottom-[25%] left-[20%] h-[50vmax] w-[50vmax]',
    color: 'rgba(0, 255, 178, VAR)',
    animation: 'animate-aurora-slow',
    essential: false,
  },
  {
    position: '-bottom-[15%] -right-[10%] h-[45vmax] w-[45vmax]',
    color: 'rgba(0, 212, 255, VAR)',
    animation: 'animate-aurora',
    essential: false,
  },
];

const ALPHA: Record<AuroraIntensity, string> = { low: '0.10', high: '0.22' };

/**
 * Aurora fon — 3–4 ta katta, yumshoq radial dogʻ (cyan / violet / mint) sekin aylanadi.
 * Faqat `transform` animatsiya qilinadi (GPU). Reduced-motion da statik, mobilda 2 ta dogʻ.
 *
 *   <section className="relative"><AuroraBackground intensity="high" /> … </section>
 */
export function AuroraBackground({ className, intensity = 'low', hideGrid = false }: AuroraBackgroundProps) {
  const reduced = useReducedMotion();
  const mobile = useIsMobile();
  const alpha = ALPHA[intensity];
  const blobs = mobile ? BLOBS.filter((b) => b.essential) : BLOBS;

  return (
    <div aria-hidden="true" className={cn('pointer-events-none absolute inset-0 -z-10 overflow-hidden', className)}>
      {blobs.map((b, i) => (
        <div
          key={i}
          className={cn(
            'absolute rounded-full will-change-transform',
            b.position,
            mobile ? 'blur-2xl' : 'blur-3xl',
            !reduced && b.animation,
          )}
          style={{
            backgroundImage: `radial-gradient(closest-side, ${b.color.replace('VAR', alpha)} 0%, ${b.color.replace('VAR', '0')} 100%)`,
            animationDelay: `${i * -7}s`,
          }}
        />
      ))}
      {hideGrid ? null : <div className="absolute inset-0 bg-grid bg-grid-fade opacity-60" />}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-bg-base" />
    </div>
  );
}
