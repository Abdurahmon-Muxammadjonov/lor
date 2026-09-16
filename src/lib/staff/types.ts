import type { WeeklySchedule } from '@/lib/settings/types';

/**
 * Xodimlar moduli — API JSON tiplari (client va server bir xil tipdan foydalanadi).
 * Parol xeshi hech qachon DTO ga tushmaydi. Pul — butun number (soʻm), foiz — butun number (%).
 */

/** Klinika ichida yaratiladigan rollar (SUPER_ADMIN bu yerda yaratilmaydi) */
export const CLINIC_ROLE_VALUES = ['ADMIN', 'DOCTOR', 'RECEPTION', 'CASHIER'] as const;
export type ClinicRole = (typeof CLINIC_ROLE_VALUES)[number];

export const SALARY_TYPE_VALUES = ['PERCENT', 'FIXED'] as const;
export type SalaryTypeValue = (typeof SALARY_TYPE_VALUES)[number];

/** Xodim kartochkasi — `GET /api/users` va `GET /api/users/[id]` javobi */
export interface StaffUserDTO {
  id: string;
  clinicId: string;
  login: string;
  email: string | null;
  fullName: string;
  role: ClinicRole;
  phone: string | null;
  specialty: string | null;
  room: string | null;
  color: string;
  salaryType: SalaryTypeValue;
  /** PERCENT → foiz (0–100), FIXED → oylik soʻm */
  salaryValue: number;
  schedule: WeeklySchedule;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StaffListDTO {
  items: StaffUserDTO[];
  total: number;
}

/** Bir kunlik ish haqi boʻlagi */
export interface SalaryDayDTO {
  /** YYYY-MM-DD (Asia/Tashkent) */
  date: string;
  visits: number;
  patients: number;
  revenue: number;
  /** PERCENT uchun hisoblangan; FIXED uchun null (oylik kunlarga boʻlinmaydi) */
  salary: number | null;
}

/** Xizmat boʻyicha boʻlak (snapshot nomlari bilan) */
export interface SalaryServiceDTO {
  code: string;
  name: string;
  nameRu: string;
  /** Qatorlar soni */
  count: number;
  /** Miqdorlar yigʻindisi (0.5 qadam) */
  quantity: number;
  revenue: number;
}

export interface SalaryDoctorDTO {
  doctor: {
    id: string;
    fullName: string;
    specialty: string | null;
    room: string | null;
    color: string;
    isActive: boolean;
  };
  salaryType: SalaryTypeValue;
  salaryValue: number;
  visits: number;
  patients: number;
  revenue: number;
  salary: number;
  days: SalaryDayDTO[];
  services: SalaryServiceDTO[];
}

export interface SalaryTotalsDTO {
  visits: number;
  patients: number;
  revenue: number;
  salary: number;
}

/** `GET /api/users/salary?month=` javobi */
export interface SalaryReportDTO {
  /** YYYY-MM */
  month: string;
  /** ISO — oy boshi (Toshkent) */
  from: string;
  /** ISO — keyingi oy boshi (exclusive) */
  to: string;
  doctors: SalaryDoctorDTO[];
  totals: SalaryTotalsDTO;
}
