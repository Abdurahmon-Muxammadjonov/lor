import type { Clinic, ServiceCategory } from '@prisma/client';
import type {
  PaymentWithCashierDTO,
  Serialized,
  ServiceOptionDTO,
  TreatmentLineDTO,
  VisitDTO,
  VisitListItemDTO,
} from './types';

/**
 * Qabul moduli API javoblarining JSON shakllari (client va server uchun umumiy, server importlari YOʻQ).
 */

/** Qabul uchun kerakli klinika sozlamalari */
export type VisitClinicDTO = Serialized<Pick<Clinic, 'id' | 'childAgeLimit' | 'roundTo' | 'name'>>;

/** `GET /api/visits/[id]` — toʻliq qabul: bemor, shifokor, qatorlar, toʻlovlar (kassir bilan), navbat, yozilish, klinika */
export type VisitDetailDTO = Omit<VisitDTO, 'payments' | 'queue' | 'appointment'> & {
  payments: PaymentWithCashierDTO[];
  queue: NonNullable<VisitDTO['queue']> | null;
  appointment: NonNullable<VisitDTO['appointment']> | null;
  clinic: VisitClinicDTO;
};

/** Muolaja kalkulyatoridagi xizmat (kategoriya bilan) */
export type TreatmentServiceDTO = ServiceOptionDTO & {
  category: Serialized<Pick<ServiceCategory, 'id' | 'name' | 'nameRu' | 'icon' | 'order'>>;
};

/** `GET /api/visits` */
export interface VisitListResponse {
  items: VisitListItemDTO[];
  total: number;
  page: number;
  pageSize: number;
}

/** `GET /api/icd10` */
export interface Icd10Response {
  items: { code: string; uz: string; ru: string }[];
}

export type { TreatmentLineDTO, VisitListItemDTO, PaymentWithCashierDTO };
