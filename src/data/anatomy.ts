import type { Organ, Side } from '@prisma/client';
import type { Locale } from '@/i18n/config';
import { normalizeSearch } from '@/lib/utils';

/**
 * LOR anatomik sohalar — <AnatomySelector/> (interaktiv SVG sxema) uchun maʼlumot.
 *
 * Sxema frontal (yuzdan) koʻrinishda: bemorning OʻNG tomoni tomoshabinning CHAP tomonida
 * (tibbiy standart). Koordinatalar `ANATOMY_VIEWBOX` (0 0 320 300) ichida.
 *
 * Har bir soha `organ` + `side` (+ `detail` sifatida nom) ni beradi — TreatmentLine ga yoziladi.
 */
export type AnatomyGroup = 'EAR' | 'NOSE' | 'THROAT';

export type AnatomyShape =
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  | { kind: 'path'; d: string };

export interface AnatomyRegion {
  id: string;
  group: AnatomyGroup;
  organ: Organ;
  side: Side | null;
  uz: string;
  ru: string;
  shape: AnatomyShape;
}

export const ANATOMY_VIEWBOX = '0 0 320 300';

/** Sohalar chizish tartibida (katta → kichik, kichiklari ustida turadi) */
export const ANATOMY_REGIONS: readonly AnatomyRegion[] = [
  // ── Quloq (bemorning oʻng qulogʻi — chapda) ──
  { id: 'ear_outer_R', group: 'EAR', organ: 'EAR', side: 'RIGHT', uz: 'Tashqi quloq (oʻng)', ru: 'Наружное ухо (правое)', shape: { kind: 'ellipse', cx: 46, cy: 120, rx: 24, ry: 36 } },
  { id: 'ear_middle_R', group: 'EAR', organ: 'EAR', side: 'RIGHT', uz: 'Oʻrta quloq (oʻng)', ru: 'Среднее ухо (правое)', shape: { kind: 'ellipse', cx: 46, cy: 120, rx: 14, ry: 22 } },
  { id: 'ear_inner_R', group: 'EAR', organ: 'EAR', side: 'RIGHT', uz: 'Ichki quloq (oʻng)', ru: 'Внутреннее ухо (правое)', shape: { kind: 'ellipse', cx: 46, cy: 120, rx: 6.5, ry: 6.5 } },
  // ── Quloq (bemorning chap qulogʻi — oʻngda) ──
  { id: 'ear_outer_L', group: 'EAR', organ: 'EAR', side: 'LEFT', uz: 'Tashqi quloq (chap)', ru: 'Наружное ухо (левое)', shape: { kind: 'ellipse', cx: 274, cy: 120, rx: 24, ry: 36 } },
  { id: 'ear_middle_L', group: 'EAR', organ: 'EAR', side: 'LEFT', uz: 'Oʻrta quloq (chap)', ru: 'Среднее ухо (левое)', shape: { kind: 'ellipse', cx: 274, cy: 120, rx: 14, ry: 22 } },
  { id: 'ear_inner_L', group: 'EAR', organ: 'EAR', side: 'LEFT', uz: 'Ichki quloq (chap)', ru: 'Внутреннее ухо (левое)', shape: { kind: 'ellipse', cx: 274, cy: 120, rx: 6.5, ry: 6.5 } },

  // ── Burun sinuslari ──
  { id: 'sinus_frontal_R', group: 'NOSE', organ: 'NOSE', side: 'RIGHT', uz: 'Frontal (peshona) sinus (oʻng)', ru: 'Лобная пазуха (правая)', shape: { kind: 'ellipse', cx: 132, cy: 68, rx: 20, ry: 11 } },
  { id: 'sinus_frontal_L', group: 'NOSE', organ: 'NOSE', side: 'LEFT', uz: 'Frontal (peshona) sinus (chap)', ru: 'Лобная пазуха (левая)', shape: { kind: 'ellipse', cx: 188, cy: 68, rx: 20, ry: 11 } },
  { id: 'sinus_ethmoid_R', group: 'NOSE', organ: 'NOSE', side: 'RIGHT', uz: 'Etmoid (gʻalvirsimon) sinus (oʻng)', ru: 'Решётчатая пазуха (правая)', shape: { kind: 'ellipse', cx: 146, cy: 106, rx: 8, ry: 10 } },
  { id: 'sinus_ethmoid_L', group: 'NOSE', organ: 'NOSE', side: 'LEFT', uz: 'Etmoid (gʻalvirsimon) sinus (chap)', ru: 'Решётчатая пазуха (левая)', shape: { kind: 'ellipse', cx: 174, cy: 106, rx: 8, ry: 10 } },
  { id: 'sinus_maxillary_R', group: 'NOSE', organ: 'NOSE', side: 'RIGHT', uz: 'Gaymor (yuqori jagʻ) sinusi (oʻng)', ru: 'Гайморова пазуха (правая)', shape: { kind: 'ellipse', cx: 120, cy: 150, rx: 20, ry: 17 } },
  { id: 'sinus_maxillary_L', group: 'NOSE', organ: 'NOSE', side: 'LEFT', uz: 'Gaymor (yuqori jagʻ) sinusi (chap)', ru: 'Гайморова пазуха (левая)', shape: { kind: 'ellipse', cx: 200, cy: 150, rx: 20, ry: 17 } },
  // ── Burun yoʻllari va toʻsiq ──
  { id: 'nose_passage_R', group: 'NOSE', organ: 'NOSE', side: 'RIGHT', uz: 'Oʻng burun yoʻli', ru: 'Правый носовой ход', shape: { kind: 'path', d: 'M154 120 C147 134 139 154 141 168 C142 177 154 177 154 169 Z' } },
  { id: 'nose_passage_L', group: 'NOSE', organ: 'NOSE', side: 'LEFT', uz: 'Chap burun yoʻli', ru: 'Левый носовой ход', shape: { kind: 'path', d: 'M166 120 C173 134 181 154 179 168 C178 177 166 177 166 169 Z' } },
  { id: 'nose_septum', group: 'NOSE', organ: 'NOSE', side: null, uz: 'Burun toʻsigʻi', ru: 'Носовая перегородка', shape: { kind: 'path', d: 'M157 112 L163 112 L164 172 L156 172 Z' } },

  // ── Tomoq (boʻyin kesimi) ──
  { id: 'pharynx', group: 'THROAT', organ: 'THROAT', side: null, uz: 'Halqum', ru: 'Глотка', shape: { kind: 'path', d: 'M140 222 h40 a4 4 0 0 1 4 4 v16 a4 4 0 0 1 -4 4 h-40 a4 4 0 0 1 -4 -4 v-16 a4 4 0 0 1 4 -4 z' } },
  { id: 'tonsil_R', group: 'THROAT', organ: 'THROAT', side: 'RIGHT', uz: 'Oʻng murtak (bodomcha)', ru: 'Правая миндалина', shape: { kind: 'ellipse', cx: 122, cy: 234, rx: 9, ry: 13 } },
  { id: 'tonsil_L', group: 'THROAT', organ: 'THROAT', side: 'LEFT', uz: 'Chap murtak (bodomcha)', ru: 'Левая миндалина', shape: { kind: 'ellipse', cx: 198, cy: 234, rx: 9, ry: 13 } },
  { id: 'larynx', group: 'THROAT', organ: 'LARYNX', side: null, uz: 'Hiqildoq', ru: 'Гортань', shape: { kind: 'path', d: 'M144 254 h32 a6 6 0 0 1 6 6 v18 a6 6 0 0 1 -6 6 h-32 a6 6 0 0 1 -6 -6 v-18 a6 6 0 0 1 6 -6 z' } },
  { id: 'vocal_cords', group: 'THROAT', organ: 'LARYNX', side: 'BOTH', uz: 'Ovoz boylamlari', ru: 'Голосовые связки', shape: { kind: 'ellipse', cx: 160, cy: 269, rx: 12, ry: 5 } },
];

