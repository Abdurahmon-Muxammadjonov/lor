import { withAuth, ok, parseBody, audit, ApiError } from '@/lib/api';
import { prisma } from '@/lib/prisma';
import { formatMoney } from '@/lib/money';
import { formatPhone } from '@/lib/utils';
import { DebtReminderSchema } from '@/lib/reports/schemas';
import { patientDebt } from '@/lib/reports/queries';
import { debtReminderText } from '@/lib/reports/period';
import { assertReportAccess } from '@/lib/reports/api';
import type { DebtReminderResultDTO } from '@/lib/reports/types';

export const dynamic = 'force-dynamic';

const REMIND_COOLDOWN_MS = 24 * 60 * 60 * 1000;

/**
 * POST /api/reports/debtors/remind {patientId, locale?} — qarz haqida SMS eslatma:
 * SmsLog ga PENDING yozuv qoʻshiladi, sozlamalar modulining croni (/api/cron/sms) yuboradi.
 */
export const POST = withAuth({ permission: 'reports.view' }, async ({ user, clinicId, req, ip }) => {
  assertReportAccess(user.role, 'debtors');
  const body = await parseBody(req, DebtReminderSchema);

  const [patient, clinic] = await Promise.all([
    prisma.patient.findFirst({
      where: { id: body.patientId, clinicId },
      select: { id: true, fullName: true, phone: true, smsConsent: true },
    }),
    prisma.clinic.findFirst({ where: { id: clinicId }, select: { name: true, phone: true } }),
  ]);
  if (!patient || !clinic) throw ApiError.notFound();
  if (!patient.smsConsent) throw ApiError.validation(undefined, body.locale === 'ru' ? 'Пациент не дал согласие на SMS' : 'Bemor SMS olishga rozi emas');
  if (!patient.phone) throw ApiError.validation(undefined, body.locale === 'ru' ? 'Нет номера телефона' : 'Telefon raqami yoʻq');

  const debt = await patientDebt(clinicId, patient.id);
  if (debt <= 0) throw ApiError.validation(undefined, body.locale === 'ru' ? 'У пациента нет задолженности' : 'Bemorda qarz yoʻq');

  const recent = await prisma.smsLog.findFirst({
    where: {
      clinicId,
      patientId: patient.id,
      kind: 'CUSTOM',
      status: { in: ['PENDING', 'SENT'] },
      createdAt: { gte: new Date(Date.now() - REMIND_COOLDOWN_MS) },
    },
    select: { id: true },
  });
  if (recent) throw ApiError.conflict(body.locale === 'ru' ? 'Напоминание уже отправлено за последние 24 часа' : 'Soʻnggi 24 soatda eslatma yuborilgan');

  const text = debtReminderText(body.locale, {
    clinic: clinic.name,
    name: patient.fullName,
    amount: formatMoney(debt, { suffix: '' }),
    phone: formatPhone(clinic.phone) || clinic.phone,
  });

  const row = await prisma.$transaction(async (tx) => {
    const created = await tx.smsLog.create({
      data: { clinicId, patientId: patient.id, phone: patient.phone, text, kind: 'CUSTOM', status: 'PENDING' },
      select: { id: true, phone: true, text: true },
    });
    await audit(
      { clinicId, userId: user.id, action: 'CREATE', entity: 'SmsLog', entityId: created.id, after: { patientId: patient.id, debt, kind: 'DEBT_REMINDER' }, ip },
      tx,
    );
    return created;
  });

  const result: DebtReminderResultDTO = { id: row.id, phone: row.phone, text: row.text };
  return ok(result);
});
