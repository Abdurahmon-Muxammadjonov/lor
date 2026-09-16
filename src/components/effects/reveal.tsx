'use client';

import * as React from 'react';
import { motion, type HTMLMotionProps, type Variants } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

export type RevealTag = 'div' | 'section' | 'article' | 'span' | 'p' | 'ul' | 'ol' | 'li' | 'header' | 'footer' | 'aside' | 'figure' | 'nav';

const TAGS: Record<RevealTag, React.ComponentType<HTMLMotionProps<'div'>>> = {
  div: motion.div,
  section: motion.section as React.ComponentType<HTMLMotionProps<'div'>>,
  article: motion.article as React.ComponentType<HTMLMotionProps<'div'>>,
  span: motion.span as React.ComponentType<HTMLMotionProps<'div'>>,
  p: motion.p as React.ComponentType<HTMLMotionProps<'div'>>,
  ul: motion.ul as React.ComponentType<HTMLMotionProps<'div'>>,
  ol: motion.ol as React.ComponentType<HTMLMotionProps<'div'>>,
  li: motion.li as React.ComponentType<HTMLMotionProps<'div'>>,
  header: motion.header as React.ComponentType<HTMLMotionProps<'div'>>,
  footer: motion.footer as React.ComponentType<HTMLMotionProps<'div'>>,
  aside: motion.aside as React.ComponentType<HTMLMotionProps<'div'>>,
  figure: motion.figure as React.ComponentType<HTMLMotionProps<'div'>>,
  nav: motion.nav as React.ComponentType<HTMLMotionProps<'div'>>,
};

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const VIEWPORT_MARGIN = '0px 0px -10% 0px';

export interface RevealProps {
  children?: React.ReactNode;
  /** Kechikish, soniya */
  delay?: number;
  /** Boshlangʻich vertikal siljish, px (default 24) */
  y?: number;
  /** Faqat bir marta koʻrsatish (default true) */
  once?: boolean;
  /** Davomiylik, soniya (default 0.7) */
  duration?: number;
  className?: string;
  as?: RevealTag;
  style?: React.CSSProperties;
  id?: string;
}

/**
 * Koʻrinish maydoniga kirganda fade + pastdan sirpanish (framer-motion whileInView).
 * Reduced-motion da darhol koʻrinadi.
 *
 *   <Reveal delay={0.1}><h2>…</h2></Reveal>
 */
export function Reveal({ children, delay = 0, y = 24, once = true, duration = 0.7, className, as = 'div', style, id }: RevealProps) {
  const reduced = useReducedMotion();
  const Comp = TAGS[as];

  if (reduced) {
    return (
      <Comp id={id} className={className} style={style}>
        {children}
      </Comp>
    );
  }

  return (
    <Comp
      id={id}
      className={className}
      style={style}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: VIEWPORT_MARGIN }}
      transition={{ duration, delay, ease: EASE }}
    >
      {children}
    </Comp>
  );
}

/* ───────────────────────── Guruh (stagger) ───────────────────────── */

interface RevealGroupCtx {
  y: number;
  duration: number;
  reduced: boolean;
}
const GroupCtx = React.createContext<RevealGroupCtx | null>(null);

export interface RevealGroupProps {
  children?: React.ReactNode;
  /** Bolalar orasidagi kechikish, soniya (default 0.08) */
  stagger?: number;
  /** Birinchi boladan oldingi kechikish, soniya */
  delay?: number;
  /** Bolalar uchun boshlangʻich siljish (default 24) */
  y?: number;
  /** Har bir bola davomiyligi (default 0.6) */
  duration?: number;
  once?: boolean;
  className?: string;
  as?: RevealTag;
  style?: React.CSSProperties;
}

/**
 * Bolalarni (RevealItem) navbat bilan koʻrsatadi.
 *
 *   <RevealGroup stagger={0.08} className="grid gap-4">
 *     {items.map((i) => <RevealItem key={i.id}>…</RevealItem>)}
 *   </RevealGroup>
 */
export function RevealGroup({
  children,
  stagger = 0.08,
  delay = 0,
  y = 24,
  duration = 0.6,
  once = true,
  className,
  as = 'div',
  style,
}: RevealGroupProps) {
  const reduced = useReducedMotion();
  const Comp = TAGS[as];
  const ctx = React.useMemo<RevealGroupCtx>(() => ({ y, duration, reduced }), [y, duration, reduced]);

  const variants: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: stagger, delayChildren: delay } },
  };

  return (
    <GroupCtx.Provider value={ctx}>
      {reduced ? (
        <Comp className={className} style={style}>
          {children}
        </Comp>
      ) : (
        <Comp
          className={className}
          style={style}
          variants={variants}
          initial="hidden"
          whileInView="show"
          viewport={{ once, margin: VIEWPORT_MARGIN }}
        >
          {children}
        </Comp>
      )}
    </GroupCtx.Provider>
  );
}

export interface RevealItemProps {
  children?: React.ReactNode;
  className?: string;
  as?: RevealTag;
  style?: React.CSSProperties;
  /** Guruh sozlamasini shu element uchun bekor qilish */
  y?: number;
}

/** RevealGroup ichidagi bola — variantlar orqali navbat bilan koʻrinadi */
export function RevealItem({ children, className, as = 'div', style, y }: RevealItemProps) {
  const group = React.useContext(GroupCtx);
  const reducedSelf = useReducedMotion();
  const reduced = group ? group.reduced : reducedSelf;
  const Comp = TAGS[as];

  if (reduced) {
    return (
      <Comp className={className} style={style}>
        {children}
      </Comp>
    );
  }

  const offset = y ?? group?.y ?? 24;
  const duration = group?.duration ?? 0.6;
  const variants: Variants = {
    hidden: { opacity: 0, y: offset },
    show: { opacity: 1, y: 0, transition: { duration, ease: EASE } },
  };

  // Guruhsiz ishlatilsa — oddiy Reveal kabi
  if (!group) {
    return (
      <Comp
        className={className}
        style={style}
        variants={variants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: VIEWPORT_MARGIN }}
      >
        {children}
      </Comp>
    );
  }

  return (
    <Comp className={cn(className)} style={style} variants={variants}>
      {children}
    </Comp>
  );
}
