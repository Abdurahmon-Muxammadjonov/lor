import type { PayMethod } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { D, sumMoney, formatMoney } from '@/lib/money';
import { dayRangeTz, todayKey } from '@/lib/date';
import { parseClinicSettings } from '@/lib/settings/types';
import type { Locale } from '@/i18n/config';
import { IntegrationError, toIntegrationError } from './errors';
import { fetchWithTimeout, isRecord, readJsonSafe, readNumber, readString, type FetchLike } from './http';

/**
 * Telegram Bot API: xabar yuborish (HTML), kunlik hisobot.
 * Sozlash: TELEGRAM_BOT_TOKEN (server). Chat ID lar — klinika sozlamalarida (telegram.adminChatIds).
 */

export const TELEGRAM_API_BASE = 'https://api.telegram.org';
export const TELEGRAM_MAX_TEXT = 4096;

export function telegramTokenFromEnv(env: NodeJS.ProcessEnv = process.env): string | null {
  const t = (env.TELEGRAM_BOT_TOKEN ?? '').trim();
  return t ? t : null;
}

export function isTelegramConfigured(): boolean {
  return telegramTokenFromEnv() !== null;
}

/** HTML parse_mode uchun maxsus belgilarni qochirish */
export function escapeTelegramHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export interface TelegramSendResult {
  messageId: number;
  chatId: string;
}

export interface TelegramClientOptions {
  token?: string | null;
  fetchImpl?: FetchLike;
  baseUrl?: string;
}

export class TelegramClient {
  private readonly token: string | null;
  private readonly fetchImpl: FetchLike;
  private readonly baseUrl: string;

  constructor(opts: TelegramClientOptions = {}) {
    this.token = opts.token === undefined ? telegramTokenFromEnv() : opts.token;
    this.fetchImpl = opts.fetchImpl ?? ((u, i) => fetch(u, i));
    this.baseUrl = (opts.baseUrl ?? TELEGRAM_API_BASE).replace(/\/+$/, '');
  }

  isConfigured(): boolean {
    return !!this.token;
  }

