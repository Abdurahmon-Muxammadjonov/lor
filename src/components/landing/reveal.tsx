'use client';

import {
  Reveal as BaseReveal,
  RevealGroup as BaseRevealGroup,
  RevealItem as BaseRevealItem,
  type RevealGroupProps,
  type RevealItemProps,
  type RevealProps,
} from '@/components/effects/reveal';
import { cn } from '@/lib/utils';

/**
 * Landing uchun Reveal oʻramlari. Effects dagi Reveal SSR da `opacity:0` bilan chiqadi va
 * prefers-reduced-motion yoqilgan brauzerda gidratsiyadan soʻng koʻrinmay qolishi mumkin —
 * `lp-reveal` klassi (marketing.css) reduced-motion da uni majburan koʻrsatadi.
 */
export function Reveal({ className, ...props }: RevealProps) {
  return <BaseReveal className={cn('lp-reveal', className)} {...props} />;
}

export function RevealGroup(props: RevealGroupProps) {
  return <BaseRevealGroup {...props} />;
}

export function RevealItem({ className, ...props }: RevealItemProps) {
  return <BaseRevealItem className={cn('lp-reveal', className)} {...props} />;
}
