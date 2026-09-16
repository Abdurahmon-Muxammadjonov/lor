'use client';

import { useEffect, useState } from 'react';

/** Komponent brauzerda montaj boʻlganini bildiradi (gidratsiyadan keyin `true`). */
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return mounted;
}
