import { ApiError } from '@/lib/api/errors';
import type { Locale } from '@/i18n/config';

/**
 * Tashqi integratsiyalar (Eskiz, Telegram, Click, Payme) xatolari.
 * Xabarlar ikki tilda — API javobida joriy til tanlanadi, `details.messages` da ikkalasi ham.
 */
export type IntegrationErrorCode =
  | 'NOT_CONFIGURED'
  | 'AUTH_FAILED'
  | 'SEND_FAILED'
  | 'BAD_PHONE'
  | 'BAD_CHAT_ID'
  | 'HTTP_ERROR'
  | 'TIMEOUT'
  | 'DISABLED'
  | 'UNKNOWN';

export type IntegrationName = 'eskiz' | 'telegram' | 'click' | 'payme';

const MESSAGES: Record<IntegrationName, Record<IntegrationErrorCode, { uz: string; ru: string }>> = {
  eskiz: {
    NOT_CONFIGURED: {
      uz: 'SMS xizmati sozlanmagan: serverda ESKIZ_EMAIL va ESKIZ_PASSWORD kiritilmagan',
      ru: 'SMS-сервис не настроен: на сервере не заданы ESKIZ_EMAIL и ESKIZ_PASSWORD',
    },
    AUTH_FAILED: { uz: 'Eskiz: login yoki parol notoʻgʻri', ru: 'Eskiz: неверный логин или пароль' },
    SEND_FAILED: { uz: 'Eskiz: SMS yuborilmadi', ru: 'Eskiz: SMS не отправлено' },
    BAD_PHONE: { uz: 'Telefon raqami notoʻgʻri (998XXXXXXXXX)', ru: 'Неверный номер телефона (998XXXXXXXXX)' },
    BAD_CHAT_ID: { uz: 'Chat ID notoʻgʻri', ru: 'Неверный chat ID' },
    HTTP_ERROR: { uz: 'Eskiz serveri xato qaytardi', ru: 'Сервер Eskiz вернул ошибку' },
    TIMEOUT: { uz: 'Eskiz serveri javob bermadi (vaqt tugadi)', ru: 'Сервер Eskiz не ответил (тайм-аут)' },
    DISABLED: { uz: 'SMS yuborish klinika sozlamalarida oʻchirilgan', ru: 'Отправка SMS отключена в настройках клиники' },
    UNKNOWN: { uz: 'SMS xizmatida nomaʼlum xato', ru: 'Неизвестная ошибка SMS-сервиса' },
  },
  telegram: {
    NOT_CONFIGURED: {
      uz: 'Telegram bot sozlanmagan: serverda TELEGRAM_BOT_TOKEN kiritilmagan',
      ru: 'Telegram-бот не настроен: на сервере не задан TELEGRAM_BOT_TOKEN',
    },
    AUTH_FAILED: { uz: 'Telegram: bot tokeni notoʻgʻri', ru: 'Telegram: неверный токен бота' },
    SEND_FAILED: {
      uz: 'Telegram: xabar yuborilmadi (chat botni bloklagan yoki chat ID notoʻgʻri)',
      ru: 'Telegram: сообщение не отправлено (чат заблокировал бота или неверный chat ID)',
    },
    BAD_PHONE: { uz: 'Telefon raqami notoʻgʻri', ru: 'Неверный номер телефона' },
    BAD_CHAT_ID: {
      uz: 'Chat ID koʻrsatilmagan: sozlamalarga admin chat ID qoʻshing',
      ru: 'Chat ID не указан: добавьте chat ID администратора в настройки',
    },
    HTTP_ERROR: { uz: 'Telegram serveri xato qaytardi', ru: 'Сервер Telegram вернул ошибку' },
    TIMEOUT: { uz: 'Telegram serveri javob bermadi (vaqt tugadi)', ru: 'Сервер Telegram не ответил (тайм-аут)' },
    DISABLED: { uz: 'Telegram klinika sozlamalarida oʻchirilgan', ru: 'Telegram отключён в настройках клиники' },
    UNKNOWN: { uz: 'Telegram xizmatida nomaʼlum xato', ru: 'Неизвестная ошибка Telegram' },
  },
  click: {
    NOT_CONFIGURED: {
      uz: 'Click sozlanmagan: CLICK_MERCHANT_ID, CLICK_SERVICE_ID va CLICK_SECRET_KEY kerak',
      ru: 'Click не настроен: нужны CLICK_MERCHANT_ID, CLICK_SERVICE_ID и CLICK_SECRET_KEY',
    },
    AUTH_FAILED: { uz: 'Click: imzo notoʻgʻri', ru: 'Click: неверная подпись' },
    SEND_FAILED: { uz: 'Click: soʻrov bajarilmadi', ru: 'Click: запрос не выполнен' },
    BAD_PHONE: { uz: 'Telefon raqami notoʻgʻri', ru: 'Неверный номер телефона' },
    BAD_CHAT_ID: { uz: 'Notoʻgʻri identifikator', ru: 'Неверный идентификатор' },
    HTTP_ERROR: { uz: 'Click serveri xato qaytardi', ru: 'Сервер Click вернул ошибку' },
    TIMEOUT: { uz: 'Click serveri javob bermadi', ru: 'Сервер Click не ответил' },
    DISABLED: { uz: 'Click oʻchirilgan', ru: 'Click отключён' },
    UNKNOWN: { uz: 'Click: nomaʼlum xato', ru: 'Click: неизвестная ошибка' },
  },
  payme: {
    NOT_CONFIGURED: {
      uz: 'Payme sozlanmagan: PAYME_MERCHANT_ID va PAYME_KEY kerak',
      ru: 'Payme не настроен: нужны PAYME_MERCHANT_ID и PAYME_KEY',
    },
    AUTH_FAILED: { uz: 'Payme: avtorizatsiya xato', ru: 'Payme: ошибка авторизации' },
    SEND_FAILED: { uz: 'Payme: soʻrov bajarilmadi', ru: 'Payme: запрос не выполнен' },
    BAD_PHONE: { uz: 'Telefon raqami notoʻgʻri', ru: 'Неверный номер телефона' },
    BAD_CHAT_ID: { uz: 'Notoʻgʻri identifikator', ru: 'Неверный идентификатор' },
    HTTP_ERROR: { uz: 'Payme serveri xato qaytardi', ru: 'Сервер Payme вернул ошибку' },
    TIMEOUT: { uz: 'Payme serveri javob bermadi', ru: 'Сервер Payme не ответил' },
    DISABLED: { uz: 'Payme oʻchirilgan', ru: 'Payme отключён' },
    UNKNOWN: { uz: 'Payme: nomaʼlum xato', ru: 'Payme: неизвестная ошибка' },
  },
};

