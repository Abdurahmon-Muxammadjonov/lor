import type { PayMethod, SalaryType } from '@prisma/client';

/**
 * Hisobotlar moduli — API JSON tiplari.
 * Pul — butun soʻm (number), sanalar — ISO string, davr kalitlari — "YYYY-MM-DD" (kun/hafta) yoki "YYYY-MM" (oy).
 */

export const REPORT_TABS = ['revenue', 'doctors', 'services', 'patient-types', 'medicine', 'shifts', 'debtors'] as const;
export type ReportTab = (typeof REPORT_TABS)[number];

export const REPORT_KINDS = [...REPORT_TABS, 'full'] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export const GROUP_BYS = ['day', 'week', 'month'] as const;
export type GroupBy = (typeof GROUP_BYS)[number];

export const PAY_METHODS: readonly PayMethod[] = ['CASH', 'CARD', 'TRANSFER', 'CLICK', 'PAYME'] as const;

/** "YYYY-MM-DD" (Asia/Tashkent kuni) */
export type DateKey = string;

export interface ReportRange {
  from: DateKey;
  to: DateKey;
}

export interface ReportFilters extends ReportRange {
  doctorId?: string | null;
}

export interface MethodAmountDTO {
  method: PayMethod;
  amount: number;
  /** Foiz (0..100), 2 kasr */
  share: number;
}

export interface SummaryCoreDTO {
  /** Toʻlovlar yigʻindisi (qaytarishlar manfiy) */
  revenue: number;
  /** Bekor qilinmagan qabullar soni */
  visits: number;
  /** Qabul qilingan noyob bemorlar */
  patients: number;
  /** Davrda roʻyxatga olingan yangi bemorlar */
  newPatients: number;
  /** Tushum / qabullar */
  avgCheck: number;
  /** Yakunlangan qabullar boʻyicha toʻlanmagan qoldiq */
  debt: number;
  /** Qabullardagi chegirmalar yigʻindisi */
  discount: number;
  /** Koʻrsatilgan xizmatlar summasi (Σ totalNet) */
  servicesTotal: number;
}

export interface SummaryDeltasDTO {
  revenue: number | null;
  visits: number | null;
  patients: number | null;
  avgCheck: number | null;
  debt: number | null;
}

export interface SummaryDTO extends SummaryCoreDTO {
  range: ReportRange;
  previousRange: ReportRange;
  previous: SummaryCoreDTO;
  /** Oldingi davrga nisbatan oʻzgarish (%), oldingi davr 0 boʻlsa null */
  deltas: SummaryDeltasDTO;
  byMethod: MethodAmountDTO[];
}

export interface PeriodDTO {
  /** Bucket kaliti: kun/hafta — "YYYY-MM-DD" (hafta — dushanba), oy — "YYYY-MM" */
  period: string;
  /** Davr boshlanishi ([from,to] ga qisqartirilgan) */
  start: DateKey;
  /** Davr oxiri ([from,to] ga qisqartirilgan) */
  end: DateKey;
}

export interface RevenuePeriodDTO extends PeriodDTO {
  revenue: number;
  visits: number;
  avgCheck: number;
  byMethod: MethodAmountDTO[];
}

export interface RevenueTotalsDTO {
  revenue: number;
  visits: number;
  avgCheck: number;
  byMethod: MethodAmountDTO[];
}

export interface RevenueReportDTO {
  groupBy: GroupBy;
  range: ReportRange;
  periods: RevenuePeriodDTO[];
  totals: RevenueTotalsDTO;
}

export interface DoctorRowDTO {
  doctorId: string;
  fullName: string;
  specialty: string | null;
  color: string;
  isActive: boolean;
  patients: number;
  visits: number;
  /** Shifokor qabullariga bogʻlangan toʻlovlar */
  revenue: number;
  /** Koʻrsatilgan xizmatlar summasi (Σ totalNet) */
  servicesTotal: number;
  avgCheck: number;
  /** Tushumdagi ulush (%) */
  share: number;
  salaryType: SalaryType;
  salaryValue: number;
  /** Hisoblangan maosh: PERCENT → tushum × foiz, FIXED → belgilangan summa */
  salary: number;
}

export interface DoctorsReportDTO {
  range: ReportRange;
  rows: DoctorRowDTO[];
  totals: { patients: number; visits: number; revenue: number; servicesTotal: number; avgCheck: number; salary: number };
}

