import type { AppointmentStatus, PayMethod, Plan, Role } from '@prisma/client';
import type { QueueSettings } from '@/lib/settings/types';

/** Bosh sahifa statistikasi davri (kun) */
export type StatsRange = 7 | 30 | 90;
export const STATS_RANGES: readonly StatsRange[] = [7, 30, 90] as const;

export interface TodayStatsDTO {
  /** Bugungi tushum (toʻlovlar yigʻindisi, qaytarishlar manfiy) — butun soʻm */
  revenue: number;
  revenueYesterday: number;
  /** Kechaga nisbatan oʻzgarish, % (1 kasr). Kecha 0 boʻlsa: bugun > 0 → 100, aks holda 0 */
  deltaPct: number;
  /** Bugungi qabullar (bekor qilinganlardan tashqari) */
  visits: number;
  visitsYesterday: number;
  visitsDeltaPct: number;
  /** Oʻrtacha chek: bugungi qabullar totalNet yigʻindisi / soni */
  avgCheck: number;
  /** Navbatda kutayotganlar (WAITING) — jonli */
  waiting: number;
}

export interface SeriesPointDTO {
  /** YYYY-MM-DD (Asia/Tashkent) */
  date: string;
  revenue: number;
  visits: number;
}

export interface ByMethodDTO {
  method: PayMethod;
  amount: number;
}

export interface TopServiceDTO {
  serviceId: string;
  serviceName: string;
  serviceNameRu: string;
  /** Qatorlar soni (necha marta bajarilgan) */
  count: number;
  revenue: number;
}

export interface DoctorStatDTO {
  id: string;
  fullName: string;
  color: string;
  /** Qabullar soni */
  patients: number;
  /** Qabullar totalNet yigʻindisi */
  revenue: number;
  avgCheck: number;
}

export interface DebtDTO {
  visitId: string;
  patientId: string;
  patientName: string;
  cardNumber: string;
  /** ISO sana (qabul yaratilgan vaqti) */
  date: string;
  balance: number;
}

export interface DashboardStatsDTO {
  range: StatsRange;
  /** Qoʻllangan shifokor filtri (DOCTOR uchun doim oʻzi) */
  doctorId: string | null;
  today: TodayStatsDTO;
  series: SeriesPointDTO[];
  byMethod: ByMethodDTO[];
  topServices: TopServiceDTO[];
  doctors: DoctorStatDTO[];
  debts: DebtDTO[];
  debtTotal: number;
  /** Server vaqti (ISO) */
  generatedAt: string;
}

export interface QueueCountDTO {
  waiting: number;
}

export interface TodayAppointmentDTO {
  id: string;
  startAt: string;
  endAt: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  doctorColor: string;
  status: AppointmentStatus;
}

export interface TodaySummaryDTO {
  revenue: number;
  visits: number;
  waiting: number;
  appointments: TodayAppointmentDTO[];
  generatedAt: string;
}

export interface MeUserDTO {
  id: string;
  login: string;
  email: string | null;
  fullName: string;
  role: Role;
  phone: string | null;
  specialty: string | null;
  room: string | null;
  color: string;
  clinicId: string;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface MeClinicDTO {
  id: string;
  name: string;
  slug: string;
  plan: Plan;
  phone: string;
  /** Faqat ADMIN / RECEPTION / SUPER_ADMIN uchun, boshqalarga null */
  kioskKey: string | null;
  settings: { queue: QueueSettings };
}

export interface MeDTO {
  user: MeUserDTO;
  clinic: MeClinicDTO;
}

export interface UpdateMeResultDTO {
  user: MeUserDTO;
  passwordChanged: boolean;
}

/** Bemor qidiruvi natijasi (patients moduli: GET /api/patients/search) */
export interface PatientSearchItemDTO {
  id: string;
  fullName: string;
  cardNumber: string;
  phone: string;
  birthDate: string;
  gender: 'MALE' | 'FEMALE';
}

/** Shifokorlar roʻyxati (staff moduli: GET /api/users?role=DOCTOR&active=1) */
export interface DoctorOptionDTO {
  id: string;
  fullName: string;
  role: Role;
  specialty: string | null;
  room: string | null;
  color: string;
  isActive: boolean;
}
