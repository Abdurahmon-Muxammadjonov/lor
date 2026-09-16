import type { Prisma, Visit, TreatmentLine, Payment, Patient, User, Service, Queue, Appointment } from '@prisma/client';

/**
 * Qabul (Visit) moduli uchun umumiy TS tiplar.
 *
 * API `ok(data)` javobi `serialize()` orqali oʻtadi:
 *   - Prisma.Decimal → butun number (soʻm)
 *   - Date → ISO string
 * `Serialized<T>` Prisma modelini aynan shu JSON shakliga keltiradi, shuning uchun
 * client va server bir xil tipdan foydalanadi.
 */

/** Prisma model → API JSON shakli (Decimal → number, Date → string, rekursiv) */
export type Serialized<T> = T extends Prisma.Decimal
  ? number
  : T extends Date
    ? string
    : T extends (infer U)[]
      ? Serialized<U>[]
      : T extends object
        ? { [K in keyof T]: Serialized<T[K]> }
        : T;

// ── Bazaviy qatorlar (relatsiyasiz) ──

/** Visit jadvali qatori (API JSON) */
export type VisitRowDTO = Serialized<Visit>;
/** TreatmentLine jadvali qatori (API JSON) — barcha snapshot maydonlar bilan */
export type TreatmentLineDTO = Serialized<TreatmentLine>;
/** Payment jadvali qatori (API JSON); `amount` manfiy = qaytarish */
export type PaymentDTO = Serialized<Payment>;

// ── Qabul bilan birga keladigan qisqa relatsiyalar ──

/** Qabul sahifasi uchun bemor haqida qisqa maʼlumot */
export type VisitPatientDTO = Serialized<
  Pick<Patient, 'id' | 'cardNumber' | 'fullName' | 'birthDate' | 'gender' | 'phone' | 'allergies' | 'chronic'>
>;

/** Qabul sahifasi uchun shifokor haqida qisqa maʼlumot */
export type VisitDoctorDTO = Serialized<Pick<User, 'id' | 'fullName' | 'specialty' | 'room' | 'color'>>;

/** Navbat talonining qisqa koʻrinishi */
export type VisitQueueDTO = Serialized<Pick<Queue, 'id' | 'number' | 'prefix' | 'seq' | 'status' | 'date'>>;

/** Yozilishning qisqa koʻrinishi */
export type VisitAppointmentDTO = Serialized<Pick<Appointment, 'id' | 'startAt' | 'endAt' | 'status'>>;

/** Kassir chekida koʻrsatiladigan toʻlov (kassir ismi bilan) */
export type PaymentWithCashierDTO = PaymentDTO & {
  cashier: Serialized<Pick<User, 'id' | 'fullName'>>;
};

/**
 * Qabulning toʻliq JSON shakli — `GET /api/visits/[id]` javobi.
 * Qatorlar va toʻlovlar har doim keladi; bemor/shifokor — qisqa shaklda.
 */
export type VisitDTO = VisitRowDTO & {
  lines: TreatmentLineDTO[];
  payments: PaymentDTO[];
  patient: VisitPatientDTO;
  doctor: VisitDoctorDTO;
  queue?: VisitQueueDTO | null;
  appointment?: VisitAppointmentDTO | null;
};

/** Roʻyxatlar uchun (bemor tarixi, shifokor kunlik roʻyxati) — qatorsiz, qisqa relatsiyalar bilan */
export type VisitListItemDTO = VisitRowDTO & {
  patient: Serialized<Pick<Patient, 'id' | 'cardNumber' | 'fullName' | 'phone'>>;
  doctor: Serialized<Pick<User, 'id' | 'fullName' | 'color'>>;
  linesCount: number;
};

/** Xizmat kartochkasi — muolaja kalkulyatorida tanlash uchun (narxlar number) */
export type ServiceOptionDTO = Serialized<
  Pick<
    Service,
    | 'id'
    | 'categoryId'
    | 'code'
    | 'name'
    | 'nameRu'
    | 'unit'
    | 'priceAdultNoMed'
    | 'priceAdultMed'
    | 'priceChildNoMed'
    | 'priceChildMed'
    | 'allowHalf'
    | 'medicineOptional'
    | 'durationMin'
    | 'defaultOrgan'
    | 'isActive'
    | 'order'
  >
>;

/**
 * `recalcVisit()` natijasining JSON shakli.
 * `balance` musbat = qarz, manfiy = ortiqcha toʻlov.
 */
export interface VisitTotalsDTO {
  totalGross: number;
  discount: number;
  totalNet: number;
  paidAmount: number;
  balance: number;
}

/** Qabul jamlarini DTO dan hisoblash (client uchun qulaylik) */
export function visitBalance(v: Pick<VisitRowDTO, 'totalNet' | 'paidAmount'>): number {
  return v.totalNet - v.paidAmount;
}

/** Qabul yopiq (COMPLETED/CANCELLED) — qator/toʻlov oʻzgartirib boʻlmaydi */
export function isVisitClosed(v: Pick<VisitRowDTO, 'status'>): boolean {
  return v.status !== 'OPEN';
}
