import { D } from '@/lib/money';

/**
 * Payme Merchant API (JSON-RPC 2.0) — sof protokol qismi (DB siz, testlanadi).
 * Summalar tiyinda (1 soʻm = 100 tiyin). Avtorizatsiya: `Authorization: Basic base64("Paycom:" + KEY)`.
 */

export const PAYME_ACCOUNT_FIELD = 'visit_id';
/** CreateTransaction dan keyin 12 soat ichida Perform boʻlmasa — bekor (reason 4) */
export const PAYME_TRANSACTION_TIMEOUT_MS = 12 * 60 * 60 * 1000;

export const PAYME_STATE = {
  CREATED: 1,
  PERFORMED: 2,
  CANCELLED: -1,
  CANCELLED_AFTER_PERFORM: -2,
} as const;
export type PaymeState = (typeof PAYME_STATE)[keyof typeof PAYME_STATE];

export const PAYME_REASON = {
  RECIPIENT_NOT_FOUND: 1,
  DEBUG: 2,
  ERROR: 3,
  TIMEOUT: 4,
  REFUND: 5,
  UNKNOWN: 10,
} as const;

export const PAYME_ERROR = {
  PARSE: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INSUFFICIENT_PRIVILEGE: -32504,
  INTERNAL: -32400,
  WRONG_AMOUNT: -31001,
  TRANSACTION_NOT_FOUND: -31003,
  CANNOT_CANCEL: -31007,
  CANNOT_PERFORM: -31008,
  ACCOUNT_NOT_FOUND: -31050,
  ACCOUNT_ALREADY_PAID: -31051,
  ACCOUNT_CANCELLED: -31052,
} as const;
export type PaymeErrorCode = (typeof PAYME_ERROR)[keyof typeof PAYME_ERROR];

export interface PaymeErrorMessage {
  ru: string;
  uz: string;
  en: string;
}

export const PAYME_ERROR_MESSAGES: Record<PaymeErrorCode, PaymeErrorMessage> = {
  [-32700]: { ru: 'Ошибка разбора JSON', uz: 'JSON xatosi', en: 'Parse error' },
  [-32600]: { ru: 'Неверный запрос', uz: 'Notoʻgʻri soʻrov', en: 'Invalid request' },
  [-32601]: { ru: 'Метод не найден', uz: 'Metod topilmadi', en: 'Method not found' },
  [-32504]: { ru: 'Недостаточно привилегий', uz: 'Ruxsat yetarli emas', en: 'Insufficient privilege' },
  [-32400]: { ru: 'Внутренняя ошибка', uz: 'Ichki xato', en: 'Internal error' },
  [-31001]: { ru: 'Неверная сумма', uz: 'Summa notoʻgʻri', en: 'Wrong amount' },
  [-31003]: { ru: 'Транзакция не найдена', uz: 'Tranzaksiya topilmadi', en: 'Transaction not found' },
  [-31007]: { ru: 'Невозможно отменить транзакцию', uz: 'Tranzaksiyani bekor qilib boʻlmaydi', en: 'Cannot cancel transaction' },
  [-31008]: { ru: 'Невозможно выполнить операцию', uz: 'Amalni bajarib boʻlmaydi', en: 'Cannot perform operation' },
  [-31050]: { ru: 'Приём не найден', uz: 'Qabul topilmadi', en: 'Visit not found' },
  [-31051]: { ru: 'Приём уже оплачен', uz: 'Qabul allaqachon toʻlangan', en: 'Visit already paid' },
  [-31052]: { ru: 'Приём отменён', uz: 'Qabul bekor qilingan', en: 'Visit cancelled' },
};

export class PaymeError extends Error {
  constructor(
    public code: PaymeErrorCode,
    public data?: string,
  ) {
    super(PAYME_ERROR_MESSAGES[code].en);
    this.name = 'PaymeError';
  }
}

export type PaymeMethod =
  | 'CheckPerformTransaction'
  | 'CreateTransaction'
  | 'PerformTransaction'
  | 'CancelTransaction'
  | 'CheckTransaction'
  | 'GetStatement'
  | 'SetFingerprint'
  | 'ChangePassword';

export const PAYME_METHODS: ReadonlyArray<PaymeMethod> = [
  'CheckPerformTransaction',
  'CreateTransaction',
  'PerformTransaction',
  'CancelTransaction',
  'CheckTransaction',
  'GetStatement',
  'SetFingerprint',
  'ChangePassword',
];

