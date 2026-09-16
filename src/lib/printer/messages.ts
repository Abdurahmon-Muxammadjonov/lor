import type { Locale } from '@/i18n/config';
import type { PrinterErrorCode } from './types';

/**
 * Printer kutubxonasining ikki tilli lugʻati. Talon/chek shablonlari va usePrinter() toastlari shu yerdan oladi.
 * (`src/i18n/messages/queue.ts` navbat moduliga tegishli — shuning uchun alohida.)
 * Apostrof: ʻ (U+02BB), tutuq: ʼ (U+02BC).
 */
export interface PrinterDict {
  ticket: {
    title: string;
    service: string;
    room: string;
    date: string;
    time: string;
    ahead: string;
    aheadUnit: string;
    wait: string;
    waitUnit: string;
    phone: string;
  };
  receipt: {
    title: string;
    no: string;
    patient: string;
    card: string;
    doctor: string;
    colService: string;
    colQty: string;
    colPrice: string;
    colTotal: string;
    subtotal: string;
    discount: string;
    total: string;
    paid: string;
    balance: string;
    debt: string;
    overpaid: string;
    cashier: string;
    date: string;
    phone: string;
    currency: string;
    side: Record<'LEFT' | 'RIGHT' | 'BOTH', string>;
    organ: Record<'EAR' | 'NOSE' | 'THROAT' | 'LARYNX' | 'OTHER', string>;
  };
  test: {
    title: string;
    transport: string;
    paper: string;
    codepage: string;
    sampleUz: string;
    sampleRu: string;
    rowLeft: string;
    rowRight: string;
    ok: string;
  };
  toast: {
    ticketPrinted: string;
    receiptPrinted: string;
    testPrinted: string;
    fallbackUsed: string;
    printing: string;
    failed: string;
    browserTestHint: string;
  };
  errors: Record<PrinterErrorCode, string>;
}

const uz: PrinterDict = {
  ticket: {
    title: 'NAVBAT RAQAMI',
    service: 'Xizmat',
    room: 'Xona',
    date: 'Sana',
    time: 'Vaqt',
    ahead: 'Oldingizda',
    aheadUnit: '{n} kishi',
    wait: 'Taxminiy kutish',
    waitUnit: '~{n} daqiqa',
    phone: 'Tel',
  },
  receipt: {
    title: 'KASSA CHEKI',
    no: 'Chek №',
    patient: 'Bemor',
    card: 'Karta',
    doctor: 'Shifokor',
    colService: 'Xizmat',
    colQty: 'Miqd.',
    colPrice: 'Narx',
    colTotal: 'Jami',
    subtotal: 'Jami',
    discount: 'Chegirma',
    total: 'JAMI',
    paid: 'Toʻlangan',
    balance: 'Qoldiq',
    debt: 'Qarz',
    overpaid: 'Ortiqcha toʻlov',
    cashier: 'Kassir',
    date: 'Sana',
    phone: 'Tel',
    currency: 'soʻm',
    side: { LEFT: 'chap', RIGHT: 'oʻng', BOTH: 'ikkala tomon' },
    organ: { EAR: 'quloq', NOSE: 'burun', THROAT: 'tomoq', LARYNX: 'hiqildoq', OTHER: 'boshqa' },
  },
  test: {
    title: 'PRINTER TESTI',
    transport: 'Transport',
    paper: 'Qogʻoz',
    codepage: 'Kodlash',
    sampleUz: 'Oʻzbekcha: Sogʻ boʻling! Gʻisht, maʼlumot.',
    sampleRu: 'Русский: Съешь ещё этих мягких булок. №1 Ўў',
    rowLeft: 'Chap ustun',
    rowRight: 'Oʻng ustun',
    ok: 'Printer ishlayapti!',
  },
  toast: {
    ticketPrinted: 'Talon chop etildi',
    receiptPrinted: 'Chek chop etildi',
    testPrinted: 'Test sahifasi yuborildi',
    fallbackUsed: 'Printer javob bermadi — brauzer orqali chop etildi',
    printing: 'Chop etilmoqda…',
    failed: 'Chop etib boʻlmadi',
    browserTestHint: 'Brauzer rejimida test kerak emas — talon va cheklar oddiy chop etish oynasida ochiladi',
  },
  errors: {
    NOT_IN_BROWSER: 'Chop etish faqat brauzerda ishlaydi',
    WEBUSB_UNSUPPORTED: 'Bu brauzer WebUSB ni qoʻllamaydi (Chrome yoki Edge ishlating)',
    NO_DEVICE: 'USB printer tanlanmagan yoki ulanmagan',
    DEVICE_OPEN_FAILED: 'USB printerni ochib boʻlmadi (boshqa dastur band qilgan boʻlishi mumkin)',
    NO_ENDPOINT: 'USB printerda maʼlumot yuborish kanali topilmadi',
    WRITE_FAILED: 'Printerga yozishda xatolik',
    QZ_LOAD_FAILED: 'QZ Tray kutubxonasi yuklanmadi (internet aloqasini tekshiring)',
    QZ_CONNECT_FAILED: 'QZ Tray ga ulanib boʻlmadi — dastur ishga tushganini tekshiring',
    QZ_PRINTER_NOT_FOUND: 'QZ Tray da printer topilmadi',
    QZ_PRINT_FAILED: 'QZ Tray chop etishda xatolik',
    NETWORK_NOT_CONFIGURED: 'Tarmoq printerining IP manzili sozlanmagan',
    NETWORK_TIMEOUT: 'Tarmoq printeri javob bermadi (vaqt tugadi)',
    NETWORK_FAILED: 'Tarmoq printeriga ulanib boʻlmadi',
    BROWSER_FAILED: 'Brauzer chop etish oynasini ochib boʻlmadi',
    BROWSER_TIMEOUT: 'Chop etish sahifasi yuklanmadi',
    NO_RAW_TRANSPORT: 'Brauzer rejimida toʻgʻridan-toʻgʻri chop etib boʻlmaydi',
    NO_FALLBACK_URL: 'Zaxira chop etish sahifasi koʻrsatilmagan',
    UNKNOWN: 'Nomaʼlum xatolik',
  },
};

