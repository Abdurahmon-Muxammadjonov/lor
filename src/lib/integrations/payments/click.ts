import { IntegrationError } from '../errors';
import { createOnlinePayment, findPayableVisit, loadProviderState, saveProviderState } from './common';
import {
  CLICK_ACTION_COMPLETE,
  CLICK_ACTION_PREPARE,
  CLICK_ERROR,
  clickAmountToSum,
  clickErrorResponse,
  clickInvoiceUrl,
  parseClickRequest,
  toRawParams,
  verifyClickSignature,
  type ClickRequest,
  type ClickResponse,
} from './click-protocol';
import { appBaseUrl, clickConfigFromEnv, type ClickConfig, type InvoiceResult, type PaymentProvider, type WebhookVerifyResult } from './types';

export * from './click-protocol';

/**
 * Click SHOP API — Prepare/Complete (FAQAT SERVER).
 *
 * merchant_trans_id = Visit.id. Tranzaksiya holati AuditLog da: entity 'ClickTransaction', entityId = click_trans_id
 * (append-only, oxirgi yozuv = joriy holat). Complete muvaffaqiyatida Payment {method: CLICK} + recalcVisit.
 */

export const CLICK_ENTITY = 'ClickTransaction';
export type ClickTxStatus = 'PREPARED' | 'COMPLETED' | 'CANCELLED';

export interface ClickTxState {
  clickTransId: string;
  clickPaydocId: string;
  serviceId: string;
  merchantTransId: string;
  merchantPrepareId: string;
  merchantConfirmId: string | null;
  amount: number;
  status: ClickTxStatus;
  clinicId: string;
  paymentId: string | null;
  preparedAt: string;
  completedAt: string | null;
  cancelledAt: string | null;
  errorNote: string | null;
}

export interface ClickHandlerOptions {
  config?: ClickConfig | null;
  ip?: string | null;
  now?: () => Date;
}

function amountMismatch(amountSum: number | null, balance: number): boolean {
  return amountSum === null || amountSum > balance;
}

/** Click soʻrovini bajarish; javob doim HTTP 200 + JSON (Click protokoli) */
export async function handleClickRequest(rawParams: Record<string, unknown> | URLSearchParams | FormData, opts: ClickHandlerOptions = {}): Promise<ClickResponse> {
  const config = opts.config === undefined ? clickConfigFromEnv() : opts.config;
  const params = toRawParams(rawParams);
  const req = parseClickRequest(params);
  if (!req) {
    return {
      click_trans_id: String(params.click_trans_id ?? ''),
      merchant_trans_id: String(params.merchant_trans_id ?? ''),
      error: CLICK_ERROR.BAD_REQUEST,
      error_note: 'Error in request from click',
    };
  }
  if (!config) return clickErrorResponse(req, CLICK_ERROR.SIGN_CHECK_FAILED, 'Click is not configured');
  if (!verifyClickSignature(req, config.secretKey)) return clickErrorResponse(req, CLICK_ERROR.SIGN_CHECK_FAILED);
  if (req.service_id !== config.serviceId) return clickErrorResponse(req, CLICK_ERROR.BAD_REQUEST, 'Unknown service_id');

  if (req.action === CLICK_ACTION_PREPARE) return prepare(req, opts);
  if (req.action === CLICK_ACTION_COMPLETE) return complete(req, opts);
  return clickErrorResponse(req, CLICK_ERROR.ACTION_NOT_FOUND);
}

async function prepare(req: ClickRequest, opts: ClickHandlerOptions): Promise<ClickResponse> {
  const now = opts.now?.() ?? new Date();
  const visit = await findPayableVisit(req.merchant_trans_id);
  if (!visit || visit.status === 'CANCELLED') return clickErrorResponse(req, CLICK_ERROR.USER_NOT_FOUND, 'Visit not found');
  if (visit.balance <= 0) return clickErrorResponse(req, CLICK_ERROR.ALREADY_PAID);
  const amountSum = clickAmountToSum(req.amount);
  if (amountMismatch(amountSum, visit.balance) || amountSum === null) return clickErrorResponse(req, CLICK_ERROR.INCORRECT_AMOUNT);

  const existing = await loadProviderState<ClickTxState>(CLICK_ENTITY, req.click_trans_id);
  if (existing?.status === 'COMPLETED') return clickErrorResponse(req, CLICK_ERROR.ALREADY_PAID);

  const merchantPrepareId = existing?.status === 'PREPARED' ? existing.merchantPrepareId : String(now.getTime());
  const state: ClickTxState = {
    clickTransId: req.click_trans_id,
    clickPaydocId: req.click_paydoc_id,
    serviceId: req.service_id,
    merchantTransId: req.merchant_trans_id,
    merchantPrepareId,
    merchantConfirmId: null,
    amount: amountSum,
    status: 'PREPARED',
    clinicId: visit.clinicId,
    paymentId: null,
    preparedAt: now.toISOString(),
    completedAt: null,
    cancelledAt: null,
    errorNote: null,
  };
  if (!existing || existing.status !== 'PREPARED') {
    await saveProviderState({
      entity: CLICK_ENTITY,
      entityId: req.click_trans_id,
      clinicId: visit.clinicId,
      before: existing,
      after: state,
      action: 'CREATE',
      ip: opts.ip,
      userAgent: 'webhook:click',
    });
  }
  return {
    click_trans_id: req.click_trans_id,
    merchant_trans_id: req.merchant_trans_id,
    merchant_prepare_id: merchantPrepareId,
    error: CLICK_ERROR.SUCCESS,
    error_note: 'Success',
  };
}

