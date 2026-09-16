import type { Appointment, Patient, User, Visit } from '@prisma/client';
import type { Serialized } from '@/lib/visits/types';
import type { DaySchedule, WeeklySchedule } from '@/lib/settings/types';
import type { AppointmentStatusCode } from './schemas';
import type { ScheduleReason, SlotInfo } from './availability';

/**
 * Yozilish moduli DTO tiplari (API JSON shakli: Date → ISO string).
 * Client va server bir xil tipdan foydalanadi.
 */

export type AppointmentRowDTO = Serialized<Appointment>;

export type AppointmentPatientDTO = Serialized<
  Pick<Patient, 'id' | 'fullName' | 'cardNumber' | 'phone' | 'birthDate' | 'gender' | 'smsConsent'>
>;

export type AppointmentDoctorDTO = Pick<User, 'id' | 'fullName' | 'room' | 'color' | 'specialty'>;

export interface AppointmentDTO extends AppointmentRowDTO {
  patient: AppointmentPatientDTO;
  doctor: AppointmentDoctorDTO;
  createdBy: Pick<User, 'id' | 'fullName'> | null;
  visit: Pick<Visit, 'id' | 'status'> | null;
}

export interface AppointmentListDTO {
  items: AppointmentDTO[];
  from: string;
  to: string;
}

export interface SlotsDTO {
  doctorId: string;
  date: string;
  slotMinutes: number;
  durationMin: number;
  /** Shu kun jadvali (enabled=false — dam olish) */
  day: DaySchedule;
  slots: SlotInfo[];
}

/** Sahifaga serverdan uzatiladigan shifokor (ustun) */
export interface DoctorOption {
  id: string;
  fullName: string;
  room: string | null;
  color: string;
  specialty: string | null;
  schedule: WeeklySchedule;
}

/** Sahifaga serverdan uzatiladigan klinika sozlamalari */
export interface ClinicCalendarConfig {
  name: string;
  workStart: string;
  workEnd: string;
  slotMinutes: number;
  smsEnabled: boolean;
}

/** API xato `details.reason` qiymatlari — client i18n ga moslaydi (appointments.errors.*) */
export type AppointmentErrorReason =
  | 'OVERLAP'
  | ScheduleReason
  | 'PAST'
  | 'LOCKED'
  | 'STATUS'
  | 'TRANSITION'
  | 'DOCTOR'
  | 'PATIENT'
  | 'HAS_VISIT';

export interface AppointmentErrorDetails {
  reason: AppointmentErrorReason;
  conflictId?: string;
  conflictStartAt?: string;
  conflictEndAt?: string;
  from?: AppointmentStatusCode;
  to?: AppointmentStatusCode;
}

export function isAppointmentErrorDetails(v: unknown): v is AppointmentErrorDetails {
  return !!v && typeof v === 'object' && typeof (v as { reason?: unknown }).reason === 'string';
}

/** /api/patients/search javobidagi element (patients moduli) */
export interface PatientSearchItem {
  id: string;
  fullName: string;
  cardNumber: string;
  phone: string;
  birthDate: string;
  gender: 'MALE' | 'FEMALE';
}

/** /api/queue POST javobi (queue moduli) — bizga faqat raqam kerak */
export interface QueueTicketLite {
  id: string;
  number: string;
  prefix: string;
  seq: number;
}
