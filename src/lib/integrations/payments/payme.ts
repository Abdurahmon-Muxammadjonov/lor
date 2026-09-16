import { IntegrationError } from '../errors';
import { createOnlinePayment, findPayableVisit, loadProviderState, loadProviderStates, saveProviderState } from './common';
import {
  PAYME_ERROR,
  PAYME_REASON,
  PAYME_STATE,
  PAYME_TRANSACTION_TIMEOUT_MS,
  PaymeError,
  checkPaymeAuth,
  parsePaymeRequest,
  paymeAccountVisitId,
  paymeCheckoutUrl,
  paymeErrorResponse,
  paymeParamNumber,
  paymeParamString,
  paymeResult,
  tiyinToSum,
  type PaymeRpcRequest,
  type PaymeRpcResponse,
  type PaymeState,
} from './payme-protocol';
import { appBaseUrl, paymeConfigFromEnv, type InvoiceResult, type PaymeConfig, type PaymentProvider, type WebhookVerifyResult } from './types';

export * from './payme-protocol';

/**
 * Payme Merchant API (FAQAT SERVER).
 *
 * Tranzaksiya holati AuditLog da: entity 'PaymeTransaction', entityId = Payme `id`, after = PaymeTxState
 * (append-only; oxirgi yozuv = joriy holat). account.visit_id = Visit.id.
 * PerformTransaction → Payment {method: PAYME} + recalcVisit; CancelTransaction (state 2) → qaytarish (manfiy Payment) + state -2.
 */

export const PAYME_ENTITY = 'PaymeTransaction';

export interface PaymeTxState {
  /** Payme tranzaksiya id si */
  id: string;
  /** Payme `time` (ms) */
  time: number;
  /** tiyin */
  amount: number;
  /** butun soʻm */
  amountSum: number;
  account: { visit_id: string };
  state: PaymeState;
  reason: number | null;
  createTime: number;
  performTime: number;
  cancelTime: number;
  clinicId: string;
  paymentId: string | null;
  refundPaymentId: string | null;
}

export interface PaymeHandlerOptions {
  config?: PaymeConfig | null;
  authorization?: string | null;
  ip?: string | null;
  now?: () => number;
}

function txView(s: PaymeTxState) {
  return {
    create_time: s.createTime,
    perform_time: s.performTime,
    cancel_time: s.cancelTime,
    transaction: s.id,
    state: s.state,
    reason: s.reason,
  };
}

/** JSON-RPC tanani bajarish: javob doim HTTP 200 (Payme protokoli) */
export async function handlePaymeRequest(body: unknown, opts: PaymeHandlerOptions = {}): Promise<PaymeRpcResponse> {
  const config = opts.config === undefined ? paymeConfigFromEnv() : opts.config;
  const req = parsePaymeRequest(body);
  const id = req?.id ?? null;
  if (!config) return paymeErrorResponse(id, PAYME_ERROR.INSUFFICIENT_PRIVILEGE, 'Payme is not configured');
  if (!checkPaymeAuth(opts.authorization, [config.key, config.testKey])) return paymeErrorResponse(id, PAYME_ERROR.INSUFFICIENT_PRIVILEGE);
  if (!req) return paymeErrorResponse(id, PAYME_ERROR.INVALID_REQUEST);

  const now = opts.now ?? (() => Date.now());
  try {
    switch (req.method) {
      case 'CheckPerformTransaction':
        return paymeResult(req.id, await checkPerform(req));
      case 'CreateTransaction':
        return paymeResult(req.id, await createTransaction(req, now, opts.ip));
      case 'PerformTransaction':
        return paymeResult(req.id, await performTransaction(req, now, opts.ip));
      case 'CancelTransaction':
        return paymeResult(req.id, await cancelTransaction(req, now, opts.ip));
      case 'CheckTransaction':
        return paymeResult(req.id, await checkTransaction(req));
      case 'GetStatement':
        return paymeResult(req.id, await getStatement(req));
      default:
        return paymeErrorResponse(req.id, PAYME_ERROR.METHOD_NOT_FOUND, req.method);
    }
  } catch (e) {
    if (e instanceof PaymeError) return paymeErrorResponse(req.id, e.code, e.data);
    return paymeErrorResponse(req.id, PAYME_ERROR.INTERNAL, e instanceof Error ? e.message : undefined);
  }
}