const ru: PrinterDict = {
  ticket: {
    title: 'НОМЕР ОЧЕРЕДИ',
    service: 'Услуга',
    room: 'Кабинет',
    date: 'Дата',
    time: 'Время',
    ahead: 'Перед вами',
    aheadUnit: '{n} чел.',
    wait: 'Ожидание',
    waitUnit: '~{n} мин',
    phone: 'Тел',
  },
  receipt: {
    title: 'КАССОВЫЙ ЧЕК',
    no: 'Чек №',
    patient: 'Пациент',
    card: 'Карта',
    doctor: 'Врач',
    colService: 'Услуга',
    colQty: 'Кол.',
    colPrice: 'Цена',
    colTotal: 'Сумма',
    subtotal: 'Итого',
    discount: 'Скидка',
    total: 'ИТОГО',
    paid: 'Оплачено',
    balance: 'Остаток',
    debt: 'Долг',
    overpaid: 'Переплата',
    cashier: 'Кассир',
    date: 'Дата',
    phone: 'Тел',
    currency: 'сум',
    side: { LEFT: 'слева', RIGHT: 'справа', BOTH: 'с обеих сторон' },
    organ: { EAR: 'ухо', NOSE: 'нос', THROAT: 'горло', LARYNX: 'гортань', OTHER: 'другое' },
  },
  test: {
    title: 'ТЕСТ ПРИНТЕРА',
    transport: 'Транспорт',
    paper: 'Бумага',
    codepage: 'Кодировка',
    sampleUz: 'Oʻzbekcha: Sogʻ boʻling! Gʻisht, maʼlumot.',
    sampleRu: 'Русский: Съешь ещё этих мягких булок. №1 Ўў',
    rowLeft: 'Левая колонка',
    rowRight: 'Правая колонка',
    ok: 'Принтер работает!',
  },
  toast: {
    ticketPrinted: 'Талон напечатан',
    receiptPrinted: 'Чек напечатан',
    testPrinted: 'Тестовая страница отправлена',
    fallbackUsed: 'Принтер не ответил — напечатано через браузер',
    printing: 'Печать…',
    failed: 'Не удалось напечатать',
    browserTestHint: 'В режиме браузера тест не нужен — талоны и чеки открываются в обычном окне печати',
  },
  errors: {
    NOT_IN_BROWSER: 'Печать работает только в браузере',
    WEBUSB_UNSUPPORTED: 'Этот браузер не поддерживает WebUSB (используйте Chrome или Edge)',
    NO_DEVICE: 'USB-принтер не выбран или не подключён',
    DEVICE_OPEN_FAILED: 'Не удалось открыть USB-принтер (возможно, занят другой программой)',
    NO_ENDPOINT: 'У USB-принтера не найден канал передачи данных',
    WRITE_FAILED: 'Ошибка записи в принтер',
    QZ_LOAD_FAILED: 'Библиотека QZ Tray не загрузилась (проверьте интернет)',
    QZ_CONNECT_FAILED: 'Не удалось подключиться к QZ Tray — проверьте, что программа запущена',
    QZ_PRINTER_NOT_FOUND: 'Принтер не найден в QZ Tray',
    QZ_PRINT_FAILED: 'Ошибка печати через QZ Tray',
    NETWORK_NOT_CONFIGURED: 'IP-адрес сетевого принтера не настроен',
    NETWORK_TIMEOUT: 'Сетевой принтер не ответил (тайм-аут)',
    NETWORK_FAILED: 'Не удалось подключиться к сетевому принтеру',
    BROWSER_FAILED: 'Не удалось открыть окно печати браузера',
    BROWSER_TIMEOUT: 'Страница печати не загрузилась',
    NO_RAW_TRANSPORT: 'В режиме браузера прямая печать недоступна',
    NO_FALLBACK_URL: 'Резервная страница печати не указана',
    UNKNOWN: 'Неизвестная ошибка',
  },
};

export const printerMessages: Record<Locale, PrinterDict> = { uz, ru };

/** Joriy til lugʻati (nomaʼlum til → uz) */
export function pm(locale: Locale | undefined | null): PrinterDict {
  return locale === 'ru' ? ru : uz;
}

/** "{n} kishi" → "3 kishi" */
export function fill(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (k in params ? String(params[k]) : `{${k}}`));
}

export function printerErrorText(locale: Locale | undefined | null, code: PrinterErrorCode | undefined): string {
  const d = pm(locale).errors;
  return code ? d[code] : d.UNKNOWN;
}