export interface ServiceRowDTO {
  serviceId: string;
  code: string;
  name: string;
  nameRu: string;
  unit: string;
  category: { name: string; nameRu: string } | null;
  /** Σ quantity (0.5 qadam) */
  count: number;
  /** Qatorlar soni */
  lines: number;
  /** Σ lineTotal */
  revenue: number;
  gross: number;
  discount: number;
  share: number;
  adultCount: number;
  childCount: number;
  medCount: number;
  noMedCount: number;
}

export interface ServicesReportDTO {
  range: ReportRange;
  rows: ServiceRowDTO[];
  totals: { count: number; lines: number; revenue: number; gross: number; discount: number; adultCount: number; childCount: number; medCount: number };
}

export interface TypeStatDTO {
  visits: number;
  lines: number;
  revenue: number;
}

export interface TypeStatShareDTO extends TypeStatDTO {
  share: number;
}

export interface PatientTypesTrendDTO extends PeriodDTO {
  adult: TypeStatDTO;
  child: TypeStatDTO;
}

export interface PatientTypesReportDTO {
  groupBy: GroupBy;
  range: ReportRange;
  adult: TypeStatShareDTO;
  child: TypeStatShareDTO;
  total: TypeStatDTO;
  trend: PatientTypesTrendDTO[];
}

export interface MedStatDTO {
  lines: number;
  count: number;
  revenue: number;
}

export interface MedicineRowDTO {
  serviceId: string;
  code: string;
  name: string;
  nameRu: string;
  unit: string;
  medicineOptional: boolean;
  med: MedStatDTO;
  noMed: MedStatDTO;
  total: MedStatDTO;
  /** Dori bilan bajarilgan miqdor ulushi (%) */
  medShare: number;
}

export interface MedicineReportDTO {
  range: ReportRange;
  rows: MedicineRowDTO[];
  totals: { med: MedStatDTO; noMed: MedStatDTO; total: MedStatDTO; medShare: number };
}

export type ShiftStatus = 'OPEN' | 'CLOSED';

export interface ShiftRowDTO {
  id: string;
  cashier: { id: string; fullName: string };
  status: ShiftStatus;
  openedAt: string;
  closedAt: string | null;
  openingCash: number;
  closingCash: number | null;
  totals: Record<PayMethod, number>;
  /** Barcha usullar yigʻindisi */
  total: number;
  /** Kutilgan naqd = boshlangʻich naqd + naqd toʻlovlar */
  expectedCash: number;
  /** Haqiqiy − kutilgan (faqat yopiq smenalar) */
  difference: number | null;
  paymentsCount: number;
  note: string | null;
}

export interface ShiftsReportDTO {
  range: ReportRange;
  rows: ShiftRowDTO[];
  totals: { totals: Record<PayMethod, number>; total: number; difference: number; count: number; open: number };
}

export interface DebtorRowDTO {
  patient: { id: string; fullName: string; cardNumber: string; phone: string; smsConsent: boolean };
  /** Qarzli qabullar soni */
  visits: number;
  totalDebt: number;
  lastVisit: string;
  lastVisitId: string;
  /** Oxirgi yuborilgan (yoki navbatdagi) SMS vaqti */
  lastSmsAt: string | null;
}

export interface DebtorsReportDTO {
  range: ReportRange;
  /** true — davr eʼtiborga olinmagan (barcha vaqt) */
  allTime: boolean;
  rows: DebtorRowDTO[];
  total: number;
  count: number;
}

export interface FullReportDTO {
  summary: SummaryDTO;
  revenue: RevenueReportDTO;
  doctors: DoctorsReportDTO;
  services: ServicesReportDTO;
  patientTypes: PatientTypesReportDTO;
  medicine: MedicineReportDTO;
  shifts: ShiftsReportDTO;
  debtors: DebtorsReportDTO;
}

/** Eksport turi → maʼlumot tipi */
export interface ReportDataMap {
  revenue: RevenueReportDTO;
  doctors: DoctorsReportDTO;
  services: ServicesReportDTO;
  'patient-types': PatientTypesReportDTO;
  medicine: MedicineReportDTO;
  shifts: ShiftsReportDTO;
  debtors: DebtorsReportDTO;
  full: FullReportDTO;
}

export interface DebtReminderResultDTO {
  id: string;
  phone: string;
  text: string;
}

/** Shifokor filtri variantlari (GET /api/users?role=DOCTOR&active=1 — staff moduli) */
export interface DoctorOptionDTO {
  id: string;
  fullName: string;
  role: string;
  specialty?: string | null;
  room?: string | null;
  color?: string;
  isActive?: boolean;
}
