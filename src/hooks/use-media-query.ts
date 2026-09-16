'use client';

import { useCallback, useSyncExternalStore } from 'react';

/**
 * SSR-xavfsiz media query. Serverda va birinchi gidratsiyada `false` qaytaradi.
 *
 *   const isWide = useMediaQuery('(min-width: 1024px)');
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    [query],
  );

  const getSnapshot = useCallback(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
    return window.matchMedia(query).matches;
  }, [query]);

  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export const MOBILE_BREAKPOINT = 768;

/** `< 768px` — mobil qurilma (ogʻir effektlar oʻchiriladi) */
export function useIsMobile(): boolean {
  return useMediaQuery(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
}

/** Sichqoncha/trackpad (aniq koʻrsatkich) — maxsus kursor faqat shunda */
export function useHasFinePointer(): boolean {
  return useMediaQuery('(pointer: fine)');
}
