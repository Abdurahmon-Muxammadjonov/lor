import { withAuth, ok, parseBody } from '@/lib/api';
import { getLocale } from '@/i18n/server';
import { SmsTestSchema } from '@/lib/settings/schemas';
import { getClinicProfile, getSection } from '@/lib/settings/service';
import { getEskizClient, renderTemplate, sendSmsNow } from '@/lib/integrations/eskiz';
import { integrationErrorToApiError } from '@/lib/integrations/errors';
import { formatDateInTz, formatTimeInTz } from '@/lib/integrations/http';
import { formatPhone } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const TEST_TEXT = {
  uz: '{clinic}: LOR CRM test SMS. Sana {date}, vaqt {time}. Tel: {phone}',
  ru: '{clinic}: тестовое SMS LOR CRM. Дата {date}, время {time}. Тел: {phone}',
} as const;

/** POST /api/settings/sms/test {phone, text?} — Eskiz orqali darhol yuborish (SmsLog CUSTOM) */
export const POST = withAuth({ permission: 'settings.write' }, async ({ clinicId, req }) => {
  const locale = getLocale();
  const body = await parseBody(req, SmsTestSchema);
  const [clinic, sms] = await Promise.all([getClinicProfile(clinicId), getSection(clinicId, 'sms')]);
  const now = new Date();
  const text = renderTemplate(body.text?.trim() || TEST_TEXT[locale], {
    clinic: clinic.name,
    name: '',
    date: formatDateInTz(now, clinic.timezone),
    time: formatTimeInTz(now, clinic.timezone),
    doctor: '',
    phone: formatPhone(clinic.phone) || clinic.phone,
  });
  try {
    const client = getEskizClient();
    const result = await sendSmsNow({ clinicId, phone: body.phone, text, kind: 'CUSTOM', from: sms.from, client });
    return ok({ ...result, text });
  } catch (e) {
    throw integrationErrorToApiError(e, locale, 'eskiz');
  }
});
