'use client';

import { useMediaQuery } from './use-media-query';

/**
 * Foydalanuvchi "harakatni kamaytirish" ni tanlaganmi (prefers-reduced-motion: reduce).
 * SSR da va birinchi renderda `false`.
 */
export function useReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}
