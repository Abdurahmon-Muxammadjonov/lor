import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { dayRangeTz, todayKey } from '@/lib/date';
import { formatPhone } from '@/lib/utils';
import { parseClinicSettings, type ClinicSettings } from '@/lib/settings/types';
import { renderTemplate } from './eskiz';
import { escapeTelegramHtml, getTelegramClient, type TelegramClient } from './telegram';
import { dateKeyInTz, formatDateInTz, formatTimeInTz } from './http';

/**
 * Cron vazifalari uchun bildirishnomalar (FAQAT SERVER):
 *  - queueAppointmentReminders: sms.reminderHoursBefore ± 30 daqiqa oynasidagi yozilishlar → SmsLog (PENDING) + reminderSentAt;
 *    bemorda telegramChatId boʻlsa va telegram.patientReminders yoqilgan boʻlsa — Telegram xabari ham.
 *  - queueBirthdaySms: bugun tugʻilgan bemorlar (kuniga bir marta) → SmsLog (BIRTHDAY).
 * SMS matni faqat SmsLog ga yoziladi — yetkazishni /api/cron/sms (deliverPendingSms) bajaradi.
 */

export const REMINDER_WINDOW_MS = 30 * 60 * 1000;

interface ClinicRow {
  id: string;
  name: string;
  phone: string;
  timezone: string;
  settings: ClinicSettings;
}

async function loadActiveClinics(clinicId?: string): Promise<ClinicRow[]> {
  const rows = await prisma.clinic.findMany({
    where: { isActive: true, ...(clinicId ? { id: clinicId } : {}) },
    select: { id: true, name: true, phone: true, timezone: true, settings: true },
  });
  return rows.map((c) => ({ id: c.id, name: c.name, phone: c.phone, timezone: c.timezone, settings: parseClinicSettings(c.settings) }));
}

export type ReminderVars = {
  clinic: string;
  name: string;
  date: string;
  time: string;
  doctor: string;
  phone: string;
};

export function reminderVars(clinic: Pick<ClinicRow, 'name' | 'phone' | 'timezone'>, a: { startAt: Date; patientName: string; doctorName: string }): ReminderVars {
  return {
    clinic: clinic.name,
    name: a.patientName,
    date: formatDateInTz(a.startAt, clinic.timezone),
    time: formatTimeInTz(a.startAt, clinic.timezone),
    doctor: a.doctorName,
    phone: formatPhone(clinic.phone) || clinic.phone,
  };
}

export interface ReminderRunResult {
  clinics: number;
  appointments: number;
  sms: number;
  telegram: number;
  telegramFailed: number;
}

export interface NotificationRunOptions {
  now?: Date;
  clinicId?: string;
  telegram?: TelegramClient;
}

/** Yozilish eslatmalari (sms.reminderHoursBefore soat oldin, ±30 daqiqa) */
export async function queueAppointmentReminders(opts: NotificationRunOptions = {}): Promise<ReminderRunResult> {
  const now = opts.now ?? new Date();
  const tg = opts.telegram ?? getTelegramClient();
  const clinics = await loadActiveClinics(opts.clinicId);
  const result: ReminderRunResult = { clinics: 0, appointments: 0, sms: 0, telegram: 0, telegramFailed: 0 };

  for (const clinic of clinics) {
    const { sms, telegram } = clinic.settings;
    const smsOn = sms.enabled;
    const tgOn = telegram.enabled && telegram.patientReminders && tg.isConfigured();
    if (!smsOn && !tgOn) continue;
    result.clinics++;

    const center = now.getTime() + sms.reminderHoursBefore * 60 * 60 * 1000;
    const appointments = await prisma.appointment.findMany({
      where: {
        clinicId: clinic.id,
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
        reminderSentAt: null,
        startAt: { gte: new Date(center - REMINDER_WINDOW_MS), lte: new Date(center + REMINDER_WINDOW_MS) },
      },
      select: {
        id: true,
        startAt: true,
        patient: { select: { id: true, fullName: true, phone: true, smsConsent: true, telegramChatId: true } },
        doctor: { select: { fullName: true } },
      },
      orderBy: { startAt: 'asc' },
      take: 500,
    });

    for (const a of appointments) {
      const vars = reminderVars(clinic, { startAt: a.startAt, patientName: a.patient.fullName, doctorName: a.doctor.fullName });
      const text = renderTemplate(sms.reminderTemplate, vars);
      const ops: Prisma.PrismaPromise<unknown>[] = [];
      let queued = false;

      if (smsOn && a.patient.smsConsent && a.patient.phone) {
        ops.push(
          prisma.smsLog.create({
            data: { clinicId: clinic.id, patientId: a.patient.id, phone: a.patient.phone, text, kind: 'APPOINTMENT_REMINDER', status: 'PENDING' },
          }),
        );
        queued = true;
        result.sms++;
      }

      if (tgOn && a.patient.telegramChatId) {
        try {
          await tg.sendMessage(a.patient.telegramChatId, `🔔 ${escapeTelegramHtml(text)}`, 'HTML');
          result.telegram++;
          queued = true;
        } catch {
          result.telegramFailed++;
        }
      }

      if (queued) {
        ops.push(prisma.appointment.update({ where: { id: a.id }, data: { reminderSentAt: now } }));
        await prisma.$transaction(ops);
        result.appointments++;
      } else {
        // Bemorda SMS roziligi ham, Telegram ham yoʻq — qayta-qayta tekshirmaslik uchun belgilab qoʻyamiz
        await prisma.appointment.update({ where: { id: a.id }, data: { reminderSentAt: now } });
      }
    }
  }
  return result;
}