async function validateAccountAndAmount(params: Record<string, unknown>) {
  const visitId = paymeAccountVisitId(params);
  if (!visitId) throw new PaymeError(PAYME_ERROR.ACCOUNT_NOT_FOUND, 'account.visit_id is required');
  const visit = await findPayableVisit(visitId);
  if (!visit) throw new PaymeError(PAYME_ERROR.ACCOUNT_NOT_FOUND);
  if (visit.status === 'CANCELLED') throw new PaymeError(PAYME_ERROR.ACCOUNT_CANCELLED);
  if (visit.balance <= 0) throw new PaymeError(PAYME_ERROR.ACCOUNT_ALREADY_PAID);
  const amountSum = tiyinToSum(params.amount);
  if (amountSum === null || amountSum > visit.balance) throw new PaymeError(PAYME_ERROR.WRONG_AMOUNT);
  return { visit, amountSum };
}

async function checkPerform(req: PaymeRpcRequest) {
  const { visit, amountSum } = await validateAccountAndAmount(req.params);
  return {
    allow: true,
    detail: {
      receipt_type: 0,
      items: [
        {
          title: `Tibbiy xizmatlar (qabul ${visit.id})`,
          price: amountSum * 100,
          count: 1,
          code: '10303001001000000',
          package_code: '1209771',
          vat_percent: 0,
        },
      ],
    },
  };
}

async function findPendingForVisit(visitId: string, exceptId: string): Promise<PaymeTxState | null> {
  const states = await loadProviderStates<PaymeTxState>(PAYME_ENTITY);
  return states.find((s) => s.account.visit_id === visitId && s.state === PAYME_STATE.CREATED && s.id !== exceptId) ?? null;
}

async function createTransaction(req: PaymeRpcRequest, now: () => number, ip?: string | null) {
  const id = paymeParamString(req.params, 'id');
  const time = paymeParamNumber(req.params, 'time');
  if (!id || time === null) throw new PaymeError(PAYME_ERROR.INVALID_REQUEST, 'id/time required');

  const existing = await loadProviderState<PaymeTxState>(PAYME_ENTITY, id);
  if (existing) {
    if (existing.state !== PAYME_STATE.CREATED) throw new PaymeError(PAYME_ERROR.CANNOT_PERFORM, 'transaction is not pending');
    if (now() - existing.createTime > PAYME_TRANSACTION_TIMEOUT_MS) {
      const cancelled: PaymeTxState = { ...existing, state: PAYME_STATE.CANCELLED, reason: PAYME_REASON.TIMEOUT, cancelTime: now() };
      await saveProviderState({ entity: PAYME_ENTITY, entityId: id, clinicId: existing.clinicId, before: existing, after: cancelled, action: 'UPDATE', ip, userAgent: 'webhook:payme' });
      throw new PaymeError(PAYME_ERROR.CANNOT_PERFORM, 'transaction timed out');
    }
    return { create_time: existing.createTime, transaction: existing.id, state: existing.state };
  }

  const { visit, amountSum } = await validateAccountAndAmount(req.params);
  const pending = await findPendingForVisit(visit.id, id);
  if (pending) throw new PaymeError(PAYME_ERROR.CANNOT_PERFORM, 'another transaction is pending for this visit');

  const state: PaymeTxState = {
    id,
    time,
    amount: amountSum * 100,
    amountSum,
    account: { visit_id: visit.id },
    state: PAYME_STATE.CREATED,
    reason: null,
    createTime: now(),
    performTime: 0,
    cancelTime: 0,
    clinicId: visit.clinicId,
    paymentId: null,
    refundPaymentId: null,
  };
  await saveProviderState({ entity: PAYME_ENTITY, entityId: id, clinicId: visit.clinicId, before: null, after: state, action: 'CREATE', ip, userAgent: 'webhook:payme' });
  return { create_time: state.createTime, transaction: state.id, state: state.state };
}

