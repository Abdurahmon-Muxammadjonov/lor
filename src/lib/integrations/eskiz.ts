import type { SmsKind, SmsStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { parseClinicSettings } from '@/lib/settings/types';
import { IntegrationError, toIntegrationError } from './errors';
import { fetchWithTimeout, readJsonSafe, readString, type FetchLike } from './http';

/**
 * Eskiz.uz SMS shlyuzi (https://notify.eskiz.uz).
 *
 *  - login: POST /api/auth/login {email, password} → token (30 kun); modul xotirasida keshlanadi,
 *    401 kelsa qayta login qilinib bir marta takrorlanadi.
 *  - sendSms: POST /api/message/sms/send {mobile_phone, message, from} → {id, status}.
 *  - deliverPendingSms: SmsLog PENDING qatorlarini (limit 50) yuboradi, status/providerId/error/sentAt yangilanadi.
 *
 * Sozlash: ESKIZ_EMAIL, ESKIZ_PASSWORD, (ixtiyoriy) ESKIZ_FROM, ESKIZ_BASE_URL.
 */

export const ESKIZ_BASE_URL = 'https://notify.eskiz.uz/api';
export const ESKIZ_TOKEN_TTL_MS = 29 * 24 * 60 * 60 * 1000;
export const ESKIZ_DEFAULT_FROM = '4546';
export const SMS_MAX_LENGTH = 1000;

export interface EskizConfig {
  email: string;
  password: string;
  from: string;
  baseUrl: string;
}

export function eskizConfigFromEnv(env: NodeJS.ProcessEnv = process.env): EskizConfig | null {
  const email = (env.ESKIZ_EMAIL ?? '').trim();
  const password = (env.ESKIZ_PASSWORD ?? '').trim();
  if (!email || !password) return null;
  return {
    email,
    password,
    from: (env.ESKIZ_FROM ?? '').trim() || ESKIZ_DEFAULT_FROM,
    baseUrl: (env.ESKIZ_BASE_URL ?? '').trim().replace(/\/+$/, '') || ESKIZ_BASE_URL,
  };
}

/** Telefonni Eskiz formatiga keltirish: 998XXXXXXXXX (12 raqam); notoʻgʻri boʻlsa null */
export function normalizeEskizPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, '');
  let d = digits;
  if (d.length === 9) d = `998${d}`;
  else if (d.length === 13 && d.startsWith('8998')) d = d.slice(1);
  else if (d.length === 10 && d.startsWith('8')) d = `998${d.slice(1)}`;
  if (d.length !== 12 || !d.startsWith('998')) return null;
  return d;
}

export type TemplateVars = { [key: string]: string | number | null | undefined };

/**
 * Shablon: "{clinic}: {name}, siz {date} soat {time} ga {doctor} qabuliga yozildingiz."
 * Nomaʼlum kalitlar oʻzgarishsiz qoladi (xato koʻrinib tursin), null/undefined → boʻsh satr.
 * Ortiqcha boʻshliqlar yigʻiladi.
 */
export function renderTemplate(template: string, vars: TemplateVars): string {
  return template
    .replace(/\{(\w+)\}/g, (match, key: string) => {
      if (!(key in vars)) return match;
      const v = vars[key];
      return v === null || v === undefined ? '' : String(v);
    })
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ ([,.!?;:])/g, '$1')
    .trim();
}

/** SMS sarfini baholash: GSM-7 (lotin) — 160/153, aks holda (kirill) UCS-2 — 70/67 */
export function smsSegments(text: string): { encoding: 'GSM-7' | 'UCS-2'; length: number; segments: number } {
  // eslint-disable-next-line no-control-regex
  const gsm = /^[\x00-\x7F€£¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉÄÖÑÜ§¿äöñüà]*$/;
  const isGsm = gsm.test(text);
  const length = text.length;
  if (length === 0) return { encoding: isGsm ? 'GSM-7' : 'UCS-2', length: 0, segments: 0 };
  const single = isGsm ? 160 : 70;
  const multi = isGsm ? 153 : 67;
  const segments = length <= single ? 1 : Math.ceil(length / multi);
  return { encoding: isGsm ? 'GSM-7' : 'UCS-2', length, segments };
}

export interface SendSmsInput {
  phone: string;
  text: string;
  from?: string;
}

export interface SendSmsResult {
  /** Provayder xabar identifikatori */
  id: string;
  status: string;
}

interface CachedToken {
  value: string;
  expiresAt: number;
}

export class EskizClient {
  private token: CachedToken | null = null;
  private loginPromise: Promise<string> | null = null;

