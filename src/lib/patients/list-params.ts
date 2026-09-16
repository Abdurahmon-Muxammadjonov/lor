import type { PatientListParams } from './types';

/**
 * Roʻyxat holati ↔ URL soʻrov parametrlari. Server sahifasi `searchParams` ni shu yerda tahlil qiladi,
 * client esa holat oʻzgarganda URL ni `history.replaceState` bilan yangilaydi (ulashish mumkin boʻlgan havola).
 */

export type SearchParamsInput = Record<string, string | string[] | undefined>;

export const PATIENT_PAGE_SIZES = [10, 20, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 20;
export const DEFAULT_SORT: NonNullable<PatientListParams['sort']> = 'created';

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export function parseListSearchParams(sp: SearchParamsInput): PatientListParams {
  const q = (first(sp.q) ?? '').trim().slice(0, 120);
  const pageRaw = Number.parseInt(first(sp.page) ?? '', 10);
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? pageRaw : 1;
  const sizeRaw = Number.parseInt(first(sp.pageSize) ?? '', 10);
  const pageSize = (PATIENT_PAGE_SIZES as readonly number[]).includes(sizeRaw) ? sizeRaw : DEFAULT_PAGE_SIZE;
  const sortRaw = first(sp.sort);
  const sort =
    sortRaw === 'name' || sortRaw === 'created' || sortRaw === 'lastVisit' ? sortRaw : DEFAULT_SORT;
  const genderRaw = first(sp.gender);
  const gender = genderRaw === 'MALE' || genderRaw === 'FEMALE' ? genderRaw : undefined;
  const typeRaw = first(sp.type);
  const type = typeRaw === 'ADULT' || typeRaw === 'CHILD' ? typeRaw : undefined;
  const hasDebt = first(sp.hasDebt) === '1';
  return { q, page, pageSize, sort, gender, type, hasDebt };
}

/** Holat → URL satri ("?q=…"); standart qiymatlar yozilmaydi */
export function listParamsToSearch(p: PatientListParams): string {
  const sp = new URLSearchParams();
  if (p.q) sp.set('q', p.q);
  if (p.page > 1) sp.set('page', String(p.page));
  if (p.pageSize !== DEFAULT_PAGE_SIZE) sp.set('pageSize', String(p.pageSize));
  if (p.sort && p.sort !== DEFAULT_SORT) sp.set('sort', p.sort);
  if (p.gender) sp.set('gender', p.gender);
  if (p.type) sp.set('type', p.type);
  if (p.hasDebt) sp.set('hasDebt', '1');
  const s = sp.toString();
  return s ? `?${s}` : '';
}

/** Faol filtrlar soni (qidiruv va saralashdan tashqari) */
export function countActiveFilters(p: Pick<PatientListParams, 'gender' | 'type' | 'hasDebt'>): number {
  return (p.gender ? 1 : 0) + (p.type ? 1 : 0) + (p.hasDebt ? 1 : 0);
}
