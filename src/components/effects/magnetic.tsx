'use client';

import * as React from 'react';
import { motion, useMotionValue, useSpring } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useHasFinePointer, useIsMobile } from '@/hooks/use-media-query';

export interface MagneticProps {
  /** Bitta bola element (tugma, havola, ikonka) */
  children: React.ReactNode;
  /** Tortilish kuchi: 0 — harakatsiz, 1 — kursor bilan birga (default 0.35) */
  strength?: number;
  /** Element chegarasidan tashqarida ham tortadigan masofa, px (default 80) */
  radius?: number;
  className?: string;
  /** Element ustida `data-cursor="hover"` (maxsus kursor kengayadi) */
  cursorHover?: boolean;
}

const SPRING = { stiffness: 220, damping: 18, mass: 0.6 };

/* ── Bitta umumiy pointermove tinglovchi: barcha Magnetic nusxalari uchun (rAF bilan bir kadrda) ── */
type Subscriber = (x: number, y: number) => void;
const subscribers = new Set<Subscriber>();
let raf = 0;
let lastX = 0;
let lastY = 0;
let attached = false;

function flush() {
  raf = 0;
  subscribers.forEach((fn) => fn(lastX, lastY));
}
function onWindowMove(e: PointerEvent) {
  if (e.pointerType !== 'mouse') return;
  lastX = e.clientX;
  lastY = e.clientY;
  if (!raf) raf = window.requestAnimationFrame(flush);
}
function subscribe(fn: Subscriber): () => void {
  subscribers.add(fn);
  if (!attached) {
    window.addEventListener('pointermove', onWindowMove, { passive: true });
    attached = true;
  }
  return () => {
    subscribers.delete(fn);
    if (subscribers.size === 0 && attached) {
      window.removeEventListener('pointermove', onWindowMove);
      attached = false;
      if (raf) {
        window.cancelAnimationFrame(raf);
        raf = 0;
      }
    }
  };
}

/**
 * "Magnit" oʻrami — bola element kursor yaqinlashganda u tomon sirpanadi (framer-motion spring),
 * uzoqlashganda joyiga qaytadi. Sezgir zona element chegarasidan `radius` px tashqarigacha,
 * lekin qoʻshni elementlarga xalaqit bermaydi (umumiy window tinglovchi).
 * Touch qurilmalar, mobil va reduced-motion da oddiy oʻram (harakatsiz).
 *
 *   <Magnetic><Button>Boshlash</Button></Magnetic>
 */
export function Magnetic({ children, strength = 0.35, radius = 80, className, cursorHover = true }: MagneticProps) {
  const reduced = useReducedMotion();
  const fine = useHasFinePointer();
  const mobile = useIsMobile();
  const enabled = fine && !mobile && !reduced;

  const ref = React.useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const x = useSpring(mx, SPRING);
  const y = useSpring(my, SPRING);

  React.useEffect(() => {
    if (!enabled) {
      mx.set(0);
      my.set(0);
      return;
    }
    let active = false;
    const unsubscribe = subscribe((px, py) => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = px - cx;
      const dy = py - cy;
      // Element chegarasidan tashqaridagi masofa (ichida 0)
      const outsideX = Math.max(0, Math.abs(dx) - rect.width / 2);
      const outsideY = Math.max(0, Math.abs(dy) - rect.height / 2);
      const outside = Math.hypot(outsideX, outsideY);
      if (outside > radius) {
        if (active) {
          active = false;
          mx.set(0);
          my.set(0);
        }
        return;
      }
      active = true;
      const falloff = radius > 0 ? 1 - outside / radius : 1;
      mx.set(dx * strength * falloff);
      my.set(dy * strength * falloff);
    });
    const onLeave = () => {
      active = false;
      mx.set(0);
      my.set(0);
    };
    document.addEventListener('mouseleave', onLeave);
    window.addEventListener('blur', onLeave);
    return () => {
      unsubscribe();
      document.removeEventListener('mouseleave', onLeave);
      window.removeEventListener('blur', onLeave);
      mx.set(0);
      my.set(0);
    };
  }, [enabled, radius, strength, mx, my]);

  return (
    <motion.div
      ref={ref}
      className={cn('relative inline-flex', className)}
      style={enabled ? { x, y } : undefined}
      data-cursor={cursorHover ? 'hover' : undefined}
    >
      {children}
    </motion.div>
  );
}
