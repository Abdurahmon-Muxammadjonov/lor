import type { Service, ServiceCategory } from '@prisma/client';
import type { Serialized } from '@/lib/visits/types';
import type { PriceField } from './schemas';

/**
 * Xizmatlar moduli DTO lari — API JSON shakli (Decimal → butun number, Date → ISO string).
 */

/** Kategoriya (API JSON) + xizmatlar soni */
export type CategoryDTO = Serialized<ServiceCategory> & {
  /** Barcha xizmatlar (nofaollar bilan) */
  servicesCount: number;
  /** Faol xizmatlar */
  activeCount: number;
};

export type CategoryShortDTO = Serialized<Pick<ServiceCategory, 'id' | 'name' | 'nameRu' | 'icon' | 'order'>>;

/** Xizmat (API JSON) — narxlar butun number, kategoriya qisqa shaklda */
export type ServiceDTO = Serialized<Service> & {
  category: CategoryShortDTO;
  /** Qabullarda ishlatilgan qatorlar soni (0 boʻlsa oʻchirish mumkin) */
  linesCount: number;
};

export interface ServicesListDTO {
  items: ServiceDTO[];
}

export interface CategoriesListDTO {
  items: CategoryDTO[];
}

/** Ommaviy oʻzgartirish — bitta xizmat uchun natija (oldingi → yangi) */
export interface BulkPreviewRow {
  id: string;
  code: string;
  name: string;
  nameRu: string;
  categoryId: string;
  changes: { field: PriceField; from: number; to: number }[];
}

export interface BulkResultDTO {
  /** true — DB ga yozilmadi (faqat hisob) */
  preview: boolean;
  /** Qamrovdagi xizmatlar soni */
  total: number;
  /** Narxi haqiqatan oʻzgargan (yoki oʻzgaradigan) xizmatlar soni */
  updated: number;
  rows: BulkPreviewRow[];
}

export interface ReorderResultDTO {
  updated: number;
}

/** Narx tarixi elementi (AuditLog dan) */
export interface ServiceHistoryItemDTO {
  id: string;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  createdAt: string;
  user: { id: string; fullName: string } | null;
}

export interface ServiceHistoryDTO {
  items: ServiceHistoryItemDTO[];
}

export interface DeleteResultDTO {
  deleted: true;
  id: string;
}
