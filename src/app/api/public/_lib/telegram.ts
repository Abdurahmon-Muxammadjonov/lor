import type { Lead } from '@/components/landing/lead-schema';
import { formatPhone } from '@/lib/utils';

/**
 * Telegram ga soʻrovni yuborish — kichik mustaqil fetch (settings modulidan import qilinmaydi).
 * TELEGRAM_BOT_TOKEN va TELEGRAM_ADMIN_CHAT_ID boʻlmasa hech narsa qilmaydi (false qaytaradi).
 */

const TG_TIMEOUT_MS = 6000;

export function escapeTelegramHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Admin uchun HTML formatdagi xabar */
export function formatLeadMessage(lead: Lead, meta: { ip?: string | null; receivedAt?: Date } = {}): string {
  const at = (meta.receivedAt ?? new Date()).toLocaleString('ru-RU', {
    timeZone: 'Asia/Tashkent',
    hour12: false,
  });
  const lines = [
    '🆕 <b>Yangi soʻrov — LOR CRM landing</b>',
    '',
    `👤 <b>Ism:</b> ${escapeTelegramHtml(lead.name)}`,
    `📞 <b>Telefon:</b> ${escapeTelegramHtml(formatPhone(lead.phone) || lead.phone)}`,
    `🏥 <b>Klinika:</b> ${escapeTelegramHtml(lead.clinic)}`,
  ];
  if (lead.message) lines.push(`💬 <b>Xabar:</b> ${escapeTelegramHtml(lead.message)}`);
  lines.push(
    '',
    `🌐 ${lead.locale.toUpperCase()} · ${escapeTelegramHtml(lead.source)}${meta.ip ? ` · IP ${escapeTelegramHtml(meta.ip)}` : ''}`,
  );
  lines.push(`🕒 ${at}`);
  return lines.join('\n');
}

export function isTelegramConfigured(): boolean {
  return Boolean(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_ADMIN_CHAT_ID);
}

/** Xabarni admin chatiga yuboradi. Xatolarni yutadi (lead baribir saqlangan). */
export async function notifyTelegramAdmin(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!token || !chatId) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TG_TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
      signal: controller.signal,
    });
    return res.ok;
  } catch (err) {
    console.error('[lead] telegram forward failed', err instanceof Error ? err.message : err);
    return false;
  } finally {
    clearTimeout(timer);
  }
}