async function complete(req: ClickRequest, opts: ClickHandlerOptions): Promise<ClickResponse> {
  const now = opts.now?.() ?? new Date();
  const state = await loadProviderState<ClickTxState>(CLICK_ENTITY, req.click_trans_id);
  if (!state) return clickErrorResponse(req, CLICK_ERROR.TRANSACTION_NOT_FOUND);

  // Click tomonida xato (error < 0) — tranzaksiya bekor
  if (req.error < 0) {
    if (state.status !== 'COMPLETED' && state.status !== 'CANCELLED') {
      await saveProviderState({
        entity: CLICK_ENTITY,
        entityId: req.click_trans_id,
        clinicId: state.clinicId,
        before: state,
        after: { ...state, status: 'CANCELLED', cancelledAt: now.toISOString(), errorNote: req.error_note || String(req.error) } satisfies ClickTxState,
        action: 'UPDATE',
        ip: opts.ip,
        userAgent: 'webhook:click',
      });
    }
    return clickErrorResponse(req, CLICK_ERROR.TRANSACTION_CANCELLED);
  }

  if (state.status === 'COMPLETED') return clickErrorResponse(req, CLICK_ERROR.ALREADY_PAID);
  if (state.status === 'CANCELLED') return clickErrorResponse(req, CLICK_ERROR.TRANSACTION_CANCELLED);
  if ((req.merchant_prepare_id ?? '') !== state.merchantPrepareId || req.merchant_trans_id !== state.merchantTransId) {
    return clickErrorResponse(req, CLICK_ERROR.TRANSACTION_NOT_FOUND, 'merchant_prepare_id mismatch');
  }

  const visit = await findPayableVisit(req.merchant_trans_id);
  if (!visit || visit.status === 'CANCELLED') return clickErrorResponse(req, CLICK_ERROR.USER_NOT_FOUND, 'Visit not found');
  if (visit.balance <= 0) return clickErrorResponse(req, CLICK_ERROR.ALREADY_PAID);
  const amountSum = clickAmountToSum(req.amount);
  if (amountSum === null || amountSum !== state.amount || amountSum > visit.balance) {
    return clickErrorResponse(req, CLICK_ERROR.INCORRECT_AMOUNT);
  }

  let paymentId: string;
  try {
    const r = await createOnlinePayment({
      visitId: visit.id,
      clinicId: visit.clinicId,
      amount: amountSum,
      method: 'CLICK',
      note: `Click ${req.click_trans_id}`,
      providerTransactionId: req.click_trans_id,
      ip: opts.ip,
    });
    paymentId = r.paymentId;
  } catch {
    return clickErrorResponse(req, CLICK_ERROR.FAILED_TO_UPDATE);
  }

  const merchantConfirmId = String(now.getTime());
  await saveProviderState({
    entity: CLICK_ENTITY,
    entityId: req.click_trans_id,
    clinicId: visit.clinicId,
    before: state,
    after: { ...state, status: 'COMPLETED', completedAt: now.toISOString(), paymentId, merchantConfirmId } satisfies ClickTxState,
    action: 'UPDATE',
    ip: opts.ip,
    userAgent: 'webhook:click',
  });
  return {
    click_trans_id: req.click_trans_id,
    merchant_trans_id: req.merchant_trans_id,
    merchant_confirm_id: merchantConfirmId,
    error: CLICK_ERROR.SUCCESS,
    error_note: 'Success',
  };
}

/** PaymentProvider interfeysi (invoice havolasi + webhook tekshiruvi) */
export class ClickProvider implements PaymentProvider {
  readonly name = 'click' as const;
  constructor(private readonly config: ClickConfig | null = clickConfigFromEnv()) {}

  isConfigured(): boolean {
    return this.config !== null;
  }

  async createInvoice(visitId: string, amount: number, opts: { returnUrl?: string } = {}): Promise<InvoiceResult> {
    if (!this.config) throw new IntegrationError('click', 'NOT_CONFIGURED');
    if (!Number.isInteger(amount) || amount <= 0) throw new IntegrationError('click', 'SEND_FAILED', 'amount must be a positive whole sum');
    const url = clickInvoiceUrl({
      serviceId: this.config.serviceId,
      merchantId: this.config.merchantId,
      merchantUserId: this.config.merchantUserId || undefined,
      amount,
      visitId,
      returnUrl: opts.returnUrl ?? `${appBaseUrl()}/dashboard/visits/${encodeURIComponent(visitId)}`,
    });
    return { url, provider: 'click', visitId, amount };
  }

  async verifyWebhook(req: Request): Promise<WebhookVerifyResult> {
    if (!this.config) return { ok: false, provider: 'click', reason: 'NOT_CONFIGURED' };
    const params = await readClickBody(req);
    const parsed = parseClickRequest(toRawParams(params));
    if (!parsed) return { ok: false, provider: 'click', reason: 'BAD_REQUEST' };
    if (!verifyClickSignature(parsed, this.config.secretKey)) return { ok: false, provider: 'click', reason: 'SIGN_CHECK_FAILED' };
    return {
      ok: true,
      provider: 'click',
      visitId: parsed.merchant_trans_id,
      amount: clickAmountToSum(parsed.amount),
      transactionId: parsed.click_trans_id,
    };
  }
}

/** Click soʻrov tanasi: x-www-form-urlencoded (standart) yoki JSON */
export async function readClickBody(req: Request): Promise<Record<string, unknown>> {
  const ct = req.headers.get('content-type') ?? '';
  const text = await req.text();
  if (ct.includes('application/json')) {
    try {
      const json = JSON.parse(text) as unknown;
      return json && typeof json === 'object' && !Array.isArray(json) ? (json as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }
  const out: Record<string, unknown> = {};
  new URLSearchParams(text).forEach((v, k) => {
    out[k] = v;
  });
  return out;
}
