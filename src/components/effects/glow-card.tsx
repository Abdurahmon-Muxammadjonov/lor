'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { useHasFinePointer } from '@/hooks/use-media-query';

export type GlowColor = 'cyan' | 'violet' | 'mint';

export interface GlowCardProps extends React.HTMLAttributes<HTMLDivElement> {
  glow?: GlowColor;
  /** Yorugʻlik radiusi, px (default 260) */
  radius?: number;
  /** Ichki kontent klassi */
  contentClassName?: string;
  /** Kuchliroq shisha fon (.glass-strong) */
  strong?: boolean;
}

const GLOW_RGB: Record<GlowColor, string> = {
  cyan: '0, 212, 255',
  violet: '124, 92, 255',
  mint: '0, 255, 178',
};

/**
 * Shisha (.glass) karta — sichqoncha ergashuvchi radial yorugʻlik (chegara + yuza).
 * Faqat CSS oʻzgaruvchilar (--mx, --my) yangilanadi, React holati yoʻq — arzon.
 *
 *   <GlowCard glow="violet" className="p-6">…</GlowCard>
 */
export const GlowCard = React.forwardRef<HTMLDivElement, GlowCardProps>(
  ({ glow = 'cyan', radius = 260, className, contentClassName, strong = false, children, onMouseMove, onMouseLeave, style, ...props }, ref) => {
    const fine = useHasFinePointer();
    const rgb = GLOW_RGB[glow];

    const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
      onMouseMove?.(e);
      if (!fine) return;
      const el = e.currentTarget;
      const rect = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
      el.style.setProperty('--my', `${e.clientY - rect.top}px`);
      el.style.setProperty('--glow-o', '1');
    };
    const handleLeave = (e: React.MouseEvent<HTMLDivElement>) => {
      onMouseLeave?.(e);
      e.currentTarget.style.setProperty('--glow-o', '0');
    };

    const vars: React.CSSProperties = {
      ...style,
      ['--mx' as string]: '50%',
      ['--my' as string]: '50%',
      ['--glow-o' as string]: '0',
      ['--glow-rgb' as string]: rgb,
      ['--glow-r' as string]: `${radius}px`,
    };

    return (
      <div
        ref={ref}
        className={cn(strong ? 'glass-strong' : 'glass', 'group/glow relative overflow-hidden', className)}
        style={vars}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        {...props}
      >
        {/* Yuza yorugʻligi */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-[var(--glow-o)] transition-opacity duration-300"
          style={{
            background: `radial-gradient(var(--glow-r) circle at var(--mx) var(--my), rgba(var(--glow-rgb), 0.14), transparent 60%)`,
          }}
        />
        {/* Chegara yorugʻligi (1px, mask bilan) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-[var(--glow-o)] transition-opacity duration-300"
          style={{
            padding: 1,
            background: `radial-gradient(calc(var(--glow-r) * 0.8) circle at var(--mx) var(--my), rgba(var(--glow-rgb), 0.9), transparent 70%)`,
            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            maskComposite: 'exclude',
          }}
        />
        <div className={cn('relative', contentClassName)}>{children}</div>
      </div>
    );
  },
);
GlowCard.displayName = 'GlowCard';
