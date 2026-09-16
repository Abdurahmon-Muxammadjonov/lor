import type { Transporter } from 'nodemailer';
import type { Locale } from '@/i18n/config';
import { getMessages } from '@/i18n/messages';
import { makeT } from '@/i18n/t';

/**
 * Email yuborish (parolni tiklash).
 * SMTP_HOST sozlangan boʻlsa — nodemailer orqali yuboriladi.
 * Aks holda (dev rejimi) xat konsolga aniq formatda chiqariladi va `{ delivered: false }` qaytadi —
 * bu hujjatlashtirilgan dev fallback: havolani konsoldan olib brauzerga qoʻyish mumkin.
 */

export interface MailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface MailResult {
  delivered: boolean;
  messageId?: string;
}

export function isMailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST?.trim());
}

export function mailFrom(): string {
  return process.env.SMTP_FROM?.trim() || 'LOR CRM <noreply@lor.uz>';
}

let transporter: Transporter | null = null;

async function getTransporter(): Promise<Transporter> {
  if (transporter) return transporter;
  const nodemailer = await import('nodemailer');
  const port = Number(process.env.SMTP_PORT ?? 587) || 587;
  const user = process.env.SMTP_USER?.trim();
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST?.trim(),
    port,
    secure: port === 465,
    auth: user ? { user, pass: process.env.SMTP_PASS ?? '' } : undefined,
  });
  return transporter;
}

/** Konsol uchun ramkali dev-xabar */
export function formatDevMail(input: MailInput): string {
  const line = '─'.repeat(72);
  const body = input.text
    .split('\n')
    .map((l) => `│ ${l}`)
    .join('\n');
  return [
    `┌${line}`,
    '│ LOR CRM · DEV MAIL — SMTP sozlanmagan, xat yuborilmadi (konsolga chiqarildi)',
    `│ To:      ${input.to}`,
    `│ Subject: ${input.subject}`,
    '│',
    body,
    `└${line}`,
  ].join('\n');
}

export async function sendMail(input: MailInput): Promise<MailResult> {
  if (!isMailConfigured()) {
    console.info(formatDevMail(input));
    return { delivered: false };
  }
  const t = await getTransporter();
  const info = await t.sendMail({
    from: mailFrom(),
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
  return { delivered: true, messageId: info.messageId };
}

// ───────────────────────────── Shablonlar ─────────────────────────────

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);
}

export interface ResetEmailParams {
  name: string;
  url: string;
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

const PALETTE = {
  bgBase: '#060810',
  bgElevated: '#0d1220',
  surface: '#131a2b',
  border: '#1f2a40',
  accent: '#00d4ff',
  accent2: '#7c5cff',
  text: '#eaf0ff',
  muted: '#8a99b8',
} as const;

/**
 * Parolni tiklash xati: asosiy til — `locale`, pastida ikkinchi tildagi qisqa izoh (ikki tilli).
 * Qorongʻi karta, gradient tugma, matnli (text/plain) muqobil.
 */
export function resetEmailTemplate(locale: Locale, params: ResetEmailParams): EmailTemplate {
  const messages = getMessages();
  const other: Locale = locale === 'uz' ? 'ru' : 'uz';
  const t = makeT(messages, locale);
  const t2 = makeT(messages, other);

  const name = params.name.trim() || (locale === 'ru' ? 'коллега' : 'hamkasb');
  const url = params.url;

  const subject = t('auth.email.subject');
  const greeting = t('auth.email.greeting', { name });
  const body = t('auth.email.body');
  const button = t('auth.email.button');
  const ignore = t('auth.email.ignore');
  const altLink = t('auth.email.altLink');
  const footer = t('auth.email.footer');

  const secondaryBody = t2('auth.email.body');
  const secondaryButton = t2('auth.email.button');
  const secondaryIgnore = t2('auth.email.ignore');

  const lang = locale === 'ru' ? 'ru' : 'uz-Latn';
  const eUrl = escapeHtml(url);

  const html = `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:${PALETTE.bgBase};color:${PALETTE.text};font-family:Inter,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${escapeHtml(body)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PALETTE.bgBase};padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
        <tr>
          <td style="padding:0 0 20px 4px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,${PALETTE.accent} 0%,${PALETTE.accent2} 100%);text-align:center;vertical-align:middle;font-weight:800;font-size:15px;color:${PALETTE.bgBase};letter-spacing:-0.02em;">LOR</td>
                <td style="padding-left:10px;font-weight:700;font-size:16px;color:${PALETTE.text};letter-spacing:-0.02em;">LOR CRM</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:${PALETTE.surface};border:1px solid ${PALETTE.border};border-radius:16px;padding:32px 28px;">
            <h1 style="margin:0 0 12px;font-size:22px;line-height:1.25;font-weight:700;color:${PALETTE.text};letter-spacing:-0.02em;">${escapeHtml(greeting)}</h1>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:${PALETTE.muted};">${escapeHtml(body)}</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
              <tr>
                <td style="border-radius:10px;background:${PALETTE.accent};background-image:linear-gradient(135deg,${PALETTE.accent} 0%,${PALETTE.accent2} 100%);">
                  <a href="${eUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:14px 26px;font-size:15px;font-weight:700;color:${PALETTE.bgBase};text-decoration:none;border-radius:10px;">${escapeHtml(button)}</a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 6px;font-size:13px;line-height:1.5;color:${PALETTE.muted};">${escapeHtml(altLink)}</p>
            <p style="margin:0 0 24px;font-size:12px;line-height:1.5;word-break:break-all;"><a href="${eUrl}" style="color:${PALETTE.accent};text-decoration:underline;">${eUrl}</a></p>
            <p style="margin:0;padding-top:20px;border-top:1px solid ${PALETTE.border};font-size:13px;line-height:1.55;color:${PALETTE.muted};">${escapeHtml(ignore)}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 4px 0;">
            <p lang="${other === 'ru' ? 'ru' : 'uz-Latn'}" style="margin:0 0 6px;font-size:12px;line-height:1.55;color:${PALETTE.muted};">${escapeHtml(secondaryBody)} <a href="${eUrl}" style="color:${PALETTE.accent};text-decoration:underline;">${escapeHtml(secondaryButton)}</a></p>
            <p lang="${other === 'ru' ? 'ru' : 'uz-Latn'}" style="margin:0 0 16px;font-size:12px;line-height:1.55;color:${PALETTE.muted};">${escapeHtml(secondaryIgnore)}</p>
            <p style="margin:0;font-size:11px;line-height:1.5;color:${PALETTE.muted};opacity:0.8;">${escapeHtml(footer)}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  const text = [
    greeting,
    '',
    body,
    '',
    `${button}: ${url}`,
    '',
    ignore,
    '',
    '— — —',
    secondaryBody,
    `${secondaryButton}: ${url}`,
    secondaryIgnore,
    '',
    footer,
  ].join('\n');

  return { subject, html, text };
}
