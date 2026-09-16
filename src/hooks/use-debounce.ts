'use client';

import { useEffect, useState } from 'react';

/**
 * Qiymatni `ms` millisekund kechiktirib qaytaradi (qidiruv maydonlari uchun).
 *
 *   const debounced = useDebounce(search, 300);
 */
export function useDebounce<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);

  return debounced;
}