async function performTransaction(req: PaymeRpcRequest, now: () => number, ip?: string | null) {
  const id = paymeParamString(req.params, 'id');
  if (!id) throw new PaymeError(PAYME_ERROR.INVALID_REQUEST, 'id required');
  const state = await loadProviderState<PaymeTxState>(PAYME_ENTITY, id);
  if (!state) throw new PaymeError(PAYME_ERROR.TRANSACTION_NOT_FOUND);
  if (state.state === PAYME_STATE.PERFORMED) return { transaction: state.id, perform_time: state.performTime, state: state.state };
  if (state.state !== PAYME_STATE.CREATED) throw new PaymeError(PAYME_ERROR.CANNOT_PERFORM, 'transaction cancelled');

  if (now() - state.createTime > PAYME_TRANSACTION_TIMEOUT_MS) {
    const cancelled: PaymeTxState = { ...state, state: PAYME_STATE.CANCELLED, reason: PAYME_REASON.TIMEOUT, cancelTime: now() };
    await saveProviderState({ entity: PAYME_ENTITY, entityId: id, clinicId: state.clinicId, before: state, after: cancelled, action: 'UPDATE', ip, userAgent: 'webhook:payme' });
    throw new PaymeError(PAYME_ERROR.CANNOT_PERFORM, 'transaction timed out');
  }

  const visit = await findPayableVisit(state.account.visit_id);
  if (!visit || visit.status === 'CANCELLED') throw new PaymeError(PAYME_ERROR.CANNOT_PERFORM, 'visit not payable');
  if (state.amountSum > visit.balance) throw new PaymeError(PAYME_ERROR.CANNOT_PERFORM, 'amount exceeds balance');

  const r = await createOnlinePayment({
    visitId: visit.id,
    clinicId: visit.clinicId,
    amount: state.amountSum,
    method: 'PAYME',
    note: `Payme ${state.id}`,
    providerTransactionId: state.id,
    ip,
  });
  const performed: PaymeTxState = { ...state, state: PAYME_STATE.PERFORMED, performTime: now(), paymentId: r.paymentId };
  await saveProviderState({ entity: PAYME_ENTITY, entityId: id, clinicId: state.clinicId, before: state, after: performed, action: 'UPDATE', ip, userAgent: 'webhook:payme' });
  return { transaction: performed.id, perform_time: performed.performTime, state: performed.state };
}

async function cancelTransaction(req: PaymeRpcRequest, now: () => number, ip?: string | null) {
  const id = paymeParamString(req.params, 'id');
  if (!id) throw new PaymeError(PAYME_ERROR.INVALID_REQUEST, 'id required');
  const reason = paymeParamNumber(req.params, 'reason') ?? PAYME_REASON.UNKNOWN;
  const state = await loadProviderState<PaymeTxState>(PAYME_ENTITY, id);
  if (!state) throw new PaymeError(PAYME_ERROR.TRANSACTION_NOT_FOUND);

  if (state.state === PAYME_STATE.CANCELLED || state.state === PAYME_STATE.CANCELLED_AFTER_PERFORM) {
    return { transaction: state.id, cancel_time: state.cancelTime, state: state.state };
  }

  if (state.state === PAYME_STATE.CREATED) {
    const cancelled: PaymeTxState = { ...state, state: PAYME_STATE.CANCELLED, reason, cancelTime: now() };
    await saveProviderState({ entity: PAYME_ENTITY, entityId: id, clinicId: state.clinicId, before: state, after: cancelled, action: 'UPDATE', ip, userAgent: 'webhook:payme' });
    return { transaction: cancelled.id, cancel_time: cancelled.cancelTime, state: cancelled.state };
  }

  // state 2 — qaytarish (manfiy toʻlov); qabul topilmasa bekor qilib boʻlmaydi
  const visit = await findPayableVisit(state.account.visit_id);
  if (!visit) throw new PaymeError(PAYME_ERROR.CANNOT_CANCEL, 'visit not found');
  const r = await createOnlinePayment({
    visitId: visit.id,
    clinicId: visit.clinicId,
    amount: -state.amountSum,
    method: 'PAYME',
    note: `Payme refund ${state.id}`,
    providerTransactionId: state.id,
    ip,
  });
  const cancelled: PaymeTxState = { ...state, state: PAYME_STATE.CANCELLED_AFTER_PERFORM, reason, cancelTime: now(), refundPaymentId: r.paymentId };
  await saveProviderState({ entity: PAYME_ENTITY, entityId: id, clinicId: state.clinicId, before: state, after: cancelled, action: 'REFUND', ip, userAgent: 'webhook:payme' });
  return { transaction: cancelled.id, cancel_time: cancelled.cancelTime, state: cancelled.state };
}

