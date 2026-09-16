import { z } from 'zod';
import { zId, zMoney, zOptionalText, zPage, zText } from '@/lib/api/validate';

/**
 * Kassa moduli Zod sxemalari — client (formalar) va server (API) bir xil sxemadan foydalanadi.
 * Server importlari YOʻQ (client komponentlar bemalol import qiladi).
 */

export const PAY_METHODS = ['CASH', 'CARD', 'TRANSFER', 'CLICK', 'PAYME'] as const;
export const PayMethodSchema = z.enum(PAY_METHODS);
export type PayMethodCode = z.infer<typeof PayMethodSchema>;

export const UNPAID_SCOPES = ['today', 'all'] as const;
export const UnpaidScopeSchema = z.enum(UNPAID_SCOPES);
export type UnpaidScope = z.infer<typeof UnpaidScopeSchema>;

/** Musbat butun soʻm (0 dan katta) */
const zPositiveMoney = zMoney.pipe(z.number().int().positive('Summa noldan katta boʻlishi kerak'));

/** POST /api/payments */
export const CreatePaymentSchema = z.object({
  visitId: zId,
  amount: zPositiveMoney,
  method: PayMethodSchema,
  note: zOptionalText(300),
});
export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>;

/** Qaytarish (toʻliq shakl — paymentId bilan) */
export const RefundSchema = z.object({
  paymentId: zId,
  amount: zPositiveMoney,
  note: z.string().trim().min(1, 'Qaytarish sababi majburiy').max(300).pipe(zText(300)),
});
export type RefundInput = z.infer<typeof RefundSchema>;

/** POST /api/payments/[id]/refund — paymentId yoʻldan olinadi */
export const RefundBodySchema = RefundSchema.omit({ paymentId: true });
export type RefundBody = z.infer<typeof RefundBodySchema>;

/** POST /api/shifts/open */
export const OpenShiftSchema = z.object({
  openingCash: zMoney,
});
export type OpenShiftInput = z.infer<typeof OpenShiftSchema>;

/** POST /api/shifts/[id]/close */
export const CloseShiftSchema = z.object({
  closingCash: zMoney,
  note: zOptionalText(500),
});
export type CloseShiftInput = z.infer<typeof CloseShiftSchema>;

const zDateKey = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Sana YYYY-MM-DD shaklida boʻlishi kerak');

/** GET /api/payments?date=&visitId=&method=&page=&pageSize= */
export const ListPaymentsQuerySchema = z
  .object({
    date: zDateKey.optional(),
    visitId: zId.optional(),
    method: PayMethodSchema.optional(),
    /** Faqat qaytarishlar (manfiy qatorlar) */
    refunds: z.enum(['0', '1']).optional(),
  })
  .merge(zPage);
export type ListPaymentsQuery = z.infer<typeof ListPaymentsQuerySchema>;

/** GET /api/payments/unpaid?scope=&q=&limit= */
export const UnpaidQuerySchema = z.object({
  scope: UnpaidScopeSchema.default('today'),
  q: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
});
export type UnpaidQuery = z.infer<typeof UnpaidQuerySchema>;

/** GET /api/shifts?page=&pageSize= */
export const ListShiftsQuerySchema = zPage;
export type ListShiftsQuery = z.infer<typeof ListShiftsQuerySchema>;
