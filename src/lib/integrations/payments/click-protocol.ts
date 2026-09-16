import { createHash } from 'node:crypto';
import { D } from '@/lib/money';

/**
 * Click SHOP API (Prepare / Complete) — sof protokol qismi (DB siz, testlanadi).
 *
 * Imzo: md5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id + [merchant_prepare_id] + amount + action + sign_time)
 * merchant_prepare_id faqat Complete (action=1) da qatnashadi. Qiymatlar Click yuborgan KOʻRINISHDA (satr) ulanadi.
 */

export const CLICK_ACTION_PREPARE = 0;
export const CLICK_ACTION_COMPLETE = 1;

export const CLICK_ERROR = {
  SUCCESS: 0,
  SIGN_CHECK_FAILED: -1,
  INCORRECT_AMOUNT: -2,
  ACTION_NOT_FOUND: -3,
  ALREADY_PAID: -4,
  USER_NOT_FOUND: -5,
  TRANSACTION_NOT_FOUND: -6,
  FAILED_TO_UPDATE: -7,
  BAD_REQUEST: -8,
  TRANSACTION_CANCELLED: -9,
} as const;
export type ClickErrorCode = (typeof CLICK_ERROR)[keyof typeof CLICK_ERROR];

export const CLICK_ERROR_NOTE: Record<ClickErrorCode, string> = {
  0: 'Success',
  [-1]: 'SIGN CHECK FAILED!',
  [-2]: 'Incorrect parameter amount',
  [-3]: 'Action not found',
  [-4]: 'Already paid',
  [-5]: 'User does not exist',
  [-6]: 'Transaction does not exist',
  [-7]: 'Failed to update user',
  [-8]: 'Error in request from click',
  [-9]: 'Transaction cancelled',
};

export interface ClickRequest {
  click_trans_id: string;
  service_id: string;
  click_paydoc_id: string;
  merchant_trans_id: string;
  merchant_prepare_id?: string;
  amount: string;
  action: number;
  error: number;
  error_note: string;
  sign_time: string;
  sign_string: string;
}

export interface ClickResponse {
  click_trans_id: string;
  merchant_trans_id: string;
  merchant_prepare_id?: string;
  merchant_confirm_id?: string;
  error: ClickErrorCode;
  error_note: string;
}

export function md5(s: string): string {
  return createHash('md5').update(s, 'utf8').digest('hex');
}

/** Imzo satri (Click hujjati boʻyicha) */
export function clickSignaturePayload(
  p: Pick<ClickRequest, 'click_trans_id' | 'service_id' | 'merchant_trans_id' | 'amount' | 'action' | 'sign_time'> & { merchant_prepare_id?: string },
  secretKey: string,
): string {
  const prepareId = Number(p.action) === CLICK_ACTION_COMPLETE ? (p.merchant_prepare_id ?? '') : '';
  return `${p.click_trans_id}${p.service_id}${secretKey}${p.merchant_trans_id}${prepareId}${p.amount}${p.action}${p.sign_time}`;
}

export function clickSignature(
  p: Pick<ClickRequest, 'click_trans_id' | 'service_id' | 'merchant_trans_id' | 'amount' | 'action' | 'sign_time'> & { merchant_prepare_id?: string },
  secretKey: string,
): string {
  return md5(clickSignaturePayload(p, secretKey));
}

export function verifyClickSignature(p: ClickRequest, secretKey: string): boolean {
  const expected = clickSignature(p, secretKey);
  const got = (p.sign_string ?? '').trim().toLowerCase();
  if (got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}

type RawParams = Record<string, string | string[] | undefined>;

function pick(params: RawParams, key: string): string | undefined {
  const v = params[key];
  if (Array.isArray(v)) return v[0];
  return v;
}

/** URLSearchParams / JSON / FormData dan xom parametrlar (satr) */
export function toRawParams(input: URLSearchParams | FormData | Record<string, unknown>): RawParams {
  const out: RawParams = {};
  if (input instanceof URLSearchParams) {
    input.forEach((v, k) => {
      out[k] = v;
    });
    return out;
  }
  if (typeof FormData !== 'undefined' && input instanceof FormData) {
    input.forEach((v, k) => {
      if (typeof v === 'string') out[k] = v;
    });
    return out;
  }
  for (const [k, v] of Object.entries(input)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[k] = String(v);
  }
  return out;
}

/** Xom parametrlarni tekshirib ClickRequest ga keltirish; yetishmasa null (→ -8) */
export function parseClickRequest(params: RawParams): ClickRequest | null {
  const clickTransId = pick(params, 'click_trans_id');
  const serviceId = pick(params, 'service_id');
  const merchantTransId = pick(params, 'merchant_trans_id');
  const amount = pick(params, 'amount');
  const actionRaw = pick(params, 'action');
  const signTime = pick(params, 'sign_time');
  const signString = pick(params, 'sign_string');
  if (!clickTransId || !serviceId || !merchantTransId || !amount || actionRaw === undefined || !signTime || !signString) return null;
  const action = Number(actionRaw);
  if (!Number.isInteger(action)) return null;
  const errorRaw = pick(params, 'error');
  const error = errorRaw === undefined || errorRaw === '' ? 0 : Number(errorRaw);
  if (!Number.isFinite(error)) return null;
  if (!/^-?\d+(\.\d+)?$/.test(amount.trim())) return null;
  return {
    click_trans_id: clickTransId,
    service_id: serviceId,
    click_paydoc_id: pick(params, 'click_paydoc_id') ?? '',
    merchant_trans_id: merchantTransId,
    merchant_prepare_id: pick(params, 'merchant_prepare_id'),
    amount: amount.trim(),
    action,
    error: Math.trunc(error),
    error_note: pick(params, 'error_note') ?? '',
    sign_time: signTime,
    sign_string: signString,
  };
}

/** Click summasi ("1000.00") → butun soʻm; notoʻgʻri/manfiy/nol → null */
export function clickAmountToSum(amount: string): number | null {
  try {
    const d = D(amount);
    if (!d.isFinite() || d.lte(0)) return null;
    if (!d.mod(1).isZero()) return null; // tiyin qabul qilinmaydi (butun soʻm)
    return d.toNumber();
  } catch {
    return null;
  }
}

export function clickErrorResponse(req: Pick<ClickRequest, 'click_trans_id' | 'merchant_trans_id'>, error: ClickErrorCode, note?: string): ClickResponse {
  return { click_trans_id: req.click_trans_id, merchant_trans_id: req.merchant_trans_id, error, error_note: note ?? CLICK_ERROR_NOTE[error] };
}

/** Click toʻlov sahifasi havolasi */
export function clickInvoiceUrl(params: { serviceId: string; merchantId: string; amount: number; visitId: string; returnUrl?: string; merchantUserId?: string }): string {
  const sp = new URLSearchParams({
    service_id: params.serviceId,
    merchant_id: params.merchantId,
    amount: D(params.amount).toFixed(2),
    transaction_param: params.visitId,
  });
  if (params.merchantUserId) sp.set('merchant_user_id', params.merchantUserId);
  if (params.returnUrl) sp.set('return_url', params.returnUrl);
  return `https://my.click.uz/services/pay?${sp.toString()}`;
}
