/**
 * Har bir modul oʻz lugʻatini `src/i18n/messages/<modul>.ts` da beradi:
 *
 *   export const patients = defineMessages({
 *     uz: { title: 'Bemorlar', ... },
 *     ru: { title: 'Пациенты', ... },
 *   });
 *
 * `ru` shakli `uz` bilan bir xil boʻlishi majburiy (Shape<T> orqali tekshiriladi).
 * Kalitlar nuqtali yoʻl bilan olinadi: t('patients.title'); parametrlar: t('x.y', { n: 5 }) → "{n}" almashtiriladi.
 */
export type Leaf = string;
export type Tree = { [key: string]: Leaf | Tree };

export type Shape<T> = {
  [K in keyof T]: T[K] extends string ? string : T[K] extends object ? Shape<T[K]> : never;
};

export interface MessageModule<T extends Tree> {
  uz: T;
  ru: Shape<T>;
}

export function defineMessages<T extends Tree>(m: { uz: T; ru: Shape<T> }): MessageModule<T> {
  return m;
}
