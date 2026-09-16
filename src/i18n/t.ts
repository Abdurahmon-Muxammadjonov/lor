import type { Locale } from './config';
import type { Tree } from './types';

export type Params = Record<string, string | number>;

function lookup(tree: Tree, path: string): string | undefined {
  let cur: unknown = tree;
  for (const part of path.split('.')) {
    if (cur && typeof cur === 'object' && part in (cur as Tree)) cur = (cur as Tree)[part];
    else return undefined;
  }
  return typeof cur === 'string' ? cur : undefined;
}

export function interpolate(s: string, params?: Params): string {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (_, k: string) => (k in params ? String(params[k]) : `{${k}}`));
}

/** Tarjima funksiyasi yaratadi: topilmasa uz ga, u ham boʻlmasa kalitning oʻziga qaytadi */
export function makeT(messages: Record<Locale, Tree>, locale: Locale) {
  return (key: string, params?: Params): string => {
    const v = lookup(messages[locale], key) ?? lookup(messages.uz, key) ?? key;
    return interpolate(v, params);
  };
}

export type TFunction = ReturnType<typeof makeT>;

/** Oʻzbek/rus koʻplik: t('n.patients', {n}) oʻrniga oddiy yordamchi */
export function plural(locale: Locale, n: number, forms: { one: string; few?: string; many: string }): string {
  if (locale === 'ru') {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return forms.one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms.few ?? forms.many;
    return forms.many;
  }
  return forms.many; // oʻzbek tilida koʻplik shakli sonlardan keyin oʻzgarmaydi
}
