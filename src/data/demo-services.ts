import type { ServicePricing } from '@/lib/calc';

/**
 * Landing sahifasidagi interaktiv kalkulyator uchun 8 ta namunaviy LOR xizmati.
 * Narxlar demo klinika seed maʼlumotlari bilan bir xil mantiqda: butun ming soʻm,
 * bolalar < kattalar, dori bilan > dorisiz. Bu fayl client va server uchun xavfsiz (faqat maʼlumot).
 */

export type DemoServiceUnit = 'ta' | 'seans' | 'kun';
export type DemoCategoryKey = 'D' | 'N' | 'E' | 'T' | 'F';
export type DemoOrgan = 'EAR' | 'NOSE' | 'THROAT' | 'LARYNX' | 'OTHER';

export interface DemoService extends ServicePricing {
  code: string;
  name: string;
  nameRu: string;
  unit: DemoServiceUnit;
  category: DemoCategoryKey;
  organ: DemoOrgan;
  priceAdultNoMed: number;
  priceAdultMed: number;
  priceChildNoMed: number;
  priceChildMed: number;
}

export interface DemoCategory {
  key: DemoCategoryKey;
  name: string;
  nameRu: string;
}

export const DEMO_CATEGORIES: DemoCategory[] = [
  { key: 'D', name: 'Koʻrik va diagnostika', nameRu: 'Осмотр и диагностика' },
  { key: 'N', name: 'Burun muolajalari', nameRu: 'Процедуры носа' },
  { key: 'E', name: 'Quloq muolajalari', nameRu: 'Процедуры уха' },
  { key: 'T', name: 'Tomoq muolajalari', nameRu: 'Процедуры горла' },
  { key: 'F', name: 'Fizioterapiya', nameRu: 'Физиотерапия' },
];

export const DEMO_SERVICES: DemoService[] = [
  {
    code: 'N-001',
    name: 'Burun yuvish (kukushka / ANTK)',
    nameRu: 'Промывание носа («кукушка» / АНТК)',
    unit: 'seans',
    category: 'N',
    organ: 'NOSE',
    priceAdultNoMed: 120_000,
    priceAdultMed: 150_000,
    priceChildNoMed: 90_000,
    priceChildMed: 110_000,
    allowHalf: true,
    medicineOptional: true,
  },
  {
    code: 'D-001',
    name: 'Birlamchi koʻrik',
    nameRu: 'Первичный осмотр',
    unit: 'ta',
    category: 'D',
    organ: 'OTHER',
    priceAdultNoMed: 80_000,
    priceAdultMed: 100_000,
    priceChildNoMed: 60_000,
    priceChildMed: 80_000,
    allowHalf: false,
    medicineOptional: true,
  },
  {
    code: 'E-001',
    name: 'Quloq yuvish (sulfat tiqin)',
    nameRu: 'Промывание уха (серная пробка)',
    unit: 'ta',
    category: 'E',
    organ: 'EAR',
    priceAdultNoMed: 80_000,
    priceAdultMed: 100_000,
    priceChildNoMed: 60_000,
    priceChildMed: 80_000,
    allowHalf: true,
    medicineOptional: true,
  },
  {
    code: 'N-005',
    name: 'Burun shilliq qavatini anemizatsiya qilish',
    nameRu: 'Анемизация слизистой носа',
    unit: 'ta',
    category: 'N',
    organ: 'NOSE',
    priceAdultNoMed: 40_000,
    priceAdultMed: 60_000,
    priceChildNoMed: 30_000,
    priceChildMed: 50_000,
    allowHalf: true,
    medicineOptional: false,
  },
  {
    code: 'T-001',
    name: 'Bodomcha lakunalarini yuvish',
    nameRu: 'Промывание лакун миндалин',
    unit: 'seans',
    category: 'T',
    organ: 'THROAT',
    priceAdultNoMed: 80_000,
    priceAdultMed: 110_000,
    priceChildNoMed: 60_000,
    priceChildMed: 90_000,
    allowHalf: true,
    medicineOptional: true,
  },
  {
    code: 'F-002',
    name: 'Lazer terapiya',
    nameRu: 'Лазеротерапия',
    unit: 'seans',
    category: 'F',
    organ: 'OTHER',
    priceAdultNoMed: 50_000,
    priceAdultMed: 60_000,
    priceChildNoMed: 40_000,
    priceChildMed: 50_000,
    allowHalf: true,
    medicineOptional: true,
  },
  {
    code: 'D-005',
    name: 'Audiometriya',
    nameRu: 'Аудиометрия',
    unit: 'ta',
    category: 'D',
    organ: 'EAR',
    priceAdultNoMed: 120_000,
    priceAdultMed: 130_000,
    priceChildNoMed: 100_000,
    priceChildMed: 110_000,
    allowHalf: false,
    medicineOptional: true,
  },
  {
    code: 'E-003',
    name: 'Quloqqa dori tomizish / turunda',
    nameRu: 'Закапывание / турунда в ухо',
    unit: 'ta',
    category: 'E',
    organ: 'EAR',
    priceAdultNoMed: 30_000,
    priceAdultMed: 50_000,
    priceChildNoMed: 25_000,
    priceChildMed: 40_000,
    allowHalf: true,
    medicineOptional: false,
  },
];

export function findDemoService(code: string): DemoService | undefined {
  return DEMO_SERVICES.find((s) => s.code === code);
}

/** Kategoriya boʻyicha guruhlangan roʻyxat (Select uchun) */
export function groupDemoServices(): Array<{ category: DemoCategory; services: DemoService[] }> {
  return DEMO_CATEGORIES.map((category) => ({
    category,
    services: DEMO_SERVICES.filter((s) => s.category === category.key),
  })).filter((g) => g.services.length > 0);
}
