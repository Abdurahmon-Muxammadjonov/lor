import { withPublic, ok } from '@/lib/api';
import { requireCron } from '@/lib/integrations/cron-auth';
import { queueAppointmentReminders } from '@/lib/integrations/notifications';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * GET /api/cron/reminders — sms.reminderHoursBefore ± 30 daqiqa oynasidagi yozilishlar:
 * SmsLog (PENDING, APPOINTMENT_REMINDER) + Appointment.reminderSentAt; Telegram (bemor chat ID boʻlsa).
 */
export const GET = withPublic(async ({ req }) => {
  requireCron(req);
  const started = Date.now();
  const result = await queueAppointmentReminders();
  return ok({ ...result, elapsedMs: Date.now() - started });
});