export class IntegrationError extends Error {
  constructor(
    public integration: IntegrationName,
    public code: IntegrationErrorCode,
    /** Provayderdan kelgan xom matn (log/diagnostika uchun) */
    public detail?: string,
    public override cause?: unknown,
  ) {
    super(`${integration}:${code}${detail ? ` (${detail})` : ''}`);
    this.name = 'IntegrationError';
  }

  messages(): { uz: string; ru: string } {
    return MESSAGES[this.integration][this.code];
  }

  localized(locale: Locale): string {
    return this.messages()[locale];
  }
}

export function isIntegrationError(e: unknown): e is IntegrationError {
  return e instanceof IntegrationError;
}

/** Nomaʼlum xatoni IntegrationError ga keltirish */
export function toIntegrationError(e: unknown, integration: IntegrationName, fallback: IntegrationErrorCode = 'UNKNOWN'): IntegrationError {
  if (e instanceof IntegrationError) return e;
  if (e instanceof Error && e.name === 'AbortError') return new IntegrationError(integration, 'TIMEOUT', e.message, e);
  if (e instanceof Error && e.name === 'TimeoutError') return new IntegrationError(integration, 'TIMEOUT', e.message, e);
  return new IntegrationError(integration, fallback, e instanceof Error ? e.message : String(e), e);
}

/** IntegrationError → ApiError(400 INTEGRATION_ERROR) — xabar joriy tilda, details da ikkala til */
export function integrationErrorToApiError(e: unknown, locale: Locale, integration: IntegrationName): ApiError {
  if (e instanceof ApiError) return e;
  const err = toIntegrationError(e, integration);
  const status = err.code === 'TIMEOUT' ? 504 : err.code === 'HTTP_ERROR' || err.code === 'SEND_FAILED' ? 502 : 400;
  return new ApiError(status, 'INTEGRATION_ERROR', err.localized(locale), {
    integration: err.integration,
    code: err.code,
    detail: err.detail,
    messages: err.messages(),
  });
}
