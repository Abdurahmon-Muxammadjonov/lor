import type { Appointment, Patient, Payment, TreatmentLine, User, Visit } from '@prisma/client';
import type { Serialized } from '@/lib/visits/types';
import type { PatientType } from '@/lib/calc';

/**
 * Bemorlar moduli API javob tiplari (JSON: Decimal → number, Date → ISO string).
 * Client va server bir xil tiplardan foydalanadi.
 */

/** Patient jadvali qatori (API JSON) */
export type PatientRowDTO = Serialized<Patient>;

/** Roʻyxat elementi — GET /api/patients */
export type PatientListItemDTO = PatientRowDTO & {
  age: number;
  patientType: PatientType;
  visitsCount: number;
  lastVisitAt: string | null;
  /** Σ(totalNet − paidAmount) bekor qilinmagan qabullar boʻyicha; musbat = qarz */
  debt: number;
};

/** Roʻyxat holati (URL ↔ soʻrov). `hasDebt` — faqat qarzdorlar */
export interface PatientListParams {
  q?: string;
  page: number;
  pageSize: number;
  sort?: 'name' | 'created' | 'lastVisit';
  dir?: 'asc' | 'desc';
  gender?: 'MALE' | 'FEMALE';
  type?: 'ADULT' | 'CHILD';
  hasDebt?: boolean;
}

export interface PatientListResponse {
  items: PatientListItemDTO[];
  total: number;
  page: number;
  pageSize: number;
}

/** Tez qidiruv elementi — GET /api/patients/search */
export type PatientSearchItemDTO = Serialized<
  Pick<Patient, 'id' | 'fullName' | 'cardNumber' | 'phone' | 'birthDate' | 'gender'>
>;

export interface PatientSearchResponse {
  items: PatientSearchItemDTO[];
}

export interface PatientStatsDTO {
  visits: number;
  openVisits: number;
  lastVisitAt: string | null;
  totalNet: number;
  totalPaid: number;
  debt: number;
}

export type PatientDoctorDTO = Serialized<Pick<User, 'id' | 'fullName' | 'color' | 'specialty' | 'room'>>;

/** Bemor kartasi — GET /api/patients/[id] */
export type PatientDTO = PatientRowDTO & {
  age: number;
  patientType: PatientType;
  stats: PatientStatsDTO;
  lastVisit: {
    id: string;
    createdAt: string;
    status: Visit['status'];
    diagnosis: string | null;
    doctor: PatientDoctorDTO;
  } | null;
};

/** Takroriy telefon ziddiyati — 409 CONFLICT `details` */
export interface DuplicatePhoneDetails {
  existingId: string;
  existingName: string;
  existingCard: string;
  phone: string;
}

export function isDuplicatePhoneDetails(v: unknown): v is DuplicatePhoneDetails {
  return (
    !!v &&
    typeof v === 'object' &&
    typeof (v as DuplicatePhoneDetails).existingId === 'string' &&
    typeof (v as DuplicatePhoneDetails).existingName === 'string'
  );
}

/** Tashriflar tarixi elementi — GET /api/patients/[id]/visits */
export type PatientVisitDTO = Serialized<Visit> & {
  doctor: PatientDoctorDTO;
  lines: Serialized<TreatmentLine>[];
  payments: {
    count: number;
    paid: number;
    lastAt: string | null;
    methods: Payment['method'][];
    receiptNos: string[];
  };
  /** totalNet − paidAmount (musbat = qarz) */
  balance: number;
};

export interface PatientVisitsResponse {
  items: PatientVisitDTO[];
  total: number;
  page: number;
  pageSize: number;
}

/** Toʻlov tarixi elementi — GET /api/patients/[id]/payments */
export type PatientPaymentDTO = Serialized<Payment> & {
  cashier: Serialized<Pick<User, 'id' | 'fullName'>>;
  visit: {
    id: string;
    createdAt: string;
    status: Visit['status'];
    doctor: Serialized<Pick<User, 'id' | 'fullName'>>;
  };
};

export interface PatientDebtItemDTO {
  visitId: string;
  createdAt: string;
  status: Visit['status'];
  doctor: Serialized<Pick<User, 'id' | 'fullName'>>;
  totalNet: number;
  paidAmount: number;
  balance: number;
}

export interface PatientPaymentsResponse {
  items: PatientPaymentDTO[];
  summary: {
    visits: number;
    totalNet: number;
    totalPaid: number;
    debt: number;
    debtVisits: number;
  };
  debts: PatientDebtItemDTO[];
}

/** Yozilish elementi — GET /api/patients/[id]/appointments */
export type PatientAppointmentDTO = Serialized<Appointment> & {
  doctor: PatientDoctorDTO;
  visitId: string | null;
};

export interface PatientAppointmentsResponse {
  upcoming: PatientAppointmentDTO[];
  past: PatientAppointmentDTO[];
}

/** Shifokor tanlash uchun (GET /api/users?role=DOCTOR&active=1 — staff moduli) */
export interface DoctorOptionDTO {
  id: string;
  fullName: string;
  role: string;
  specialty: string | null;
  room: string | null;
  color: string;
  isActive: boolean;
}

/** POST /api/visits javobi (visits moduli) — bizga faqat id kerak */
export interface CreatedVisitDTO {
  id: string;
}

/** POST /api/queue javobi (queue moduli) — bizga raqam kerak */
export interface CreatedQueueDTO {
  id: string;
  number: string;
  prefix: string;
  seq: number;
  type: string;
  status: string;
}