/** Bezak (bosilmaydigan) chiziqlar: yuz, boʻyin, koʻz, burun, ogʻiz */
export const ANATOMY_DECOR = {
  face: 'M160 14 C209 14 248 60 248 118 C248 176 209 222 160 222 C111 222 72 176 72 118 C72 60 111 14 160 14 Z',
  neck: 'M118 214 L118 292 L202 292 L202 214',
  eyeRight: 'M114 100 Q128 90 142 100',
  eyeLeft: 'M178 100 Q192 90 206 100',
  nose: 'M160 104 C156 130 146 160 146 172 Q160 184 174 172 C174 160 164 130 160 104',
  mouth: 'M138 194 Q160 206 182 194',
} as const;

/** Guruh boʻyicha `Organ` (Segmented "organ" tanlovi uchun) */
export const GROUP_ORGAN: Record<AnatomyGroup, Organ> = { EAR: 'EAR', NOSE: 'NOSE', THROAT: 'THROAT' };

const BY_ID: ReadonlyMap<string, AnatomyRegion> = new Map(ANATOMY_REGIONS.map((r) => [r.id, r]));

export function findRegion(id: string | null | undefined): AnatomyRegion | undefined {
  return id ? BY_ID.get(id) : undefined;
}

export function regionLabel(region: AnatomyRegion, locale: Locale): string {
  return locale === 'ru' ? region.ru : region.uz;
}

/**
 * `TreatmentLine.detail` matnidan sohani topish (tahrirlashda avval tanlangan sohani yoritish uchun).
 * Ikkala tildagi nom bilan solishtiriladi.
 */
export function matchRegionByDetail(detail: string | null | undefined): AnatomyRegion | undefined {
  if (!detail) return undefined;
  const q = normalizeSearch(detail);
  if (!q) return undefined;
  return ANATOMY_REGIONS.find((r) => normalizeSearch(r.uz) === q || normalizeSearch(r.ru) === q);
}

/** Organ boʻyicha sohalar (masalan xizmatning `defaultOrgan` i uchun) */
export function regionsForOrgan(organ: Organ | null | undefined): AnatomyRegion[] {
  if (!organ) return [];
  return ANATOMY_REGIONS.filter((r) => r.organ === organ);
}
