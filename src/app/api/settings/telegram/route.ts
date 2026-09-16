import { withAuth, ok, parseBody } from '@/lib/api';
import { TelegramPatchSchema, type TelegramSettingsDTO } from '@/lib/settings/schemas';
import { getSection, updateSection } from '@/lib/settings/service';
import { getTelegramClient, isTelegramConfigured } from '@/lib/integrations/telegram';

export const dynamic = 'force-dynamic';

const BOT_CACHE_MS = 10 * 60 * 1000;
let botCache: { username: string | null; at: number; token: string } | null = null;

/** Bot username (getMe) — 10 daqiqa keshlanadi; xato boʻlsa null */
async function botUsername(): Promise<string | null> {
  if (!isTelegramConfigured()) return null;
  const token = process.env.TELEGRAM_BOT_TOKEN ?? '';
  if (botCache && botCache.token === token && Date.now() - botCache.at < BOT_CACHE_MS) return botCache.username;
  let username: string | null = null;
  try {
    username = (await getTelegramClient().getMe()).username;
  } catch {
    username = null;
  }
  botCache = { username, at: Date.now(), token };
  return username;
}

/** GET /api/settings/telegram — boʻlim + bot holati */
export const GET = withAuth({ permission: 'settings.view' }, async ({ clinicId }) => {
  const [telegram, username] = await Promise.all([getSection(clinicId, 'telegram'), botUsername()]);
  const dto: TelegramSettingsDTO = { telegram, configured: isTelegramConfigured(), botUsername: username };
  return ok(dto);
});

/** PATCH /api/settings/telegram */
export const PATCH = withAuth({ permission: 'settings.write' }, async ({ user, clinicId, req, ip }) => {
  const body = await parseBody(req, TelegramPatchSchema);
  const telegram = await updateSection(clinicId, 'telegram', body, { user, ip, userAgent: req.headers.get('user-agent') });
  const dto: TelegramSettingsDTO = { telegram, configured: isTelegramConfigured(), botUsername: await botUsername() };
  return ok(dto);
});
