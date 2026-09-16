'use client';

import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { LOCALE_COOKIE, type Locale } from './config';
import { getMessages } from './messages';
import { makeT, type Params } from './t';

interface LocaleCtx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, params?: Params) => string;
}

const Ctx = createContext<LocaleCtx | null>(null);

export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const router = useRouter();
  const t = useMemo(() => makeT(getMessages(), locale), [locale]);
  const setLocale = useCallback(
    (l: Locale) => {
      document.cookie = `${LOCALE_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
      document.documentElement.lang = l === 'uz' ? 'uz-Latn' : 'ru';
      router.refresh();
    },
    [router],
  );
  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLocale(): LocaleCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useLocale must be used inside <LocaleProvider>');
  return ctx;
}

export function useT() {
  return useLocale().t;
}

/** Ikki tilli maydon (name / nameRu) dan joriy tilga mosini olish */
export function pickLang<T extends { name: string; nameRu?: string | null }>(obj: T, locale: Locale): string {
  return locale === 'ru' && obj.nameRu ? obj.nameRu : obj.name;
}