async function checkTransaction(req: PaymeRpcRequest) {
  const id = paymeParamString(req.params, 'id');
  if (!id) throw new PaymeError(PAYME_ERROR.INVALID_REQUEST, 'id required');
  const state = await loadProviderState<PaymeTxState>(PAYME_ENTITY, id);
  if (!state) throw new PaymeError(PAYME_ERROR.TRANSACTION_NOT_FOUND);
  return txView(state);
}

async function getStatement(req: PaymeRpcRequest) {
  const from = paymeParamNumber(req.params, 'from');
  const to = paymeParamNumber(req.params, 'to');
  if (from === null || to === null) throw new PaymeError(PAYME_ERROR.INVALID_REQUEST, 'from/to required');
  const states = await loadProviderStates<PaymeTxState>(PAYME_ENTITY, {
    // Yozuvlar Payme `time` dan keyin yaratiladi; oraliqni 1 kun kengaytirib olamiz
    createdFrom: new Date(from - 24 * 60 * 60 * 1000),
  });
  const transactions = states
    .filter((s) => s.time >= from && s.time <= to)
    .sort((a, b) => a.time - b.time)
    .map((s) => ({
      id: s.id,
      time: s.time,
      amount: s.amount,
      account: s.account,
      create_time: s.createTime,
      perform_time: s.performTime,
      cancel_time: s.cancelTime,
      transaction: s.id,
      state: s.state,
      reason: s.reason,
      receivers: null,
    }));
  return { transactions };
}

/** PaymentProvider interfeysi */
export class PaymeProvider implements PaymentProvider {
  readonly name = 'payme' as const;
  constructor(private readonly config: PaymeConfig | null = paymeConfigFromEnv()) {}

  isConfigured(): boolean {
    return this.config !== null;
  }

  async createInvoice(visitId: string, amount: number, opts: { returnUrl?: string } = {}): Promise<InvoiceResult> {
    if (!this.config) throw new IntegrationError('payme', 'NOT_CONFIGURED');
    if (!Number.isInteger(amount) || amount <= 0) throw new IntegrationError('payme', 'SEND_FAILED', 'amount must be a positive whole sum');
    const url = paymeCheckoutUrl({
      merchantId: this.config.merchantId,
      visitId,
      amount,
      returnUrl: opts.returnUrl ?? `${appBaseUrl()}/dashboard/visits/${encodeURIComponent(visitId)}`,
      checkoutUrl: this.config.checkoutUrl,
    });
    return { url, provider: 'payme', visitId, amount };
  }

  async verifyWebhook(req: Request): Promise<WebhookVerifyResult> {
    if (!this.config) return { ok: false, provider: 'payme', reason: 'NOT_CONFIGURED' };
    if (!checkPaymeAuth(req.headers.get('authorization'), [this.config.key, this.config.testKey])) {
      return { ok: false, provider: 'payme', reason: 'INSUFFICIENT_PRIVILEGE' };
    }
    let body: unknown = null;
    try {
      body = await req.json();
    } catch {
      return { ok: false, provider: 'payme', reason: 'PARSE' };
    }
    const parsed = parsePaymeRequest(body);
    if (!parsed) return { ok: false, provider: 'payme', reason: 'INVALID_REQUEST' };
    return {
      ok: true,
      provider: 'payme',
      visitId: paymeAccountVisitId(parsed.params),
      amount: tiyinToSum(parsed.params.amount),
      transactionId: paymeParamString(parsed.params, 'id'),
    };
  }
}