  constructor(
    private readonly config: EskizConfig | null,
    private readonly fetchImpl: FetchLike = (u, i) => fetch(u, i),
    private readonly now: () => number = () => Date.now(),
  ) {}

  isConfigured(): boolean {
    return this.config !== null;
  }

  get from(): string {
    return this.config?.from ?? ESKIZ_DEFAULT_FROM;
  }

  private requireConfig(): EskizConfig {
    if (!this.config) throw new IntegrationError('eskiz', 'NOT_CONFIGURED');
    return this.config;
  }

  /** Tokenni yangilash (parallel chaqiruvlar bitta soʻrovni kutadi) */
  async login(): Promise<string> {
    if (this.loginPromise) return this.loginPromise;
    this.loginPromise = this.doLogin().finally(() => {
      this.loginPromise = null;
    });
    return this.loginPromise;
  }

  private async doLogin(): Promise<string> {
    const cfg = this.requireConfig();
    const body = new URLSearchParams({ email: cfg.email, password: cfg.password });
    let res: Response;
    try {
      res = await fetchWithTimeout(`${cfg.baseUrl}/auth/login`, { method: 'POST', body, headers: { Accept: 'application/json' } }, 10_000, this.fetchImpl);
    } catch (e) {
      throw toIntegrationError(e, 'eskiz', 'HTTP_ERROR');
    }
    const json = await readJsonSafe(res);
    if (res.status === 401 || res.status === 422) {
      throw new IntegrationError('eskiz', 'AUTH_FAILED', readString(json, 'message'));
    }
    if (!res.ok) throw new IntegrationError('eskiz', 'HTTP_ERROR', `HTTP ${res.status} ${readString(json, 'message') ?? ''}`.trim());
    const data = json && typeof json === 'object' ? (json as { data?: unknown }).data : undefined;
    const token = readString(data, 'token');
    if (!token) throw new IntegrationError('eskiz', 'AUTH_FAILED', 'token missing in response');
    this.token = { value: token, expiresAt: this.now() + ESKIZ_TOKEN_TTL_MS };
    return token;
  }

  async getToken(): Promise<string> {
    if (this.token && this.token.expiresAt > this.now()) return this.token.value;
    return this.login();
  }

  /** Keshdagi tokenni bekor qilish (401 dan keyin) */
  invalidateToken(): void {
    this.token = null;
  }

  async sendSms(input: SendSmsInput): Promise<SendSmsResult> {
    const cfg = this.requireConfig();
    const phone = normalizeEskizPhone(input.phone);
    if (!phone) throw new IntegrationError('eskiz', 'BAD_PHONE', input.phone);
    const text = input.text.trim().slice(0, SMS_MAX_LENGTH);
    if (!text) throw new IntegrationError('eskiz', 'SEND_FAILED', 'empty text');
    const from = (input.from ?? '').trim() || cfg.from;

    const attempt = async (token: string): Promise<Response> => {
      const body = new URLSearchParams({ mobile_phone: phone, message: text, from });
      try {
        return await fetchWithTimeout(
          `${cfg.baseUrl}/message/sms/send`,
          { method: 'POST', body, headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } },
          10_000,
          this.fetchImpl,
        );
      } catch (e) {
        throw toIntegrationError(e, 'eskiz', 'HTTP_ERROR');
      }
    };

    let res = await attempt(await this.getToken());
    if (res.status === 401) {
      this.invalidateToken();
      res = await attempt(await this.login());
    }
    const json = await readJsonSafe(res);
    if (res.status === 401) throw new IntegrationError('eskiz', 'AUTH_FAILED', readString(json, 'message'));
    if (!res.ok) {
      throw new IntegrationError('eskiz', 'SEND_FAILED', `HTTP ${res.status} ${readString(json, 'message') ?? ''}`.trim());
    }
    const id = readString(json, 'id');
    if (!id) throw new IntegrationError('eskiz', 'SEND_FAILED', 'id missing in response');
    return { id, status: readString(json, 'status') ?? 'waiting' };
  }
}

let sharedClient: EskizClient | null = null;
let sharedClientKey = '';

/** Modul darajasida bitta mijoz (token keshi shu yerda yashaydi); env oʻzgarsa qayta yaratiladi */
export function getEskizClient(): EskizClient {
  const cfg = eskizConfigFromEnv();
  const key = cfg ? `${cfg.baseUrl}|${cfg.email}|${cfg.password}|${cfg.from}` : '';
  if (!sharedClient || sharedClientKey !== key) {
    sharedClient = new EskizClient(cfg);
    sharedClientKey = key;
  }
  return sharedClient;
}

export function isEskizConfigured(): boolean {
  return eskizConfigFromEnv() !== null;
}

