'use client';

import * as React from 'react';
import { motion, useMotionTemplate, useMotionValue, useSpring } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useHasFinePointer, useIsMobile } from '@/hooks/use-media-query';

export interface TiltProps {
  children?: React.ReactNode;
  /** Maksimal burilish burchagi, gradus (default 10) */
  max?: number;
  /** Hover da kattalashish (default 1.02) */
  scale?: number;
  /** Harakatlanuvchi yaltiroq (glare) qatlam (default true) */
  glare?: boolean;
  /** Perspektiva, px (default 900) */
  perspective?: number;
  className?: string;
  /** Ichki (buriluvchi) element klassi */
  innerClassName?: string;
  style?: React.CSSProperties;
}

const SPRING = { stiffness: 260, damping: 24, mass: 0.7 };

/**
 * Qoʻlda yozilgan 3D tilt: sichqoncha holati → rotateX/rotateY (perspektiva bilan), framer-motion spring.
 * Ixtiyoriy yaltiroq (glare) kursorga ergashadi. Touch, mobil va reduced-motion da oddiy konteyner.
 *
 *   <Tilt className="rounded-2xl"><GlowCard>…</GlowCard></Tilt>
 */
export function Tilt({
  children,
  max = 10,
  scale = 1.02,
  glare = true,
  perspective = 900,
  className,
  innerClassName,
  style,
}: TiltProps) {
  const reduced = useReducedMotion();
  const fine = useHasFinePointer();
  const mobile = useIsMobile();
  const enabled = fine && !mobile && !reduced;

  const ref = React.useRef<HTMLDivElement>(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const s = useMotionValue(1);
  const gx = useMotionValue(50);
  const gy = useMotionValue(50);
  const go = useMotionValue(0);

  const rotateX = useSpring(rx, SPRING);
  const rotateY = useSpring(ry, SPRING);
  const scaleValue = useSpring(s, SPRING);
  const glareX = useSpring(gx, { stiffness: 200, damping: 30 });
  const glareY = useSpring(gy, { stiffness: 200, damping: 30 });
  const glareOpacity = useSpring(go, { stiffness: 200, damping: 30 });
  const glareBackground = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, rgba(234, 240, 255, 0.22) 0%, rgba(234, 240, 255, 0.06) 30%, transparent 65%)`;

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!enabled || e.pointerType !== 'mouse') return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const px = (e.clientX - rect.left) / rect.width; // 0..1
    const py = (e.clientY - rect.top) / rect.height; // 0..1
    ry.set((px - 0.5) * 2 * max);
    rx.set(-(py - 0.5) * 2 * max);
    gx.set(px * 100);
    gy.set(py * 100);
  };

  const onPointerEnter = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!enabled || e.pointerType !== 'mouse') return;
    s.set(scale);
    go.set(1);
  };

  const reset = () => {
    rx.set(0);
    ry.set(0);
    s.set(1);
    go.set(0);
  };

  React.useEffect(() => {
    if (!enabled) reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  if (!enabled) {
    return (
      <div className={cn('relative', className)} style={style}>
        <div className={cn('relative h-full w-full', innerClassName)}>{children}</div>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className={cn('relative', className)}
      style={{ ...style, perspective }}
      onPointerMove={onPointerMove}
      onPointerEnter={onPointerEnter}
      onPointerLeave={reset}
      onPointerCancel={reset}
    >
      <motion.div
        className={cn('relative h-full w-full will-change-transform', innerClassName)}
        style={{ rotateX, rotateY, scale: scaleValue, transformStyle: 'preserve-3d' }}
      >
        {children}
        {glare ? (
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-[inherit] mix-blend-screen"
            style={{ background: glareBackground, opacity: glareOpacity }}
          />
        ) : null}
      </motion.div>
    </div>
  );
}
