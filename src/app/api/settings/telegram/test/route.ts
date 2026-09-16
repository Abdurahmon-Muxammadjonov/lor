import { withAuth, ok, parseBody } from '@/lib/api';
import { getLocale } from '@/i18n/server';
import { TelegramTestSchema } from '@/lib/settings/schemas';
import { getClinicProfile, getSection } from '@/lib/settings/service';
import { escapeTelegramHtml, getTelegramClient, sendDailyReport } from '@/lib/integrations/telegram';
import { IntegrationError, integrationErrorToApiError } from '@/lib/integrations/errors';
import { formatDateInTz, formatTimeInTz } from '@/lib/integrations/http';

export const dynamic = 'force-dynamic';

const TEST_TEXT = {
  uz: (clinic: string, dt: string) => `✅ <b>${escapeTelegramHtml(clinic)}</b>\nLOR CRM: Telegram ulandi. ${dt}`,
  ru: (clinic: string, dt: string) => `✅ <b>${escapeTelegramHtml(clinic)}</b>\nLOR CRM: Telegram подключён. ${dt}`,
} as const;

/**
 * POST /api/settings/telegram/test {chatId?, report?}
 *  - chatId boʻsh → sozlamalardagi barcha admin chatlar
 *  - report=true → haqiqiy kunlik hisobot (bugun), aks holda qisqa test xabari
 */
export const POST = withAuth({ permission: 'settings.write' }, async ({ clinicId, req }) => {
  const locale = getLocale();
  const body = await parseBody(req, TelegramTestSchema);
  const client = getTelegramClient();
  try {
    if (!client.isConfigured()) throw new IntegrationError('telegram', 'NOT_CONFIGURED');
    const [clinic, tg] = await Promise.all([getClinicProfile(clinicId), getSection(clinicId, 'telegram')]);
    const chatIds = body.chatId ? [body.chatId] : tg.adminChatIds;
    if (chatIds.length === 0) throw new IntegrationError('telegram', 'BAD_CHAT_ID');

    if (body.report) {
      const r = await sendDailyReport(clinicId, { chatIds, force: true, locale, client });
      if (r.sent === 0) throw new IntegrationError('telegram', 'SEND_FAILED', r.errors.join('; '));
      return ok({ sent: r.sent, failed: r.failed, chatIds, errors: r.errors });
    }

    const now = new Date();
    const text = TEST_TEXT[locale](clinic.name, `${formatDateInTz(now, clinic.timezone)} ${formatTimeInTz(now, clinic.timezone)}`);
    let sent = 0;
    const errors: string[] = [];
    for (const chatId of chatIds) {
      try {
        await client.sendMessage(chatId, text, 'HTML');
        sent++;
      } catch (e) {
        const err = e instanceof IntegrationError ? e : new IntegrationError('telegram', 'SEND_FAILED', e instanceof Error ? e.message : undefined);
        errors.push(`${chatId}: ${err.detail ?? err.code}`);
      }
    }
    if (sent === 0) throw new IntegrationError('telegram', 'SEND_FAILED', errors.join('; '));
    return ok({ sent, failed: errors.length, chatIds, errors });
  } catch (e) {
    throw integrationErrorToApiError(e, locale, 'telegram');
  }
});
