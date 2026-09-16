'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/use-reduced-motion';
import { useHasFinePointer, useIsMobile } from '@/hooks/use-media-query';

const HOVER_SELECTOR =
  'a, button, [role="button"], [data-cursor="hover"], label[for], summary, [role="tab"], [role="option"], [role="menuitem"], [role="radio"], [role="checkbox"], [role="switch"]';
const TEXT_SELECTOR =
  'input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]):not([type="range"]), textarea, [contenteditable="true"], [data-cursor="text"]';
const HIDE_SELECTOR = '[data-cursor="none"], iframe, video';

type CursorMode = 'default' | 'hover' | 'text' | 'hidden';

const DOT_SIZE = 6;
const RING_SIZE = 36;
const RING_LERP = 0.18;

export interface CustomCursorProps {
  className?: string;
}

/**
 * Maxsus kursor: 6px nuqta (aniq ergashadi) + 36px halqa (rAF bilan yumshoq lerp).
 * Faqat `pointer: fine`, mobil emas va reduced-motion boʻlmaganda; `html.has-custom-cursor` klassi qoʻyiladi
 * (globals.css tizim kursorini yashiradi). Havola/tugma/[data-cursor=hover] ustida halqa kengayadi va accent rangga kiradi.
 * Matn maydonlarida nuqta vertikal chiziqqa aylanadi; [data-cursor=none], iframe, video ustida yashirinadi.
 * Sichqoncha oynadan chiqsa yoki oyna fokusni yoʻqotsa — koʻrinmaydi.
 */
export function CustomCursor({ className }: CustomCursorProps) {
  const fine = useHasFinePointer();
  const reduced = useReducedMotion();
  const mobile = useIsMobile();
  const enabled = fine && !reduced && !mobile;

  const dotRef = React.useRef<HTMLDivElement>(null);
  const ringRef = React.useRef<HTMLDivElement>(null);
  const dotInnerRef = React.useRef<HTMLDivElement>(null);
  const ringInnerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!enabled) return;
    const dot = dotRef.current;
    const ring = ringRef.current;
    const dotInner = dotInnerRef.current;
    const ringInner = ringInnerRef.current;
    if (!dot || !ring || !dotInner || !ringInner) return;

    const root = document.documentElement;
    root.classList.add('has-custom-cursor');

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let ringX = targetX;
    let ringY = targetY;
    let visible = false;
    let pressed = false;
    let mode: CursorMode = 'default';
    let raf = 0;
    let idle = true;

    const applyState = () => {
      dotInner.dataset.mode = mode;
      ringInner.dataset.mode = mode;
      dotInner.dataset.pressed = pressed ? 'true' : 'false';
      ringInner.dataset.pressed = pressed ? 'true' : 'false';
    };

    const setVisible = (v: boolean) => {
      if (visible === v) return;
      visible = v;
      dot.style.opacity = v ? '1' : '0';
      ring.style.opacity = v ? '1' : '0';
    };

    const tick = () => {
      ringX += (targetX - ringX) * RING_LERP;
      ringY += (targetY - ringY) * RING_LERP;
      ring.style.transform = `translate3d(${ringX - RING_SIZE / 2}px, ${ringY - RING_SIZE / 2}px, 0)`;
      const settled = Math.abs(targetX - ringX) < 0.05 && Math.abs(targetY - ringY) < 0.05;
      if (settled) {
        idle = true;
        raf = 0;
        return;
      }
      raf = window.requestAnimationFrame(tick);
    };

    const wake = () => {
      if (idle) {
        idle = false;
        raf = window.requestAnimationFrame(tick);
      }
    };

    const onMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      dot.style.transform = `translate3d(${targetX - DOT_SIZE / 2}px, ${targetY - DOT_SIZE / 2}px, 0)`;
      setVisible(true);
      wake();
    };

    const resolveMode = (target: EventTarget | null): CursorMode => {
      if (!(target instanceof Element)) return 'default';
      if (target.closest(HIDE_SELECTOR)) return 'hidden';
      if (target.closest(TEXT_SELECTOR)) return 'text';
      if (target.closest(HOVER_SELECTOR)) return 'hover';
      return 'default';
    };

    const onOver = (e: MouseEvent) => {
      const next = resolveMode(e.target);
      if (next !== mode) {
        mode = next;
        applyState();
      }
    };

    const onDown = () => {
      pressed = true;
      applyState();
    };
    const onUp = () => {
      pressed = false;
      applyState();
    };

    const onOut = (e: MouseEvent) => {
      // relatedTarget null → sichqoncha brauzer oynasidan chiqdi
      if (e.relatedTarget === null) setVisible(false);
    };
    const onBlur = () => setVisible(false);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') setVisible(false);
    };

    applyState();
    document.addEventListener('mousemove', onMove, { passive: true });
    document.addEventListener('mouseover', onOver, { passive: true });
    document.addEventListener('mousedown', onDown, { passive: true });
    document.addEventListener('mouseup', onUp, { passive: true });
    document.addEventListener('mouseout', onOut, { passive: true });
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      root.classList.remove('has-custom-cursor');
      if (raf) window.cancelAnimationFrame(raf);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('mouseout', onOut);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div aria-hidden="true" className={cn('pointer-events-none fixed inset-0 z-[9999] hidden md:block', className)}>
      {/* Nuqta — tashqi element faqat joylashadi (inline transform), ichkisi koʻrinishni beradi */}
      <div
        ref={dotRef}
        className="absolute left-0 top-0 opacity-0 will-change-transform transition-opacity duration-200"
        style={{ width: DOT_SIZE, height: DOT_SIZE }}
      >
        <div
          ref={dotInnerRef}
          data-mode="default"
          data-pressed="false"
          className={cn(
            'absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent',
            'transition-[width,height,border-radius,opacity,background-color,transform] duration-150 ease-out',
            'data-[mode=hidden]:opacity-0',
            'data-[mode=hover]:bg-bg-base',
            'data-[mode=text]:h-5 data-[mode=text]:w-0.5 data-[mode=text]:rounded-sm',
            'data-[pressed=true]:scale-75',
          )}
        />
      </div>
      {/* Halqa */}
      <div
        ref={ringRef}
        className="absolute left-0 top-0 opacity-0 will-change-transform transition-opacity duration-200"
        style={{ width: RING_SIZE, height: RING_SIZE }}
      >
        <div
          ref={ringInnerRef}
          data-mode="default"
          data-pressed="false"
          className={cn(
            'absolute inset-0 rounded-full border border-primary/70',
            'transition-[opacity,border-color,background-color,transform] duration-200 ease-out',
            'data-[mode=hidden]:opacity-0',
            'data-[mode=hover]:scale-150 data-[mode=hover]:border-transparent data-[mode=hover]:bg-primary/25',
            'data-[mode=text]:scale-50 data-[mode=text]:border-muted-foreground/60',
            'data-[pressed=true]:scale-90',
          )}
        />
      </div>
    </div>
  );
}