  private async call(method: string, payload: Record<string, unknown>): Promise<unknown> {
    if (!this.token) throw new IntegrationError('telegram', 'NOT_CONFIGURED');
    let res: Response;
    try {
      res = await fetchWithTimeout(
        `${this.baseUrl}/bot${this.token}/${method}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) },
        10_000,
        this.fetchImpl,
      );
    } catch (e) {
      throw toIntegrationError(e, 'telegram', 'HTTP_ERROR');
    }
    const json = await readJsonSafe(res);
    const okFlag = isRecord(json) && json.ok === true;
    if (res.status === 401 || res.status === 404) {
      throw new IntegrationError('telegram', 'AUTH_FAILED', readString(json, 'description') ?? `HTTP ${res.status}`);
    }
    if (!res.ok || !okFlag) {
      const desc = readString(json, 'description') ?? `HTTP ${res.status}`;
      const code = res.status === 400 || res.status === 403 ? 'SEND_FAILED' : 'HTTP_ERROR';
      throw new IntegrationError('telegram', code, desc);
    }
    return isRecord(json) ? json.result : null;
  }

  async sendMessage(chatId: string, text: string, parseMode: 'HTML' | 'MarkdownV2' | null = 'HTML'): Promise<TelegramSendResult> {
    const id = chatId.trim();
    if (!/^-?\d{1,20}$/.test(id) && !/^@[A-Za-z0-9_]{5,}$/.test(id)) throw new IntegrationError('telegram', 'BAD_CHAT_ID', chatId);
    const body = text.length > TELEGRAM_MAX_TEXT ? `${text.slice(0, TELEGRAM_MAX_TEXT - 1)}…` : text;
    const result = await this.call('sendMessage', {
      chat_id: id,
      text: body,
      ...(parseMode ? { parse_mode: parseMode } : {}),
      disable_web_page_preview: true,
    });
    const messageId = readNumber(result, 'message_id') ?? 0;
    return { messageId, chatId: id };
  }

  /** Bot maʼlumoti (username) — sozlamalar sahifasida koʻrsatish uchun */
  async getMe(): Promise<{ username: string | null; firstName: string | null }> {
    const result = await this.call('getMe', {});
    return { username: readString(result, 'username') ?? null, firstName: readString(result, 'first_name') ?? null };
  }
}

let sharedClient: TelegramClient | null = null;
let sharedToken = '';

export function getTelegramClient(): TelegramClient {
  const token = telegramTokenFromEnv() ?? '';
  if (!sharedClient || sharedToken !== token) {
    sharedClient = new TelegramClient({ token: token || null });
    sharedToken = token;
  }
  return sharedClient;
}

/** Qisqa yordamchi: sozlanmagan boʻlsa IntegrationError('NOT_CONFIGURED') */
export async function sendMessage(chatId: string, text: string, parseMode: 'HTML' | 'MarkdownV2' | null = 'HTML'): Promise<TelegramSendResult> {
  return getTelegramClient().sendMessage(chatId, text, parseMode);
}

// ── Kunlik hisobot ──

const REPORT_TEXT = {
  uz: {
    title: 'Kunlik hisobot',
    revenue: 'Tushum',
    visits: 'Qabullar',
    completed: 'yakunlangan',
    open: 'ochiq',
    newPatients: 'Yangi bemorlar',
    topServices: 'Eng koʻp xizmatlar',
    debts: 'Qarzlar (bugungi qabullar)',
    noDebts: 'Qarz yoʻq',
    noPayments: 'Toʻlovlar yoʻq',
    noServices: 'Xizmatlar yoʻq',
    refunds: 'Qaytarishlar',
    times: 'marta',
    currency: 'soʻm',
    visitsWord: 'ta',
    patientsWord: 'ta',
    method: { CASH: 'Naqd', CARD: 'Karta', TRANSFER: 'Oʻtkazma', CLICK: 'Click', PAYME: 'Payme' } as Record<PayMethod, string>,
  },
  ru: {
    title: 'Ежедневный отчёт',
    revenue: 'Выручка',
    visits: 'Приёмы',
    completed: 'завершено',
    open: 'открыто',
    newPatients: 'Новые пациенты',
    topServices: 'Топ услуг',
    debts: 'Долги (приёмы за день)',
    noDebts: 'Долгов нет',
    noPayments: 'Оплат нет',
    noServices: 'Услуг нет',
    refunds: 'Возвраты',
    times: 'раз',
    currency: 'сум',
    visitsWord: '',
    patientsWord: '',
    method: { CASH: 'Наличные', CARD: 'Карта', TRANSFER: 'Перевод', CLICK: 'Click', PAYME: 'Payme' } as Record<PayMethod, string>,
  },
} as const;

export interface DailyReportData {
  clinicName: string;
  dateKey: string;
  revenueTotal: number;
  refunds: number;
  byMethod: { method: PayMethod; amount: number }[];
  visitsTotal: number;
  visitsCompleted: number;
  visitsOpen: number;
  newPatients: number;
  topServices: { name: string; nameRu: string; count: number; total: number }[];
  debtsCount: number;
  debtsTotal: number;
}

const METHOD_ORDER: PayMethod[] = ['CASH', 'CARD', 'TRANSFER', 'CLICK', 'PAYME'];

/** Kun boʻyicha agregatlar (Prisma) */
export async function collectDailyReport(clinicId: string, dateKey: string): Promise<DailyReportData> {
  const clinic = await prisma.clinic.findFirst({ where: { id: clinicId }, select: { name: true } });
  if (!clinic) throw new IntegrationError('telegram', 'UNKNOWN', 'clinic not found');
  const { start, end } = dayRangeTz(dateKey);
  const range = { gte: start, lte: end };

  const [payments, visits, newPatients, lines] = await Promise.all([
    prisma.payment.findMany({ where: { clinicId, createdAt: range }, select: { method: true, amount: true } }),
    prisma.visit.findMany({
      where: { clinicId, createdAt: range, status: { not: 'CANCELLED' } },
      select: { status: true, totalNet: true, paidAmount: true },
    }),
    prisma.patient.count({ where: { clinicId, createdAt: range } }),
    prisma.treatmentLine.groupBy({
      by: ['serviceName', 'serviceNameRu'],
      where: { visit: { clinicId, createdAt: range, status: { not: 'CANCELLED' } } },
      _count: { _all: true },
      _sum: { lineTotal: true },
      orderBy: [{ _sum: { lineTotal: 'desc' } }, { _count: { serviceName: 'desc' } }],
      take: 3,
    }),
  ]);

  const byMethodMap = new Map<PayMethod, ReturnType<typeof D>>();
  let refunds = D(0);
  for (const p of payments) {
    const amt = D(p.amount.toString());
    if (amt.isNegative()) refunds = refunds.plus(amt.abs());
    byMethodMap.set(p.method, (byMethodMap.get(p.method) ?? D(0)).plus(amt));
  }
  const byMethod = METHOD_ORDER.filter((m) => byMethodMap.has(m)).map((m) => ({
    method: m,
    amount: (byMethodMap.get(m) ?? D(0)).toDecimalPlaces(0).toNumber(),
  }));
  const revenueTotal = sumMoney(byMethod.map((b) => b.amount)).toNumber();

  let debtsCount = 0;
  let debtsTotal = D(0);
  let completed = 0;
  let open = 0;
  for (const v of visits) {
    if (v.status === 'COMPLETED') completed++;
    else if (v.status === 'OPEN') open++;
    const bal = D(v.totalNet.toString()).minus(D(v.paidAmount.toString()));
    if (bal.gt(0)) {
      debtsCount++;
      debtsTotal = debtsTotal.plus(bal);
    }
  }

  return {
    clinicName: clinic.name,
    dateKey,
    revenueTotal,
    refunds: refunds.toDecimalPlaces(0).toNumber(),
    byMethod,
    visitsTotal: visits.length,
    visitsCompleted: completed,
    visitsOpen: open,
    newPatients,
    topServices: lines.map((l) => ({
      name: l.serviceName,
      nameRu: l.serviceNameRu,
      count: l._count._all,
      total: D((l._sum.lineTotal ?? 0).toString()).toDecimalPlaces(0).toNumber(),
    })),
    debtsCount,
    debtsTotal: debtsTotal.toDecimalPlaces(0).toNumber(),
  };
}

function dateKeyToDisplay(dateKey: string): string {
  const [y, m, d] = dateKey.split('-');
  return `${d ?? ''}.${m ?? ''}.${y ?? ''}`;
}

/** Hisobot maʼlumotlari → Telegram HTML */
export function formatDailyReport(data: DailyReportData, locale: Locale = 'uz'): string {
  const tx = REPORT_TEXT[locale];
  const money = (v: number) => formatMoney(v, { suffix: tx.currency });
  const e = escapeTelegramHtml;
  const lines: string[] = [];
  lines.push(`<b>${e(data.clinicName)} — ${tx.title}</b>`);
  lines.push(`📅 ${dateKeyToDisplay(data.dateKey)}`);
  lines.push('');
  lines.push(`💰 <b>${tx.revenue}: ${e(money(data.revenueTotal))}</b>`);
  if (data.byMethod.length === 0) lines.push(`   ${tx.noPayments}`);
  for (const b of data.byMethod) lines.push(`   • ${tx.method[b.method]}: ${e(money(b.amount))}`);
  if (data.refunds > 0) lines.push(`   ↩️ ${tx.refunds}: ${e(money(data.refunds))}`);
  lines.push('');
  lines.push(
    `🩺 ${tx.visits}: <b>${data.visitsTotal}</b> (${data.visitsCompleted} ${tx.completed}, ${data.visitsOpen} ${tx.open})`,
  );
  lines.push(`🧑‍🤝‍🧑 ${tx.newPatients}: <b>${data.newPatients}</b>`);
  lines.push('');
  lines.push(`⭐ ${tx.topServices}:`);
  if (data.topServices.length === 0) lines.push(`   ${tx.noServices}`);
  data.topServices.forEach((s, i) => {
    const name = locale === 'ru' && s.nameRu ? s.nameRu : s.name;
    lines.push(`   ${i + 1}. ${e(name)} — ${s.count} ${tx.times}, ${e(money(s.total))}`);
  });
  lines.push('');
  if (data.debtsCount > 0) lines.push(`⚠️ ${tx.debts}: <b>${data.debtsCount}</b> — ${e(money(data.debtsTotal))}`);
  else lines.push(`✅ ${tx.noDebts}`);
  return lines.join('\n');
}

/** Klinika kunlik hisoboti (HTML) */
export async function buildDailyReport(clinicId: string, dateKey: string = todayKey(), locale: Locale = 'uz'): Promise<string> {
  const data = await collectDailyReport(clinicId, dateKey);
  return formatDailyReport(data, locale);
}

export interface SendDailyReportResult {
  sent: number;
  failed: number;
  skipped: 'DISABLED' | 'NO_CHAT_IDS' | 'NOT_CONFIGURED' | null;
  chatIds: string[];
  errors: string[];
}

export interface SendDailyReportOptions {
  dateKey?: string;
  locale?: Locale;
  client?: TelegramClient;
  /** Sozlamalardagi `enabled` ni eʼtiborsiz qoldirish (test uchun) */
  force?: boolean;
  /** Faqat shu chatga (test) */
  chatIds?: string[];
}

/** Klinikaning barcha admin chatlariga kunlik hisobot */
export async function sendDailyReport(clinicId: string, opts: SendDailyReportOptions = {}): Promise<SendDailyReportResult> {
  const client = opts.client ?? getTelegramClient();
  const clinic = await prisma.clinic.findFirst({ where: { id: clinicId }, select: { settings: true } });
  if (!clinic) throw new IntegrationError('telegram', 'UNKNOWN', 'clinic not found');
  const tg = parseClinicSettings(clinic.settings).telegram;
  const chatIds = opts.chatIds && opts.chatIds.length > 0 ? opts.chatIds : tg.adminChatIds;
  const base: SendDailyReportResult = { sent: 0, failed: 0, skipped: null, chatIds, errors: [] };
  if (!client.isConfigured()) return { ...base, skipped: 'NOT_CONFIGURED' };
  if (!tg.enabled && !opts.force) return { ...base, skipped: 'DISABLED' };
  if (chatIds.length === 0) return { ...base, skipped: 'NO_CHAT_IDS' };

  const html = await buildDailyReport(clinicId, opts.dateKey ?? todayKey(), opts.locale ?? 'uz');
  for (const chatId of chatIds) {
    try {
      await client.sendMessage(chatId, html, 'HTML');
      base.sent++;
    } catch (e) {
      const err = toIntegrationError(e, 'telegram', 'SEND_FAILED');
      base.failed++;
      base.errors.push(`${chatId}: ${err.code}${err.detail ? ` ${err.detail}` : ''}`);
    }
  }
  return base;
}
