'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export interface LocalStorageOptions<T> {
  serialize?: (value: T) => string;
  deserialize?: (raw: string) => T;
  /** Boshqa tablardagi oʻzgarishlarni kuzatish (default: true) */
  sync?: boolean;
}

type Setter<T> = (value: T | ((prev: T) => T)) => void;

/**
 * SSR-xavfsiz, tiplangan localStorage holati.
 * Serverda va birinchi renderda `initial` qaytadi; montajdan keyin saqlangan qiymat oʻqiladi
 * (gidratsiya nomuvofiqligi boʻlmaydi). `localStorage` mavjud boʻlmasa (private rejim) xotirada ishlaydi.
 *
 *   const [lang, setLang, removeLang] = useLocalStorage<'uz' | 'ru'>('lang', 'uz');
 */
export function useLocalStorage<T>(
  key: string,
  initial: T | (() => T),
  options: LocalStorageOptions<T> = {},
): [T, Setter<T>, () => void] {
  const { serialize = JSON.stringify, deserialize = JSON.parse as (raw: string) => T, sync = true } = options;

  const initialRef = useRef<T | null>(null);
  if (initialRef.current === null) {
    initialRef.current = typeof initial === 'function' ? (initial as () => T)() : initial;
  }

  const [value, setValue] = useState<T>(initialRef.current);
  const serializeRef = useRef(serialize);
  const deserializeRef = useRef(deserialize);
  serializeRef.current = serialize;
  deserializeRef.current = deserialize;

  const read = useCallback((): T | undefined => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw === null) return undefined;
      return deserializeRef.current(raw);
    } catch {
      return undefined;
    }
  }, [key]);

  // Montajdan keyin saqlangan qiymatni yuklash
  useEffect(() => {
    const stored = read();
    if (stored !== undefined) setValue(stored);
  }, [read]);

  // Boshqa tablar bilan sinxronlash
  useEffect(() => {
    if (!sync) return;
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea !== window.localStorage || e.key !== key) return;
      if (e.newValue === null) {
        setValue(initialRef.current as T);
        return;
      }
      try {
        setValue(deserializeRef.current(e.newValue));
      } catch {
        // buzilgan qiymat — eʼtiborsiz
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key, sync]);

  const set = useCallback<Setter<T>>(
    (next) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        try {
          window.localStorage.setItem(key, serializeRef.current(resolved));
        } catch {
          // kvota toʻlgan yoki private rejim — xotirada davom etamiz
        }
        return resolved;
      });
    },
    [key],
  );

  const remove = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // eʼtiborsiz
    }
    setValue(initialRef.current as T);
  }, [key]);

  return [value, set, remove];
}
