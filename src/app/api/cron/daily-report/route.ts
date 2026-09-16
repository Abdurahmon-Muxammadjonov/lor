import { withPublic, ok } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/api/audit';
import { todayKey } from '@/lib/date';
import { parseClinicSettings } from '@/lib/settings/types';
import { requireCron } from '@/lib/integrations/cron-auth';
import { hourInTz } from '@/lib/integrations/http';
import { isTelegramConfigured, sendDailyReport } from '@/lib/integrations/telegram';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const REPORT_ENTITY = 'TelegramDailyReport';

/**
 * GET /api/cron/daily-report — telegram.enabled klinikalarga kunlik hisobot.
 * Vercel jadvali: 16:00 UTC (21:00 Toshkent). Soatlik ishga tushirilsa (`0 * * * *`) har klinika oʻz
 * `dailyReportHour` soatida (klinika vaqt zonasida) oladi; bir kunda ikki marta yuborilmaydi (AuditLog belgisi).
 * `?force=1` — soatni eʼtiborsiz qoldirib hozir yuborish (yana ham bir kunda bir marta).
 */
export const GET = withPublic(async ({ req }) => {
  requireCron(req);
  const started = Date.now();
  const force = req.nextUrl.searchParams.get('force') === '1';
  const now = new Date();
  const dateKey = todayKey(now);

  if (!isTelegramConfigured()) return ok({ configured: false, clinics: 0, sent: 0, failed: 0, skipped: 0, elapsedMs: Date.now() - started });

  const clinics = await prisma.clinic.findMany({ where: { isActive: true }, select: { id: true, timezone: true, settings: true } });
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  const details: { clinicId: string; sent: number; failed: number; skipped: string | null }[] = [];

  for (const c of clinics) {
    const tg = parseClinicSettings(c.settings).telegram;
    if (!tg.enabled || tg.adminChatIds.length === 0) {
      skipped++;
      continue;
    }
    // Soat: cron 21:00 da bir marta ishlasa — hour >= dailyReportHour boʻlgan hamma klinika oladi
    if (!force && hourInTz(now, c.timezone) < tg.dailyReportHour) {
      skipped++;
      continue;
    }
    const already = await prisma.auditLog.findFirst({ where: { clinicId: c.id, entity: REPORT_ENTITY, entityId: dateKey }, select: { id: true } });
    if (already) {
      skipped++;
      continue;
    }
    const r = await sendDailyReport(c.id, { dateKey });
    sent += r.sent;
    failed += r.failed;
    details.push({ clinicId: c.id, sent: r.sent, failed: r.failed, skipped: r.skipped });
    if (r.sent > 0) {
      await audit({
        clinicId: c.id,
        userId: null,
        action: 'CREATE',
        entity: REPORT_ENTITY,
        entityId: dateKey,
        after: { sent: r.sent, failed: r.failed, chatIds: r.chatIds, errors: r.errors },
        userAgent: 'cron:daily-report',
      });
    }
  }
  return ok({ configured: true, clinics: clinics.length, sent, failed, skipped, details, elapsedMs: Date.now() - started });
});