export interface PaymeRpcRequest {
  id: number | string | null;
  method: string;
  params: Record<string, unknown>;
}

export type PaymeRpcResponse =
  | { jsonrpc: '2.0'; id: number | string | null; result: unknown }
  | { jsonrpc: '2.0'; id: number | string | null; error: { code: number; message: PaymeErrorMessage; data?: string } };

export function paymeResult(id: PaymeRpcRequest['id'], result: unknown): PaymeRpcResponse {
  return { jsonrpc: '2.0', id, result };
}

export function paymeErrorResponse(id: PaymeRpcRequest['id'], code: PaymeErrorCode, data?: string): PaymeRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message: PAYME_ERROR_MESSAGES[code], ...(data ? { data } : {}) } };
}

/** JSON tanasidan JSON-RPC soʻrov; notoʻgʻri boʻlsa null (→ -32600) */
export function parsePaymeRequest(body: unknown): PaymeRpcRequest | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  const method = b.method;
  if (typeof method !== 'string' || !method) return null;
  const idRaw = b.id;
  const id = typeof idRaw === 'number' || typeof idRaw === 'string' ? idRaw : null;
  const params = b.params && typeof b.params === 'object' && !Array.isArray(b.params) ? (b.params as Record<string, unknown>) : {};
  return { id, method, params };
}

/** `Authorization: Basic base64("Paycom:" + key)` tekshiruvi (asosiy yoki test kaliti) */
export function checkPaymeAuth(authorization: string | null | undefined, keys: ReadonlyArray<string>): boolean {
  if (!authorization) return false;
  const m = /^Basic\s+([A-Za-z0-9+/=]+)$/i.exec(authorization.trim());
  if (!m || !m[1]) return false;
  let decoded: string;
  try {
    decoded = Buffer.from(m[1], 'base64').toString('utf8');
  } catch {
    return false;
  }
  const idx = decoded.indexOf(':');
  if (idx < 0) return false;
  const login = decoded.slice(0, idx);
  const pass = decoded.slice(idx + 1);
  if (login !== 'Paycom') return false;
  return keys.some((k) => k.length > 0 && constantTimeEqual(k, pass));
}

function constantTimeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length === b.length ? 0 : 1;
  for (let i = 0; i < len; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

/** Tiyin → butun soʻm; 100 ga boʻlinmasa yoki musbat boʻlmasa null */
export function tiyinToSum(amount: unknown): number | null {
  if (typeof amount !== 'number' && typeof amount !== 'string') return null;
  let d: ReturnType<typeof D>;
  try {
    d = D(amount);
  } catch {
    return null;
  }
  if (!d.isFinite() || d.lte(0) || !d.mod(1).isZero()) return null;
  if (!d.mod(100).isZero()) return null;
  return d.div(100).toNumber();
}

/** Butun soʻm → tiyin */
export function sumToTiyin(sum: number | string): number {
  return D(sum).mul(100).toDecimalPlaces(0).toNumber();
}

/** params.account.visit_id (satr) */
export function paymeAccountVisitId(params: Record<string, unknown>, field: string = PAYME_ACCOUNT_FIELD): string | null {
  const account = params.account;
  if (!account || typeof account !== 'object' || Array.isArray(account)) return null;
  const v = (account as Record<string, unknown>)[field];
  if (typeof v === 'string' && v.trim()) return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return null;
}

export function paymeParamString(params: Record<string, unknown>, key: string): string | null {
  const v = params[key];
  if (typeof v === 'string' && v) return v;
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return null;
}

export function paymeParamNumber(params: Record<string, unknown>, key: string): number | null {
  const v = params[key];
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

/** Payme checkout havolasi: base64("m=MERCHANT;ac.visit_id=VISIT;a=TIYIN;c=RETURN_URL") */
export function paymeCheckoutUrl(params: { merchantId: string; visitId: string; amount: number; returnUrl?: string; checkoutUrl?: string; accountField?: string }): string {
  const parts = [`m=${params.merchantId}`, `ac.${params.accountField ?? PAYME_ACCOUNT_FIELD}=${params.visitId}`, `a=${sumToTiyin(params.amount)}`];
  if (params.returnUrl) parts.push(`c=${params.returnUrl}`);
  const payload = Buffer.from(parts.join(';'), 'utf8').toString('base64');
  return `${(params.checkoutUrl ?? 'https://checkout.paycom.uz').replace(/\/+$/, '')}/${payload}`;
}
