import { create } from 'zustand';
import type { DiscountType, Organ, PatientType, Side } from '@prisma/client';

/**
 * Muolaja qoʻshish oynasining "qoralama" holati (zustand, saqlanmaydi).
 * Oyna qayta ochilganda oxirgi tanlovlar (bemor turi, dori, miqdor, chegirma turi, tomon) tiklanadi —
 * shifokor bir bemorga ketma-ket bir nechta muolaja qoʻshganda tezlik uchun.
 *
 * Qoralama `visitId` ga bogʻlangan: boshqa qabul ochilsa, standart qiymatlar ishlatiladi.
 */
export interface TreatmentDraft {
  visitId: string | null;
  serviceId: string | null;
  /** null = bemor yoshidan avtomatik aniqlanadi */
  patientType: PatientType | null;
  withMedicine: boolean;
  quantity: number;
  discountType: DiscountType;
  discountValue: number;
  side: Side | null;
  organ: Organ | null;
}

export interface TreatmentDraftState {
  draft: TreatmentDraft;
  setDraft: (patch: Partial<TreatmentDraft>) => void;
  /** Qabul uchun qoralamani olish — boshqa qabulniki boʻlsa `null` */
  draftFor: (visitId: string) => TreatmentDraft | null;
  reset: () => void;
}

export const EMPTY_DRAFT: TreatmentDraft = {
  visitId: null,
  serviceId: null,
  patientType: null,
  withMedicine: true,
  quantity: 1,
  discountType: 'NONE',
  discountValue: 0,
  side: null,
  organ: null,
};

export const useTreatmentDraft = create<TreatmentDraftState>()((set, get) => ({
  draft: EMPTY_DRAFT,
  setDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
  draftFor: (visitId) => {
    const d = get().draft;
    return d.visitId === visitId ? d : null;
  },
  reset: () => set({ draft: EMPTY_DRAFT }),
}));