export interface DeliverResult {
  processed: number;
  sent: number;
  failed: number;
}

export interface DeliverOptions {
  limit?: number;
  client?: EskizClient;
}

/** SmsLog PENDING → yuborish. Sozlanmagan boʻlsa hammasi FAILED ('NOT_CONFIGURED'). */
export async function deliverPendingSms(clinicId?: string, opts: DeliverOptions = {}): Promise<DeliverResult> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
  const client = opts.client ?? getEskizClient();
  const rows = await prisma.smsLog.findMany({
    where: { status: 'PENDING', ...(clinicId ? { clinicId } : {}) },
    orderBy: { createdAt: 'asc' },
    take: limit,
    select: { id: true, clinicId: true, phone: true, text: true },
  });
  const result: DeliverResult = { processed: rows.length, sent: 0, failed: 0 };
  if (rows.length === 0) return result;

  if (!client.isConfigured()) {
    await prisma.smsLog.updateMany({
      where: { id: { in: rows.map((r) => r.id) } },
      data: { status: 'FAILED', error: 'NOT_CONFIGURED' },
    });
    result.failed = rows.length;
    return result;
  }

  // Klinika boʻyicha "from" (sozlamalar) — bir marta yuklanadi
  const clinicIds = Array.from(new Set(rows.map((r) => r.clinicId)));
  const clinics = await prisma.clinic.findMany({ where: { id: { in: clinicIds } }, select: { id: true, settings: true } });
  const fromByClinic = new Map<string, string>();
  for (const c of clinics) fromByClinic.set(c.id, parseClinicSettings(c.settings).sms.from);

  for (const row of rows) {
    try {
      const r = await client.sendSms({ phone: row.phone, text: row.text, from: fromByClinic.get(row.clinicId) });
      await prisma.smsLog.update({
        where: { id: row.id },
        data: { status: 'SENT', providerId: r.id, sentAt: new Date(), error: null },
      });
      result.sent++;
    } catch (e) {
      const err = toIntegrationError(e, 'eskiz', 'SEND_FAILED');
      await prisma.smsLog.update({
        where: { id: row.id },
        data: { status: 'FAILED', error: `${err.code}${err.detail ? `: ${err.detail}` : ''}`.slice(0, 500) },
      });
      result.failed++;
      // Avtorizatsiya/sozlama xatosi — qolganlarini urinishdan maʼno yoʻq
      if (err.code === 'AUTH_FAILED' || err.code === 'NOT_CONFIGURED') {
        const rest = rows.slice(rows.indexOf(row) + 1);
        if (rest.length) {
          await prisma.smsLog.updateMany({
            where: { id: { in: rest.map((r) => r.id) } },
            data: { status: 'FAILED', error: err.code },
          });
          result.failed += rest.length;
        }
        break;
      }
    }
  }
  return result;
}

export interface SendNowInput {
  clinicId: string;
  phone: string;
  text: string;
  kind: SmsKind;
  patientId?: string | null;
  from?: string;
  client?: EskizClient;
}

export interface SendNowResult {
  id: string;
  status: SmsStatus;
  providerId: string | null;
  error: string | null;
}

/** SmsLog yozib darhol yuborish (test SMS va "hozir yuborish" uchun). Sozlanmagan boʻlsa IntegrationError. */
export async function sendSmsNow(input: SendNowInput): Promise<SendNowResult> {
  const client = input.client ?? getEskizClient();
  if (!client.isConfigured()) throw new IntegrationError('eskiz', 'NOT_CONFIGURED');
  const phone = normalizeEskizPhone(input.phone);
  if (!phone) throw new IntegrationError('eskiz', 'BAD_PHONE', input.phone);
  const log = await prisma.smsLog.create({
    data: {
      clinicId: input.clinicId,
      patientId: input.patientId ?? null,
      phone: `+${phone}`,
      text: input.text,
      kind: input.kind,
      status: 'PENDING',
    },
    select: { id: true },
  });
  try {
    const r = await client.sendSms({ phone, text: input.text, from: input.from });
    await prisma.smsLog.update({ where: { id: log.id }, data: { status: 'SENT', providerId: r.id, sentAt: new Date() } });
    return { id: log.id, status: 'SENT', providerId: r.id, error: null };
  } catch (e) {
    const err = toIntegrationError(e, 'eskiz', 'SEND_FAILED');
    const error = `${err.code}${err.detail ? `: ${err.detail}` : ''}`.slice(0, 500);
    await prisma.smsLog.update({ where: { id: log.id }, data: { status: 'FAILED', error } });
    throw err;
  }
}
