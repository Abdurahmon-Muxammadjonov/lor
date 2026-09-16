/**
 * Onlayn toʻlov provayderlari (Click, Payme) uchun umumiy interfeys.
 * Pul: butun soʻm (number). Payme ichida tiyin (×100) — faqat payme.ts ichida konvertatsiya qilinadi.
 */

export type PaymentProviderName = 'click' | 'payme';

export interface InvoiceResult {
  /** Toʻlov sahifasi havolasi (bemorga yuboriladi / QR) */
  url: string;
  provider: PaymentProviderName;
  visitId: string;
  amount: number;
}

export type WebhookVerifyResult =
  | { ok: true; provider: PaymentProviderName; visitId: string | null; amount: number | null; transactionId: string | null }
  | { ok: false; provider: PaymentProviderName; reason: string };

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  isConfigured(): boolean;
  /** Toʻlov havolasi (toʻlovni provayder sahifasida bemor bajaradi) */
  createInvoice(visitId: string, amount: number, opts?: { returnUrl?: string }): Promise<InvoiceResult>;
  /** Webhook soʻrovini tekshirish (imzo/avtorizatsiya) — DB ga tegmaydi */
  verifyWebhook(req: Request): Promise<WebhookVerifyResult>;
}

export interface ClickConfig {
  merchantId: string;
  serviceId: string;
  secretKey: string;
  /** Click "merchant user id" (ixtiyoriy, hisobot uchun) */
  merchantUserId: string;
}

export interface PaymeConfig {
  merchantId: string;
  /** Production kaliti (Basic auth: Paycom:<key>) */
  key: string;
  /** Test kaliti (Payme sandbox) — ixtiyoriy, ikkalasi ham qabul qilinadi */
  testKey: string;
  checkoutUrl: string;
}

export function clickConfigFromEnv(env: NodeJS.ProcessEnv = process.env): ClickConfig | null {
  const merchantId = (env.CLICK_MERCHANT_ID ?? '').trim();
  const serviceId = (env.CLICK_SERVICE_ID ?? '').trim();
  const secretKey = (env.CLICK_SECRET_KEY ?? '').trim();
  if (!merchantId || !serviceId || !secretKey) return null;
  return { merchantId, serviceId, secretKey, merchantUserId: (env.CLICK_MERCHANT_USER_ID ?? '').trim() };
}

export function paymeConfigFromEnv(env: NodeJS.ProcessEnv = process.env): PaymeConfig | null {
  const merchantId = (env.PAYME_MERCHANT_ID ?? '').trim();
  const key = (env.PAYME_KEY ?? '').trim();
  if (!merchantId || !key) return null;
  return {
    merchantId,
    key,
    testKey: (env.PAYME_TEST_KEY ?? '').trim(),
    checkoutUrl: (env.PAYME_CHECKOUT_URL ?? '').trim().replace(/\/+$/, '') || 'https://checkout.paycom.uz',
  };
}

export function isClickConfigured(): boolean {
  return clickConfigFromEnv() !== null;
}

export function isPaymeConfigured(): boolean {
  return paymeConfigFromEnv() !== null;
}

/** Ilova manzili (return_url uchun) */
export function appBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return ((env.APP_URL ?? env.NEXTAUTH_URL ?? '').trim() || 'http://localhost:3000').replace(/\/+$/, '');
}