export interface BirthdayRunResult {
  clinics: number;
  patients: number;
  sms: number;
  skipped: number;
}

/** Bugun tugʻilgan bemorlar → tabrik SMS (kuniga bir marta, faqat sms.enabled va smsConsent) */
export async function queueBirthdaySms(opts: NotificationRunOptions = {}): Promise<BirthdayRunResult> {
  const now = opts.now ?? new Date();
  const clinics = await loadActiveClinics(opts.clinicId);
  const result: BirthdayRunResult = { clinics: 0, patients: 0, sms: 0, skipped: 0 };

  for (const clinic of clinics) {
    const { sms } = clinic.settings;
    if (!sms.enabled) continue;
    result.clinics++;
    const key = dateKeyInTz(now, clinic.timezone);
    const [, mm, dd] = key.split('-').map(Number);
    if (!mm || !dd) continue;

    const rows = await prisma.$queryRaw<{ id: string; fullName: string; phone: string }[]>(Prisma.sql`
      SELECT "id", "fullName", "phone" FROM "Patient"
      WHERE "clinicId" = ${clinic.id} AND "smsConsent" = true
        AND EXTRACT(MONTH FROM "birthDate") = ${mm} AND EXTRACT(DAY FROM "birthDate") = ${dd}
      ORDER BY "fullName" ASC
      LIMIT 500
    `);
    if (rows.length === 0) continue;

    const { start, end } = dayRangeTz(todayKey(now));
    const already = await prisma.smsLog.findMany({
      where: { clinicId: clinic.id, kind: 'BIRTHDAY', createdAt: { gte: start, lte: end }, patientId: { in: rows.map((r) => r.id) } },
      select: { patientId: true },
    });
    const done = new Set(already.map((a) => a.patientId));

    const data: Prisma.SmsLogCreateManyInput[] = [];
    for (const p of rows) {
      result.patients++;
      if (done.has(p.id) || !p.phone) {
        result.skipped++;
        continue;
      }
      const text = renderTemplate(sms.birthdayTemplate, {
        clinic: clinic.name,
        name: p.fullName,
        phone: formatPhone(clinic.phone) || clinic.phone,
        date: formatDateInTz(now, clinic.timezone),
        time: formatTimeInTz(now, clinic.timezone),
        doctor: '',
      });
      data.push({ clinicId: clinic.id, patientId: p.id, phone: p.phone, text, kind: 'BIRTHDAY', status: 'PENDING' });
    }
    if (data.length) {
      await prisma.smsLog.createMany({ data });
      result.sms += data.length;
    }
  }
  return result;
}

/** Yozilish tasdigʻi (boshqa modullar uchun yordamchi): SmsLog (PENDING) + confirmSentAt */
export async function queueAppointmentConfirmation(appointmentId: string, clinicId: string): Promise<{ queued: boolean }> {
  const [clinic, a] = await Promise.all([
    prisma.clinic.findFirst({ where: { id: clinicId }, select: { name: true, phone: true, timezone: true, settings: true } }),
    prisma.appointment.findFirst({
      where: { id: appointmentId, clinicId },
      select: {
        id: true,
        startAt: true,
        confirmSentAt: true,
        patient: { select: { id: true, fullName: true, phone: true, smsConsent: true } },
        doctor: { select: { fullName: true } },
      },
    }),
  ]);
  if (!clinic || !a) return { queued: false };
  const settings = parseClinicSettings(clinic.settings);
  if (!settings.sms.enabled || !a.patient.smsConsent || !a.patient.phone || a.confirmSentAt) return { queued: false };
  const text = renderTemplate(
    settings.sms.confirmTemplate,
    reminderVars({ name: clinic.name, phone: clinic.phone, timezone: clinic.timezone }, { startAt: a.startAt, patientName: a.patient.fullName, doctorName: a.doctor.fullName }),
  );
  await prisma.$transaction([
    prisma.smsLog.create({ data: { clinicId, patientId: a.patient.id, phone: a.patient.phone, text, kind: 'APPOINTMENT_CONFIRM', status: 'PENDING' } }),
    prisma.appointment.update({ where: { id: a.id }, data: { confirmSentAt: new Date() } }),
  ]);
  return { queued: true };
}
