import type { Patient, Queue, QueueStatus, QueueType, User, Visit } from '@prisma/client';
import type { Serialized } from '@/lib/visits/types';
import type { TicketData } from '@/lib/printer/types';
import type { PrinterSettings, QueueSettings } from '@/lib/settings/types';

/**
 * Navbat moduli tiplari (API JSON shakli — `serialize()` dan keyin: Date → ISO string).
 * Client va server bir xil tiplardan foydalanadi.
 */

export const QUEUE_TYPES = ['DOCTOR', 'RECHECK', 'LAB', 'CASHIER'] as const satisfies readonly QueueType[];
export const QUEUE_STATUSES = ['WAITING', 'CALLED', 'SERVING', 'DONE', 'SKIPPED'] as const satisfies readonly QueueStatus[];

/** Holat oʻzgartirish amallari: POST /api/queue/[id]/<action> */
export type QueueAction = 'call' | 'serve' | 'done' | 'skip' | 'recall';
export const QUEUE_ACTIONS = ['call', 'serve', 'done', 'skip', 'recall'] as const satisfies readonly QueueAction[];

export type QueuePatientDTO = Serialized<Pick<Patient, 'id' | 'fullName' | 'cardNumber' | 'phone' | 'gender' | 'birthDate'>>;
export type QueueDoctorDTO = Serialized<Pick<User, 'id' | 'fullName' | 'room' | 'color' | 'specialty'>>;
export type QueueVisitDTO = Serialized<Pick<Visit, 'id' | 'status'>>;

/** Talon qatori (relatsiyalar bilan) — taxta, dialoglar, chop etish */
export type QueueRowDTO = Serialized<Queue> & {
  patient: QueuePatientDTO | null;
  doctor: QueueDoctorDTO | null;
  visit: QueueVisitDTO | null;
};

export interface QueueTypeStatDTO {
  waiting: number;
  active: number;
  done: number;
  total: number;
}

export interface QueueStatsDTO {
  waiting: number;
  called: number;
  serving: number;
  done: number;
  skipped: number;
  total: number;
  /** Chaqirilgunga qadar oʻrtacha kutish (daqiqa), maʼlumot boʻlmasa null */
  avgWaitMin: number | null;
  /** Qabul boshlanganidan yakungacha oʻrtacha (daqiqa) */
  avgServiceMin: number | null;
  byType: Record<QueueType, QueueTypeStatDTO>;
}

/** GET /api/queue?date= javobi */
export interface QueueBoardDTO {
  dateKey: string;
  waiting: QueueRowDTO[];
  called: QueueRowDTO[];
  serving: QueueRowDTO[];
  done: QueueRowDTO[];
  skipped: QueueRowDTO[];
  stats: QueueStatsDTO;
  now: string;
}

/** POST /api/queue va POST /api/kiosk/ticket javobi (qator maydonlari yuqori darajada — boshqa modullar `number` ni oʻqiydi) */
export type CreatedTicketDTO = QueueRowDTO & {
  ahead: number;
  waitMin: number;
  ticketData: TicketData;
};

/** POST /api/kiosk/ticket javobi */
export interface KioskTicketResultDTO {
  ticket: CreatedTicketDTO;
  ticketData: TicketData;
  showSeconds: number;
}

/** POST /api/queue/[id]/print, GET /api/queue/[id] javobi */
export interface TicketWithDataDTO {
  ticket: QueueRowDTO;
  ticketData: TicketData;
}

/** POST /api/queue/next javobi */
export interface NextTicketResultDTO {
  ticket: QueueRowDTO | null;
}

/** POST /api/queue/[id]/visit javobi */
export interface VisitFromTicketResultDTO {
  visitId: string;
  ticket: QueueRowDTO;
  /** Qabul avvaldan mavjud edi (idempotent) */
  existing: boolean;
}

export interface DisplayCalledDTO {
  id: string;
  number: string;
  type: QueueType;
  status: 'CALLED' | 'SERVING';
  room: string | null;
  doctorName: string | null;
  calledAt: string | null;
}

/** GET /api/display/state?key= javobi */
export interface DisplayStateDTO {
  clinicName: string;
  clinicPhone: string;
  /** Oxirgi 5 ta CALLED/SERVING (eng yangisi birinchi) */
  called: DisplayCalledDTO[];
  /** Eng soʻnggi chaqirilgan (CALLED) — katta panel uchun */
  current: DisplayCalledDTO | null;
  waitingCount: number;
  waitingByType: Record<QueueType, number>;
  now: string;
}

/** Kiosk sahifasiga serverdan uzatiladigan sozlamalar (maxfiy maydonlarsiz) */
export interface KioskConfig {
  key: string;
  clinicName: string;
  clinicPhone: string;
  ticketFooter: string;
  queue: QueueSettings;
  /** Printer sozlamalari — `host`/`port` yashirilgan (tarmoq printeri server orqali ishlaydi) */
  printer: PrinterSettings;
}

/** TV tablo sahifasiga uzatiladigan sozlamalar */
export interface DisplayConfig {
  key: string;
  /** Supabase Realtime filtri uchun */
  clinicId: string;
  clinicName: string;
  clinicPhone: string;
  displaySound: boolean;
  displayVoice: boolean;
  initial: DisplayStateDTO;
}

/** Sessiyadagi foydalanuvchi (taxta uchun kerakli qismi) */
export interface QueueViewer {
  id: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'DOCTOR' | 'RECEPTION' | 'CASHIER';
  fullName: string;
  room: string | null;
}
