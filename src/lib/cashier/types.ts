import type {
  CashShift,
  Patient,
  Payment,
  PayMethod,
  TreatmentLine,
  User,
  Visit,
  VisitStatus,
} from '@prisma/client';
import type { Serialized, VisitTotalsDTO } from '@/lib/visits/types';
import type { ReceiptData } from '@/lib/printer/types';
import type { UnpaidScope } from './schemas';

/**
 * Kassa moduli API JSON shakllari (client va server uchun umumiy, server importlari YOʻQ).
 * Pul — butun number (soʻm), sanalar — ISO string (`serialize()` natijasi).
 */

/** Toʻlov usuli boʻyicha jamlar (qaytarishlar ayirilgan sof summa) */
export type MethodTotals = Record<PayMethod, number>;

export interface ShiftTotalsDTO {
  byMethod: MethodTotals;
  /** Barcha usullar boʻyicha sof summa (toʻlovlar − qaytarishlar) */
  total: number;
  /** Musbat toʻlovlar soni */
  paymentsCount: number;
  refundsCount: number;
  /** Qaytarishlar summasi (musbat son) */
  refundsTotal: number;
  /** openingCash + byMethod.CASH */
  expectedCash: number;
}

export type ShiftRowDTO = Serialized<CashShift>;

export type ShiftCashierDTO = Serialized<Pick<User, 'id' | 'fullName' | 'role'>>;

export type ShiftDTO = ShiftRowDTO & {
  cashier: ShiftCashierDTO;
  totals: ShiftTotalsDTO;
  /** closingCash − expectedCash (faqat yopilgan smena), musbat = ortiqcha, manfiy = kamomad */
  difference: number | null;
};

/** GET /api/shifts/current */
export interface CurrentShiftResponse {
  shift: ShiftDTO | null;
  /** Smena joriy foydalanuvchiniki */
  isMine: boolean;
  /** Joriy foydalanuvchi shu smenaga toʻlov qabul qila oladi (oʻziniki yoki ADMIN) */
  canOperate: boolean;
}

/** GET /api/shifts */
export interface ShiftListResponse {
  items: ShiftDTO[];
  total: number;
  page: number;
  pageSize: number;
}

export type PaymentRowDTO = Serialized<Payment>;

export type PaymentCashierDTO = Serialized<Pick<User, 'id' | 'fullName'>>;

export type PaymentPatientDTO = Serialized<Pick<Patient, 'id' | 'fullName' | 'cardNumber' | 'phone'>>;

export type PaymentVisitDTO = Serialized<
  Pick<Visit, 'id' | 'status' | 'totalNet' | 'paidAmount' | 'createdAt'>
> & {
  patient: PaymentPatientDTO;
  doctor: Serialized<Pick<User, 'id' | 'fullName'>>;
};

/** GET /api/payments qatori */
export type PaymentListItemDTO = PaymentRowDTO & {
  cashier: PaymentCashierDTO;
  visit: PaymentVisitDTO;
};

export interface PaymentListSummary {
  byMethod: MethodTotals;
  total: number;
  paymentsCount: number;
  refundsCount: number;
  refundsTotal: number;
}

/** GET /api/payments */
export interface PaymentListResponse {
  items: PaymentListItemDTO[];
  total: number;
  page: number;
  pageSize: number;
  summary: PaymentListSummary;
}

/** Smena tafsiloti — toʻlovlar bilan */
export type ShiftPaymentDTO = PaymentRowDTO & {
  cashier: PaymentCashierDTO;
  visit: Serialized<Pick<Visit, 'id' | 'status'>> & {
    patient: Serialized<Pick<Patient, 'id' | 'fullName' | 'cardNumber'>>;
  };
};

/** GET /api/shifts/[id] */
export type ShiftDetailDTO = ShiftDTO & { payments: ShiftPaymentDTO[] };

/** POST /api/shifts/[id]/close */
export interface CloseShiftResultDTO {
  shift: ShiftDTO;
  expectedCash: number;
  difference: number;
}

/** GET /api/payments/unpaid qatori */
export interface UnpaidVisitDTO {
  id: string;
  status: VisitStatus;
  createdAt: string;
  completedAt: string | null;
  totalGross: number;
  discount: number;
  totalNet: number;
  paidAmount: number;
  /** totalNet − paidAmount (> 0) */
  balance: number;
  linesCount: number;
  patient: Serialized<Pick<Patient, 'id' | 'fullName' | 'cardNumber' | 'phone' | 'gender'>>;
  doctor: Serialized<Pick<User, 'id' | 'fullName' | 'color' | 'room'>>;
}

/** GET /api/payments/unpaid */
export interface UnpaidListResponse {
  items: UnpaidVisitDTO[];
  total: number;
  scope: UnpaidScope;
}

export type CashierLineDTO = Serialized<
  Pick<
    TreatmentLine,
    | 'id'
    | 'serviceName'
    | 'serviceNameRu'
    | 'unit'
    | 'quantity'
    | 'unitPrice'
    | 'grossTotal'
    | 'discountTotal'
    | 'lineTotal'
    | 'side'
    | 'organ'
    | 'detail'
    | 'patientType'
    | 'withMedicine'
    | 'order'
  >
>;

export type CashierVisitPaymentDTO = PaymentRowDTO & { cashier: PaymentCashierDTO };

/** GET /api/payments/visit/[visitId] — toʻlov oynasi uchun qabul xulosasi */
export interface CashierVisitDTO {
  id: string;
  status: VisitStatus;
  createdAt: string;
  completedAt: string | null;
  globalDiscountType: Visit['globalDiscountType'];
  globalDiscountValue: number;
  patient: Serialized<Pick<Patient, 'id' | 'fullName' | 'cardNumber' | 'phone' | 'birthDate' | 'gender'>>;
  doctor: Serialized<Pick<User, 'id' | 'fullName' | 'specialty' | 'room' | 'color'>>;
  lines: CashierLineDTO[];
  payments: CashierVisitPaymentDTO[];
  totals: VisitTotalsDTO;
}

/**
 * Chek koʻrinishi uchun kengaytirilgan maʼlumot: printer kutubxonasi `ReceiptData` ni oʻqiydi,
 * HTML chek esa qoʻshimcha maydonlarni (ushbu toʻlov summasi va usuli) ham koʻrsatadi.
 */
export type ReceiptViewData = ReceiptData & {
  /** Ushbu chekdagi toʻlov summasi (qaytarishda manfiy) */
  paymentAmount?: number;
  method?: PayMethod;
  visitId?: string;
};

/** POST /api/payments */
export interface PaymentResultDTO {
  payment: PaymentRowDTO & { cashier: PaymentCashierDTO };
  totals: VisitTotalsDTO;
  receipt: ReceiptViewData;
  visit: { id: string; status: VisitStatus };
}

/** POST /api/payments/[id]/refund */
export interface RefundResultDTO {
  refund: PaymentRowDTO & { cashier: PaymentCashierDTO };
  totals: VisitTotalsDTO;
  receipt: ReceiptViewData;
  original: { id: string; receiptNo: string | null; amount: number };
}

/** Qabulning toʻlov holati (StatusBadge kind="payment") */
export type PaymentStatusCode = 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERPAID';

/** OVERPAY va boshqa validatsiya xatolarining `details` shakli */
export interface CashierErrorDetails {
  code: 'OVERPAY' | 'REFUND_EXCEEDS' | 'NOTHING_TO_PAY';
  balance?: number;
  amount?: number;
  max?: number;
}
