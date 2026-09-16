export interface CategorySeed {
  /** Xizmat kodlari prefiksi (D, N, E, T, F, S, L) */
  key: string;
  name: string;
  nameRu: string;
  icon: string;
  order: number;
}

/** Demo klinika kategoriyalari (tartib boʻyicha) */
export const CATEGORIES: CategorySeed[] = [
  { key: 'D', name: 'Koʻrik va diagnostika', nameRu: 'Осмотр и диагностика', icon: 'stethoscope', order: 1 },
  { key: 'N', name: 'Burun muolajalari', nameRu: 'Процедуры носа', icon: 'wind', order: 2 },
  { key: 'E', name: 'Quloq muolajalari', nameRu: 'Процедуры уха', icon: 'ear', order: 3 },
  { key: 'T', name: 'Tomoq muolajalari', nameRu: 'Процедуры горла', icon: 'mic', order: 4 },
  { key: 'F', name: 'Fizioterapiya', nameRu: 'Физиотерапия', icon: 'zap', order: 5 },
  { key: 'S', name: 'Kichik operatsiyalar', nameRu: 'Малые операции', icon: 'scissors', order: 6 },
  { key: 'L', name: 'Analizlar', nameRu: 'Анализы', icon: 'flask-conical', order: 7 },
];

/** LOR Plus Medical kategoriyalari (qisqaroq roʻyxat) */
export const LOR_PLUS_CATEGORIES: CategorySeed[] = [
  { key: 'D', name: 'Koʻrik va diagnostika', nameRu: 'Осмотр и диагностика', icon: 'stethoscope', order: 1 },
  { key: 'P', name: 'Muolajalar', nameRu: 'Процедуры', icon: 'syringe', order: 2 },
  { key: 'F', name: 'Fizioterapiya', nameRu: 'Физиотерапия', icon: 'zap', order: 3 },
];
