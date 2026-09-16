import type { QueueType } from '@prisma/client';
import { CLINIC_TZ } from '@/lib/date';
import { formatPhone } from '@/lib/utils';
import { formatQueueNumber, prefixForType } from '@/lib/queue-number';
import type { Locale } from '@/i18n/config';
import { getMessages } from '@/i18n/messages';
import { makeT } from '@/i18n/t';
import type { TicketData } from '@/lib/printer/types';
import type { QueueSettings } from '@/lib/settings/types';

/**
 * Talon maʼlumotlari (TicketData) uchun sof yordamchilar — server va client, DB siz.
 * Sana/vaqt har doim Asia/Tashkent boʻyicha (server qayerda boʻlmasin).
 */

export interface TicketClinicInfo {
  name: string;
  phone: string;
  ticketFooter: string;
}

export interface TicketRowInfo {
  number: string;
  type: QueueType;
  createdAt: Date | string;
  room?: string | null;
  doctor?: { room: string | null } | null;
  /** Oldinda kutayotganlar (maʼlum boʻlsa) */
  ahead?: number;
  /** Taxminiy kutish, daqiqa (maʼlum boʻlsa) */
  waitMin?: number;
}

const dateFmt = new Intl.DateTimeFormat('ru-RU', { timeZone: CLINIC_TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('ru-RU', { timeZone: CLINIC_TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

/** 15.09.2026 (Toshkent) */
export function tzDate(d: Date | string): string {
  return dateFmt.format(new Date(d));
}

/** 14:32 (Toshkent) */
export function tzTime(d: Date | string): string {
  return timeFmt.format(new Date(d));
}

/** Navbat turi nomi joriy tilda: common.queueType.* */
export function queueTypeLabel(type: QueueType, locale: Locale): string {
  return makeT(getMessages(), locale)(`common.queueType.${type}`);
}

/** Tur → prefiks harfi (sozlamalardan) */
export function queuePrefix(type: QueueType, settings: QueueSettings): string {
  return prefixForType(type, settings);
}

/** Tur → keyingi raqam koʻrinishi (masalan "A-007") */
export function queueNumberFor(type: QueueType, seq: number, settings: QueueSettings): string {
  return formatQueueNumber(queuePrefix(type, settings), seq);
}

/** Qator + klinika → printer uchun TicketData */
export function ticketDataFor(row: TicketRowInfo, clinic: TicketClinicInfo, locale: Locale): TicketData {
  const room = (row.room ?? row.doctor?.room ?? '').trim();
  return {
    clinicName: clinic.name,
    phone: formatPhone(clinic.phone) || clinic.phone,
    number: row.number,
    service: queueTypeLabel(row.type, locale),
    date: tzDate(row.createdAt),
    time: tzTime(row.createdAt),
    ahead: Math.max(0, Math.round(row.ahead ?? 0)),
    waitMin: Math.max(0, Math.round(row.waitMin ?? 0)),
    footer: clinic.ticketFooter,
    ...(room ? { room } : {}),
    locale,
  };
}

/** Brauzer (iframe) orqali chop etish sahifasi: /print/ticket/[id] (kiosk uchun ?key=) */
export function ticketPrintUrl(queueId: string, kioskKey?: string | null): string {
  const base = `/print/ticket/${encodeURIComponent(queueId)}`;
  return kioskKey ? `${base}?key=${encodeURIComponent(kioskKey)}` : base;
}
