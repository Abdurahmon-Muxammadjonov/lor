import type { Locale } from '@/i18n/config';

/**
 * Landing sahifasining tarkibiy (roʻyxatli) matnlari — ikki tilda.
 * UI tugmalari/yorliqlari `src/i18n/messages/landing.ts` da; bu yerda roʻyxatlar, tariflar, FAQ va huquqiy matnlar.
 * Apostrof: ʻ (U+02BB) — oʻ, gʻ.  Tutuq: ʼ (U+02BC) — maʼlumot.
 */

export interface L {
  uz: string;
  ru: string;
}

/** Joriy tilga mos matn */
export function lc(value: L, locale: Locale): string {
  return value[locale];
}

/* ───────────────────────────── Sayt sozlamalari ───────────────────────────── */

export const SITE = {
  name: 'LOR CRM',
  url: 'https://lor.uz',
  phone: '+998712000700',
  phoneDisplay: '+998 71 200-07-00',
  email: 'salom@lor.uz',
  telegram: '@lorcrm',
  telegramUrl: 'https://t.me/lorcrm',
  instagramUrl: 'https://instagram.com/lorcrm.uz',
  youtubeUrl: 'https://youtube.com/@lorcrm',
  facebookUrl: 'https://facebook.com/lorcrm.uz',
  address: {
    uz: 'Toshkent sh., Yunusobod tumani, Amir Temur shoh koʻchasi, 108',
    ru: 'г. Ташкент, Юнусабадский район, проспект Амира Темура, 108',
  },
  legalEntity: { uz: '«LOR CRM» MChJ', ru: 'ООО «LOR CRM»' },
  workHours: { uz: 'Du–Sha, 9:00–18:00', ru: 'Пн–Сб, 9:00–18:00' },
  legalUpdated: '2026-09-01',
} as const;

/* ───────────────────────────── Ishonch lentasi ───────────────────────────── */

export interface ClinicWordmark {
  name: string;
  /** Uslub: soʻz belgisining koʻrinishi */
  style: 'serif' | 'wide' | 'mono' | 'bold' | 'light';
  city: L;
}

export const CLINIC_WORDMARKS: ClinicWordmark[] = [
  { name: 'Shifo LOR', style: 'bold', city: { uz: 'Toshkent', ru: 'Ташкент' } },
  { name: 'Medion Klinika', style: 'wide', city: { uz: 'Toshkent', ru: 'Ташкент' } },
  { name: 'Sogʻlom Avlod', style: 'serif', city: { uz: 'Samarqand', ru: 'Самарканд' } },
  { name: 'Nur Medical', style: 'light', city: { uz: 'Buxoro', ru: 'Бухара' } },
  { name: 'Sezgi LOR Markazi', style: 'mono', city: { uz: 'Fargʻona', ru: 'Фергана' } },
  { name: 'Farovon Med', style: 'bold', city: { uz: 'Andijon', ru: 'Андижан' } },
  { name: 'Oltin Quloq', style: 'serif', city: { uz: 'Namangan', ru: 'Наманган' } },
  { name: 'Ipak Yoʻli Klinikasi', style: 'wide', city: { uz: 'Samarqand', ru: 'Самарканд' } },
  { name: 'Medline Buxoro', style: 'light', city: { uz: 'Buxoro', ru: 'Бухара' } },
  { name: 'Chilonzor LOR', style: 'mono', city: { uz: 'Toshkent', ru: 'Ташкент' } },
];

/* ───────────────────────────── Oldin / Keyin ───────────────────────────── */

export const BEFORE_ITEMS: L[] = [
  { uz: 'Qogʻoz daftar va yoʻqolgan kartalar', ru: 'Бумажный журнал и потерянные карты' },
  { uz: 'Navbat janjali: «men sizdan oldin edim»', ru: 'Споры в очереди: «я был перед вами»' },
  { uz: 'Narxlar kalkulyatorda qoʻlda hisoblanadi', ru: 'Цены считаются вручную на калькуляторе' },
  { uz: 'Yoʻqolgan qarzlar va unutilgan toʻlovlar', ru: 'Потерянные долги и забытые платежи' },
  { uz: 'Bemor qabulga kelishni unutadi', ru: 'Пациент забывает прийти на приём' },
  { uz: 'Oy oxirida hisobot uchun 2 kun', ru: 'Два дня на отчёт в конце месяца' },
];

export const AFTER_ITEMS: L[] = [
  { uz: 'Elektron karta 2 soniyada topiladi', ru: 'Электронная карта находится за 2 секунды' },
  { uz: 'Kiosk talon beradi, TV ekran chaqiradi', ru: 'Киоск выдаёт талон, ТВ-экран вызывает' },
  { uz: '4 narx × 0.5 qadam — avtomatik hisob', ru: '4 цены × шаг 0.5 — автоматический расчёт' },
  { uz: 'Har bir qarz koʻrinadi va eslatiladi', ru: 'Каждый долг виден и напоминается' },
  { uz: 'SMS/Telegram eslatma bir kun oldin', ru: 'SMS/Telegram-напоминание за день' },
  { uz: 'Hisobot — bitta tugma, Excel bilan', ru: 'Отчёт — одна кнопка, с выгрузкой в Excel' },
];

/* ───────────────────────────── Bento imkoniyatlar ───────────────────────────── */

export type FeatureKey = 'calc' | 'queue' | 'cashier' | 'anatomy' | 'reports' | 'sms' | 'roles';

export interface FeatureItem {
  key: FeatureKey;
  title: L;
  description: L;
  glow: 'cyan' | 'violet' | 'mint';
  /** Bento grid oʻlchami (lg dan boshlab) */
  span: 'lg' | 'md' | 'sm';
}

export const FEATURES: FeatureItem[] = [
  {
    key: 'calc',
    title: { uz: 'Muolaja kalkulyatori', ru: 'Калькулятор процедур' },
    description: {
      uz: 'Kattalar/bolalar × dori bilan/dorisiz — 4 narx. Miqdor 0.5 qadam bilan: 1.5 seans = 180 000 soʻm. Chegirma foizda yoki soʻmda, 100 soʻmgacha yaxlitlash.',
      ru: 'Взрослые/дети × с лекарством/без — 4 цены. Количество с шагом 0.5: 1.5 сеанса = 180 000 сум. Скидка в процентах или сумах, округление до 100 сум.',
    },
    glow: 'cyan',
    span: 'lg',
  },
  {
    key: 'queue',
    title: { uz: 'Navbat + talon printeri', ru: 'Очередь + принтер талонов' },
    description: {
      uz: 'Kiosk, ESC/POS termo-printer va TV ekran. A/B/C/D prefikslar, har kuni 001 dan, ovozli chaqiruv.',
      ru: 'Киоск, ESC/POS-термопринтер и ТВ-экран. Префиксы A/B/C/D, каждый день с 001, голосовой вызов.',
    },
    glow: 'violet',
    span: 'md',
  },
  {
    key: 'cashier',
    title: { uz: 'Kassa + chek', ru: 'Касса + чек' },
    description: {
      uz: 'Naqd, karta, Click, Payme. Qisman toʻlov va qarz nazorati, smena yopish, chek chop etish.',
      ru: 'Наличные, карта, Click, Payme. Частичная оплата и контроль долгов, закрытие смены, печать чека.',
    },
    glow: 'mint',
    span: 'md',
  },
  {
    key: 'anatomy',
    title: { uz: 'LOR anatomiyasi', ru: 'ЛОР-анатомия' },
    description: {
      uz: 'Muolaja qatorida organ va tomon: chap/oʻng quloq, burun, tomoq, hiqildoq. Tashxis ICD-10 boʻyicha.',
      ru: 'В строке процедуры — орган и сторона: левое/правое ухо, нос, горло, гортань. Диагноз по МКБ-10.',
    },
    glow: 'cyan',
    span: 'sm',
  },
  {
    key: 'reports',
    title: { uz: 'Hisobotlar', ru: 'Отчёты' },
    description: {
      uz: 'Kunlik tushum, shifokorlar kesimi, xizmatlar reytingi, qarzdorlar. Excel eksport bir tugmada.',
      ru: 'Дневная выручка, разрез по врачам, рейтинг услуг, должники. Экспорт в Excel одной кнопкой.',
    },
    glow: 'violet',
    span: 'sm',
  },
  {
    key: 'sms',
    title: { uz: 'SMS / Telegram eslatmalar', ru: 'SMS / Telegram-напоминания' },
    description: {
      uz: 'Yozilish tasdigʻi, 24 soat oldin eslatma, tugʻilgan kun tabrigi. Eskiz SMS va Telegram bot orqali.',
      ru: 'Подтверждение записи, напоминание за 24 часа, поздравление с днём рождения. Через Eskiz SMS и Telegram-бот.',
    },
    glow: 'mint',
    span: 'sm',
  },
  {
    key: 'roles',
    title: { uz: 'UZ / RU + rollar', ru: 'UZ / RU + роли' },
    description: {
      uz: 'Butun tizim ikki tilda. Admin, shifokor, qabulxona, kassir — har biri faqat oʻz ishini koʻradi.',
      ru: 'Вся система на двух языках. Админ, врач, регистратура, кассир — каждый видит только своё.',
    },
    glow: 'cyan',
    span: 'sm',
  },
];

/* ───────────────────────────── Tariflar ───────────────────────────── */

export type PricingKey = 'start' | 'pro' | 'clinic';

export interface PricingTier {
  key: PricingKey;
  name: L;
  tagline: L;
  /** Oylik narx, soʻm */
  monthly: number;
  popular?: boolean;
  /** Karta CTA: sinov (login) yoki bogʻlanish (forma) */
  cta: 'trial' | 'contact';
  features: L[];
}

export const YEARLY_DISCOUNT = 0.2;

export const PRICING_TIERS: PricingTier[] = [
  {
    key: 'start',
    name: { uz: 'Start', ru: 'Start' },
    tagline: { uz: 'Bitta shifokor va qabulxona uchun', ru: 'Для одного врача и регистратуры' },
    monthly: 490_000,
    cta: 'trial',
    features: [
      { uz: '1 shifokor, 3 foydalanuvchi', ru: '1 врач, 3 пользователя' },
      { uz: 'Bemor kartalari va qabullar', ru: 'Карты пациентов и приёмы' },
      { uz: 'Muolaja kalkulyatori (4 narx, 0.5 qadam)', ru: 'Калькулятор процедур (4 цены, шаг 0.5)' },
      { uz: 'Kassa va chek chop etish', ru: 'Касса и печать чеков' },
      { uz: 'Asosiy hisobotlar', ru: 'Базовые отчёты' },
      { uz: 'UZ / RU interfeys', ru: 'Интерфейс UZ / RU' },
    ],
  },
  {
    key: 'pro',
    name: { uz: 'Pro', ru: 'Pro' },
    tagline: { uz: 'Oʻsayotgan klinika uchun toʻliq toʻplam', ru: 'Полный набор для растущей клиники' },
    monthly: 990_000,
    popular: true,
    cta: 'trial',
    features: [
      { uz: '5 shifokor, cheksiz foydalanuvchi', ru: '5 врачей, безлимит пользователей' },
      { uz: 'Start tarifidagi hamma narsa', ru: 'Всё из тарифа Start' },
      {
        uz: 'Elektron navbat: kiosk, printer, TV ekran',
        ru: 'Электронная очередь: киоск, принтер, ТВ-экран',
      },
      { uz: 'SMS va Telegram eslatmalar', ru: 'SMS и Telegram-напоминания' },
      { uz: 'Onlayn yozilish kalendari', ru: 'Календарь онлайн-записи' },
      { uz: 'Kengaytirilgan hisobotlar + Excel', ru: 'Расширенные отчёты + Excel' },
      { uz: 'Click / Payme integratsiyasi', ru: 'Интеграция Click / Payme' },
    ],
  },
  {
    key: 'clinic',
    name: { uz: 'Klinika', ru: 'Клиника' },
    tagline: { uz: 'Koʻp filialli markazlar uchun', ru: 'Для многофилиальных центров' },
    monthly: 1_990_000,
    cta: 'contact',
    features: [
      { uz: 'Cheksiz shifokor va filial', ru: 'Безлимит врачей и филиалов' },
      { uz: 'Pro tarifidagi hamma narsa', ru: 'Всё из тарифа Pro' },
      { uz: 'Filiallar boʻyicha yigʻma hisobot', ru: 'Сводный отчёт по филиалам' },
      { uz: 'Shaxsiy menejer va 24/7 qoʻllab-quvvatlash', ru: 'Личный менеджер и поддержка 24/7' },
      { uz: 'Maʼlumotlarni koʻchirish (migratsiya)', ru: 'Перенос данных (миграция)' },
      { uz: 'Xodimlarni joyida oʻqitish', ru: 'Обучение сотрудников на месте' },
      { uz: 'API va maxsus integratsiyalar', ru: 'API и индивидуальные интеграции' },
    ],
  },
];

/** Yillik narx: oylik × 12 × (1 − 20%), ming soʻmgacha yaxlitlangan */
export function yearlyPrice(monthly: number): number {
  return Math.round((monthly * 12 * (1 - YEARLY_DISCOUNT)) / 1000) * 1000;
}

/** Yillik toʻlovda oyiga tushadigan narx (ming soʻmgacha) */
export function yearlyPerMonth(monthly: number): number {
  return Math.round(yearlyPrice(monthly) / 12 / 1000) * 1000;
}

/* ───────────────────────────── Statistika ───────────────────────────── */

export interface StatItem {
  key: 'clinics' | 'patients' | 'tickets' | 'hours';
  value: number;
  suffix: string;
}

export const STATS: StatItem[] = [
  { key: 'clinics', value: 120, suffix: '+' },
  { key: 'patients', value: 340_000, suffix: '+' },
  { key: 'tickets', value: 1_200_000, suffix: '+' },
  { key: 'hours', value: 48_000, suffix: '+' },
];

/* ───────────────────────────── FAQ ───────────────────────────── */

export interface FaqItem {
  id: string;
  q: L;
  a: L;
}

export const FAQ: FaqItem[] = [
  {
    id: 'price',
    q: {
      uz: 'Narx nimaga bogʻliq va yashirin toʻlovlar bormi?',
      ru: 'От чего зависит цена и есть ли скрытые платежи?',
    },
    a: {
      uz: 'Narx faqat tarifga bogʻliq: Start — 490 000, Pro — 990 000, Klinika — 1 990 000 soʻm/oy. Yillik toʻlovda 20% chegirma. Oʻrnatish, yangilanishlar va texnik yordam narxga kiritilgan. Qoʻshimcha toʻlov faqat SMS provayderiga (Eskiz tarifi boʻyicha) toʻlanadi.',
      ru: 'Цена зависит только от тарифа: Start — 490 000, Pro — 990 000, Клиника — 1 990 000 сум/мес. При годовой оплате скидка 20%. Установка, обновления и техподдержка включены. Дополнительно оплачивается только SMS-провайдер (по тарифу Eskiz).',
    },
  },
  {
    id: 'security',
    q: {
      uz: 'Bemorlar maʼlumotlari qayerda va qanday saqlanadi?',
      ru: 'Где и как хранятся данные пациентов?',
    },
    a: {
      uz: 'Maʼlumotlar Oʻzbekiston hududidagi serverlarda saqlanadi — «Shaxsga doir maʼlumotlar toʻgʻrisida»gi 547-ЗРУ qonuni talabiga muvofiq. Ulanish TLS bilan shifrlanadi, parollar bcrypt bilan xeshlanadi, har bir klinika maʼlumotlari boshqalardan izolyatsiya qilingan, har bir oʻzgarish audit jurnalida qoladi. Kunlik zaxira nusxalar 30 kun saqlanadi.',
      ru: 'Данные хранятся на серверах на территории Узбекистана — в соответствии с законом ЗРУ-547 «О персональных данных». Соединение шифруется TLS, пароли хешируются bcrypt, данные каждой клиники изолированы, каждое изменение остаётся в журнале аудита. Ежедневные резервные копии хранятся 30 дней.',
    },
  },
  {
    id: 'printer',
    q: {
      uz: 'Qaysi printerlar mos keladi? Maxsus jihoz kerakmi?',
      ru: 'Какие принтеры подходят? Нужно ли специальное оборудование?',
    },
    a: {
      uz: 'Istalgan ESC/POS termo-printer (58 yoki 80 mm): Xprinter, Rongta, Epson TM va boshqalar. Ulanish 4 usulda: WebUSB (brauzerdan toʻgʻridan-toʻgʻri), QZ Tray (tizim printeri), tarmoq (IP:9100) yoki oddiy brauzer chop etishi. Kiosk uchun oddiy Android planshet, tablo uchun HDMI li istalgan televizor yetarli.',
      ru: 'Любой ESC/POS-термопринтер (58 или 80 мм): Xprinter, Rongta, Epson TM и другие. Подключение 4 способами: WebUSB (напрямую из браузера), QZ Tray (системный принтер), сеть (IP:9100) или обычная печать из браузера. Для киоска достаточно обычного Android-планшета, для табло — любого телевизора с HDMI.',
    },
  },
  {
    id: 'offline',
    q: { uz: 'Internet uzilib qolsa nima boʻladi?', ru: 'Что будет, если пропадёт интернет?' },
    a: {
      uz: 'Ochiq sahifalar ishlashda davom etadi: shifokor muolaja qatorlarini yozishi, kassir hisobni koʻrishi mumkin — aloqa tiklangach maʼlumotlar avtomatik sinxronlanadi. Navbat tablosi oxirgi holatni koʻrsatib turadi. Uzoq uzilishlar uchun mobil internet (4G modem) orqali zaxira ulanishni tavsiya qilamiz.',
      ru: 'Открытые страницы продолжают работать: врач может вносить строки процедур, кассир — видеть счёт; после восстановления связи данные синхронизируются автоматически. Табло очереди показывает последнее состояние. На случай долгих обрывов рекомендуем резервное подключение через мобильный интернет (4G-модем).',
    },
  },
  {
    id: 'migration',
    q: {
      uz: 'Eski dasturdan yoki Excel dan maʼlumotlarni koʻchirish mumkinmi?',
      ru: 'Можно ли перенести данные из старой программы или Excel?',
    },
    a: {
      uz: 'Ha. Bemorlar bazasi, xizmatlar roʻyxati va narxlarni Excel/CSV dan import qilamiz — Pro va Klinika tariflarida bu bepul. Boshqa CRM (1C, MedElement, Google Sheets) dan koʻchirish uchun mutaxassisimiz strukturani tekshirib, 2–3 ish kunida yuklab beradi.',
      ru: 'Да. Базу пациентов, список услуг и цены импортируем из Excel/CSV — на тарифах Pro и Клиника это бесплатно. Для переноса из другой CRM (1C, MedElement, Google Sheets) наш специалист проверит структуру и загрузит данные за 2–3 рабочих дня.',
    },
  },
  {
    id: 'training',
    q: { uz: 'Xodimlarni oʻqitish qancha vaqt oladi?', ru: 'Сколько времени занимает обучение сотрудников?' },
    a: {
      uz: 'Qabulxona va kassir 1 soatda, shifokor 30 daqiqada oʻrganadi — interfeys ikki tilda va telefon ekraniga ham moslashgan. Har bir tarifga onlayn oʻqitish va video qoʻllanmalar kiradi; Klinika tarifida mutaxassis klinikaga borib oʻqitadi.',
      ru: 'Регистратура и кассир осваивают систему за 1 час, врач — за 30 минут: интерфейс двуязычный и адаптирован под экран телефона. В каждый тариф входит онлайн-обучение и видеоинструкции; на тарифе Клиника специалист обучает на месте.',
    },
  },
  {
    id: 'sms',
    q: { uz: 'SMS xabarlar qancha turadi?', ru: 'Сколько стоят SMS-сообщения?' },
    a: {
      uz: 'SMS Eskiz.uz provayderi orqali yuboriladi — bitta xabar taxminan 95 soʻm (provayder tarifi boʻyicha, toʻgʻridan-toʻgʻri unga toʻlanadi). Telegram orqali eslatmalar mutlaqo bepul: bemor botga bir marta obuna boʻlsa, barcha eslatmalar u yerga boradi.',
      ru: 'SMS отправляются через провайдера Eskiz.uz — одно сообщение около 95 сум (по тарифу провайдера, оплачивается ему напрямую). Напоминания через Telegram полностью бесплатны: пациент один раз подписывается на бота, и все напоминания приходят туда.',
    },
  },
  {
    id: 'contract',
    q: {
      uz: 'Shartnoma qanday tuziladi va toʻlov qanday amalga oshadi?',
      ru: 'Как заключается договор и как проходит оплата?',
    },
    a: {
      uz: 'Yuridik shaxslar bilan elektron shartnoma (didox / e-imzo orqali) tuzamiz, hisob-faktura va akt beramiz. Toʻlov — pul oʻtkazmasi, Click yoki Payme orqali. Sinov davri 14 kun, karta yoki oldindan toʻlov talab qilinmaydi. Tarifni istalgan vaqtda 30 kun oldin ogohlantirib toʻxtatish mumkin, maʼlumotlar Excel formatida eksport qilib beriladi.',
      ru: 'С юридическими лицами заключаем электронный договор (через didox / e-imzo), выставляем счёт-фактуру и акт. Оплата — переводом, через Click или Payme. Пробный период 14 дней, карта или предоплата не требуются. Тариф можно остановить в любой момент, предупредив за 30 дней; данные выгружаются в формате Excel.',
    },
  },
];

/* ───────────────────────────── Footer ustunlari ───────────────────────────── */

export interface FooterLink {
  key:
    | 'features'
    | 'demo'
    | 'pricing'
    | 'faq'
    | 'login'
    | 'about'
    | 'contactUs'
    | 'telegram'
    | 'privacy'
    | 'terms'
    | 'offer';
  href: string;
  external?: boolean;
}

export const FOOTER_COLUMNS: Array<{ key: 'product' | 'company' | 'legal'; links: FooterLink[] }> = [
  {
    key: 'product',
    links: [
      { key: 'features', href: '/#features' },
      { key: 'demo', href: '/#demo' },
      { key: 'pricing', href: '/#pricing' },
      { key: 'faq', href: '/#faq' },
      { key: 'login', href: '/login' },
    ],
  },
  {
    key: 'company',
    links: [
      { key: 'about', href: '/#stats' },
      { key: 'contactUs', href: '/#contact' },
      { key: 'telegram', href: SITE.telegramUrl, external: true },
    ],
  },
  {
    key: 'legal',
    links: [
      { key: 'privacy', href: '/privacy' },
      { key: 'terms', href: '/terms' },
      { key: 'offer', href: '/terms#offer' },
    ],
  },
];

/* ───────────────────────────── Huquqiy hujjatlar ───────────────────────────── */

export interface LegalSection {
  id: string;
  heading: L;
  paragraphs: L[];
  bullets?: L[];
}

export interface LegalDocument {
  title: L;
  intro: L;
  sections: LegalSection[];
}

export const PRIVACY_POLICY: LegalDocument = {
  title: { uz: 'Maxfiylik siyosati', ru: 'Политика конфиденциальности' },
  intro: {
    uz: 'Ushbu siyosat «LOR CRM» MChJ (keyingi oʻrinlarda — «Biz», «Operator») tomonidan lor.uz sayti va LOR CRM dasturiy xizmati orqali shaxsga doir maʼlumotlarni qayta ishlash tartibini belgilaydi. Hujjat Oʻzbekiston Respublikasining 2019-yil 2-iyuldagi «Shaxsga doir maʼlumotlar toʻgʻrisida»gi ЗРУ-547-son Qonuni va unga bogʻliq normativ hujjatlar asosida tuzilgan.',
    ru: 'Настоящая политика определяет порядок обработки персональных данных ООО «LOR CRM» (далее — «Мы», «Оператор») через сайт lor.uz и программный сервис LOR CRM. Документ составлен на основании Закона Республики Узбекистан «О персональных данных» № ЗРУ-547 от 2 июля 2019 года и связанных с ним нормативных актов.',
  },
  sections: [
    {
      id: 'scope',
      heading: { uz: '1. Umumiy qoidalar', ru: '1. Общие положения' },
      paragraphs: [
        {
          uz: 'Siyosat saytga tashrif buyuruvchilar, soʻrov qoldirgan shaxslar, klinika xodimlari (tizim foydalanuvchilari) va klinikalar tomonidan tizimga kiritiladigan bemorlar maʼlumotlariga nisbatan qoʻllaniladi. Saytdan foydalanish yoki soʻrov yuborish orqali siz ushbu siyosat bilan tanishganingizni tasdiqlaysiz.',
          ru: 'Политика применяется к посетителям сайта, лицам, оставившим заявку, сотрудникам клиник (пользователям системы) и к данным пациентов, которые клиники вносят в систему. Используя сайт или отправляя заявку, вы подтверждаете, что ознакомились с настоящей политикой.',
        },
        {
          uz: 'Klinikaning bemorlari maʼlumotlariga nisbatan klinika — shaxsga doir maʼlumotlar egasi (operatori), biz esa Qonunning 4-moddasi maʼnosida uchinchi shaxs — texnik qayta ishlovchi hisoblanamiz va faqat klinikaning topshirigʻi doirasida harakat qilamiz.',
          ru: 'В отношении данных пациентов клиники оператором персональных данных является клиника, а мы выступаем третьим лицом — техническим обработчиком в значении статьи 4 Закона и действуем исключительно в рамках поручения клиники.',
        },
      ],
    },
    {
      id: 'data',
      heading: { uz: '2. Qanday maʼlumotlar yigʻiladi', ru: '2. Какие данные собираются' },
      paragraphs: [
        {
          uz: 'Biz faqat xizmat koʻrsatish uchun zarur boʻlgan minimal maʼlumotlarni yigʻamiz:',
          ru: 'Мы собираем только минимальный объём данных, необходимый для оказания услуги:',
        },
      ],
      bullets: [
        {
          uz: 'Soʻrov formasi: ism, telefon raqami, klinika nomi, xabar matni;',
          ru: 'Форма заявки: имя, номер телефона, название клиники, текст сообщения;',
        },
        {
          uz: 'Foydalanuvchi hisobi: login, F.I.Sh., lavozim, telefon, elektron pochta, kirish vaqti va IP manzil;',
          ru: 'Учётная запись: логин, Ф.И.О., должность, телефон, электронная почта, время входа и IP-адрес;',
        },
        {
          uz: 'Klinika kiritadigan bemor maʼlumotlari: F.I.Sh., tugʻilgan sana, jins, telefon, tashxis, muolajalar va toʻlovlar tarixi;',
          ru: 'Данные пациентов, вносимые клиникой: Ф.И.О., дата рождения, пол, телефон, диагноз, история процедур и оплат;',
        },
        {
          uz: 'Texnik maʼlumotlar: brauzer turi, til sozlamasi, sahifaga kirish jurnali (xatolarni tahlil qilish uchun).',
          ru: 'Технические данные: тип браузера, языковая настройка, журнал обращений к страницам (для анализа ошибок).',
        },
      ],
    },
    {
      id: 'purpose',
      heading: {
        uz: '3. Qayta ishlash maqsadlari va huquqiy asos',
        ru: '3. Цели обработки и правовое основание',
      },
      paragraphs: [
        {
          uz: 'Maʼlumotlar quyidagi maqsadlarda qayta ishlanadi: soʻrov boʻyicha bogʻlanish va taqdimot oʻtkazish; shartnoma tuzish va xizmat koʻrsatish; texnik yordam va xavfsizlikni taʼminlash; qonunchilikda belgilangan hisobot majburiyatlarini bajarish.',
          ru: 'Данные обрабатываются для следующих целей: связь по заявке и проведение презентации; заключение договора и оказание услуги; техническая поддержка и обеспечение безопасности; выполнение установленных законодательством обязанностей по отчётности.',
        },
        {
          uz: 'Huquqiy asos — Qonunning 15-moddasiga muvofiq subyektning roziligi (forma yuborish, roʻyxatdan oʻtish) va shartnomani bajarish zarurati. Bemorlardan rozilik olish, shu jumladan sogʻliq haqidagi maxsus toifadagi maʼlumotlar uchun, klinika zimmasida.',
          ru: 'Правовое основание — согласие субъекта в соответствии со статьёй 15 Закона (отправка формы, регистрация) и необходимость исполнения договора. Получение согласия пациентов, в том числе на обработку специальных категорий данных о здоровье, является обязанностью клиники.',
        },
      ],
    },
    {
      id: 'storage',
      heading: { uz: '4. Saqlash joyi va xavfsizlik choralari', ru: '4. Место хранения и меры безопасности' },
      paragraphs: [
        {
          uz: 'Qonunning 27¹-moddasi talabiga koʻra Oʻzbekiston Respublikasi fuqarolarining shaxsga doir maʼlumotlari Oʻzbekiston hududida joylashgan serverlarda va maʼlumotlar bazalarida saqlanadi. Zaxira nusxalar ham shu hududda saqlanadi.',
          ru: 'В соответствии с требованием статьи 27¹ Закона персональные данные граждан Республики Узбекистан хранятся на серверах и в базах данных, расположенных на территории Узбекистана. Резервные копии также хранятся на этой территории.',
        },
        {
          uz: 'Biz quyidagi tashkiliy-texnik choralarni qoʻllaymiz: TLS shifrlash; parollarni bcrypt bilan xeshlash; rolga asoslangan kirish nazorati; har bir klinika maʼlumotlarini mantiqiy izolyatsiya qilish; barcha narx, toʻlov va sozlama oʻzgarishlarini audit jurnalida qayd etish; kirish urinishlarini cheklash; kunlik zaxira nusxalash va 30 kun saqlash.',
          ru: 'Мы применяем следующие организационно-технические меры: шифрование TLS; хеширование паролей bcrypt; ролевой контроль доступа; логическая изоляция данных каждой клиники; фиксация всех изменений цен, платежей и настроек в журнале аудита; ограничение попыток входа; ежедневное резервное копирование с хранением 30 дней.',
        },
      ],
    },
    {
      id: 'third',
      heading: { uz: '5. Uchinchi shaxslarga uzatish', ru: '5. Передача третьим лицам' },
      paragraphs: [
        {
          uz: 'Maʼlumotlar faqat xizmatni bajarish uchun zarur boʻlgan hajmda quyidagi hamkorlarga uzatilishi mumkin: SMS provayderi (Eskiz.uz — telefon raqami va xabar matni), Telegram (bot orqali eslatmalar — faqat bemor obuna boʻlsa), toʻlov tizimlari Click va Payme (toʻlov summasi va identifikator). Biz maʼlumotlarni reklama maqsadida sotmaymiz va uzatmaymiz.',
          ru: 'Данные могут передаваться только в объёме, необходимом для выполнения услуги, следующим партнёрам: SMS-провайдеру (Eskiz.uz — номер телефона и текст сообщения), Telegram (напоминания через бота — только если пациент подписался), платёжным системам Click и Payme (сумма платежа и идентификатор). Мы не продаём и не передаём данные в рекламных целях.',
        },
        {
          uz: 'Davlat organlarining qonuniy soʻrovi boʻlsa, maʼlumotlar Qonunda belgilangan tartibda va hajmda taqdim etiladi.',
          ru: 'При законном запросе государственных органов данные предоставляются в порядке и объёме, установленных Законом.',
        },
      ],
    },
    {
      id: 'retention',
      heading: { uz: '6. Saqlash muddati', ru: '6. Срок хранения' },
      paragraphs: [
        {
          uz: 'Soʻrov formasidagi maʼlumotlar 12 oy saqlanadi. Klinika maʼlumotlari shartnoma amal qilgan davrda va tugagandan soʻng 30 kun davomida saqlanadi — bu muddatda klinika toʻliq eksportni (Excel) olishi mumkin; soʻngra maʼlumotlar qaytarib boʻlmaydigan tarzda oʻchiriladi. Buxgalteriya hujjatlari qonunda belgilangan muddatda (5 yil) saqlanadi.',
          ru: 'Данные из формы заявки хранятся 12 месяцев. Данные клиники хранятся в течение действия договора и 30 дней после его окончания — в этот срок клиника может получить полную выгрузку (Excel); затем данные безвозвратно удаляются. Бухгалтерские документы хранятся в установленный законом срок (5 лет).',
        },
      ],
    },
    {
      id: 'rights',
      heading: { uz: '7. Subyektning huquqlari', ru: '7. Права субъекта' },
      paragraphs: [
        {
          uz: 'Qonunning 30-moddasiga muvofiq siz oʻzingiz haqingizdagi maʼlumotlar bilan tanishish, ularni aniqlashtirish yoki oʻchirishni talab qilish, rozilikni qaytarib olish va qayta ishlashga eʼtiroz bildirish huquqiga egasiz. Soʻrovlar salom@lor.uz manziliga yuboriladi va 10 ish kuni ichida koʻrib chiqiladi. Bemorlar oʻz huquqlarini davolanayotgan klinika orqali amalga oshiradi.',
          ru: 'В соответствии со статьёй 30 Закона вы вправе ознакомиться со своими данными, требовать их уточнения или удаления, отозвать согласие и возразить против обработки. Запросы направляются на salom@lor.uz и рассматриваются в течение 10 рабочих дней. Пациенты реализуют свои права через клинику, в которой проходят лечение.',
        },
      ],
    },
    {
      id: 'cookies',
      heading: { uz: '8. Cookie fayllar', ru: '8. Файлы cookie' },
      paragraphs: [
        {
          uz: 'Sayt faqat texnik cookie fayllardan foydalanadi: NEXT_LOCALE (tanlangan til, 1 yil) va sessiya cookie (tizimga kirgan foydalanuvchi, 30 kun). Reklama trekerlari va uchinchi tomon analitik skriptlari ishlatilmaydi. Cookie ni brauzer sozlamalarida oʻchirish mumkin, ammo bunda tizimga kirish ishlamaydi.',
          ru: 'Сайт использует только технические cookie: NEXT_LOCALE (выбранный язык, 1 год) и cookie сессии (вошедший пользователь, 30 дней). Рекламные трекеры и сторонние аналитические скрипты не используются. Cookie можно отключить в настройках браузера, однако вход в систему при этом работать не будет.',
        },
      ],
    },
    {
      id: 'changes',
      heading: { uz: '9. Siyosatga oʻzgartirishlar', ru: '9. Изменения политики' },
      paragraphs: [
        {
          uz: 'Biz siyosatni yangilash huquqini saqlab qolamiz. Yangi tahrir shu sahifada eʼlon qilinadi, muhim oʻzgarishlar haqida klinikalar elektron pochta orqali 14 kun oldin ogohlantiriladi. Hujjat sanasi sahifa boshida koʻrsatilgan.',
          ru: 'Мы оставляем за собой право обновлять политику. Новая редакция публикуется на этой странице; о существенных изменениях клиники уведомляются по электронной почте за 14 дней. Дата документа указана в начале страницы.',
        },
      ],
    },
  ],
};

export const TERMS_OF_SERVICE: LegalDocument = {
  title: { uz: 'Foydalanish shartlari', ru: 'Условия использования' },
  intro: {
    uz: 'Ushbu hujjat «LOR CRM» MChJ (keyingi oʻrinlarda — «Ijrochi») tomonidan LOR CRM dasturiy xizmatidan (keyingi oʻrinlarda — «Xizmat») foydalanish shartlarini belgilaydi va Oʻzbekiston Respublikasi Fuqarolik kodeksining 367–369-moddalariga muvofiq ommaviy oferta hisoblanadi. Roʻyxatdan oʻtish yoki Xizmatdan foydalanish ofertaning toʻliq va soʻzsiz qabul qilinishi (aksept) hisoblanadi.',
    ru: 'Настоящий документ определяет условия использования программного сервиса LOR CRM (далее — «Сервис»), предоставляемого ООО «LOR CRM» (далее — «Исполнитель»), и является публичной офертой в соответствии со статьями 367–369 Гражданского кодекса Республики Узбекистан. Регистрация или использование Сервиса означает полное и безоговорочное принятие оферты (акцепт).',
  },
  sections: [
    {
      id: 'terms',
      heading: { uz: '1. Atamalar', ru: '1. Термины' },
      paragraphs: [
        {
          uz: '«Klinika» (Buyurtmachi) — Xizmatdan foydalanuvchi yuridik shaxs yoki yakka tartibdagi tadbirkor. «Foydalanuvchi» — Klinika tomonidan tizimga kiritilgan xodim. «Tarif» — Xizmat hajmi va narxini belgilovchi reja (Start, Pro, Klinika). «Hisob davri» — oldindan toʻlangan oy yoki yil.',
          ru: '«Клиника» (Заказчик) — юридическое лицо или индивидуальный предприниматель, использующий Сервис. «Пользователь» — сотрудник, добавленный Клиникой в систему. «Тариф» — план, определяющий объём и стоимость Сервиса (Start, Pro, Клиника). «Расчётный период» — предоплаченный месяц или год.',
        },
      ],
    },
    {
      id: 'offer',
      heading: { uz: '2. Shartnoma predmeti va tuzilishi', ru: '2. Предмет и заключение договора' },
      paragraphs: [
        {
          uz: 'Ijrochi Klinikaga Xizmatga internet orqali masofaviy kirish huquqini (SaaS) beradi, Klinika esa tanlangan Tarif boʻyicha toʻlovni amalga oshiradi. Shartnoma roʻyxatdan oʻtgan paytdan boshlab tuzilgan hisoblanadi; yuridik shaxslar bilan qoʻshimcha ravishda elektron shartnoma va hisob-faktura rasmiylashtiriladi.',
          ru: 'Исполнитель предоставляет Клинике право удалённого доступа к Сервису через интернет (SaaS), а Клиника оплачивает выбранный Тариф. Договор считается заключённым с момента регистрации; с юридическими лицами дополнительно оформляется электронный договор и счёт-фактура.',
        },
        {
          uz: 'Sinov davri — 14 kalendar kuni, toʻlovsiz va karta talab qilinmasdan. Sinov tugagach, toʻlov qilinmasa, hisob faqat oʻqish rejimiga oʻtadi; maʼlumotlar yana 30 kun saqlanadi.',
          ru: 'Пробный период — 14 календарных дней, без оплаты и без привязки карты. По окончании пробного периода при отсутствии оплаты аккаунт переходит в режим «только чтение»; данные хранятся ещё 30 дней.',
        },
      ],
    },
    {
      id: 'service',
      heading: { uz: '3. Xizmat mazmuni va darajasi', ru: '3. Содержание и уровень Сервиса' },
      paragraphs: [
        {
          uz: 'Xizmat tarkibiga Tarifda koʻrsatilgan modullar (bemorlar, qabullar, kalkulyator, kassa, navbat, hisobotlar, eslatmalar), yangilanishlar va texnik yordam kiradi. Ijrochi Xizmatning oyiga kamida 99,5% vaqt ishlashini taʼminlashga intiladi; rejalashtirilgan texnik ishlar tunda (23:00–06:00) oʻtkaziladi va 24 soat oldin eʼlon qilinadi.',
          ru: 'В состав Сервиса входят модули, указанные в Тарифе (пациенты, приёмы, калькулятор, касса, очередь, отчёты, напоминания), обновления и техническая поддержка. Исполнитель стремится обеспечить доступность Сервиса не менее 99,5% времени в месяц; плановые технические работы проводятся ночью (23:00–06:00) и объявляются за 24 часа.',
        },
        {
          uz: 'Texnik yordam Telegram va elektron pochta orqali ish kunlari 9:00 dan 18:00 gacha koʻrsatiladi; Klinika tarifida — 24/7. Javob berish muddati: jiddiy nosozliklar — 2 soat, boshqa murojaatlar — 1 ish kuni.',
          ru: 'Техническая поддержка оказывается через Telegram и электронную почту в рабочие дни с 9:00 до 18:00; на тарифе Клиника — 24/7. Срок реакции: критические сбои — 2 часа, прочие обращения — 1 рабочий день.',
        },
      ],
    },
    {
      id: 'payment',
      heading: { uz: '4. Tariflar va toʻlov', ru: '4. Тарифы и оплата' },
      paragraphs: [
        {
          uz: 'Narxlar saytda soʻmda, QQSsiz koʻrsatiladi va oldindan (oylik yoki yillik) toʻlanadi. Yillik toʻlovda 20% chegirma qoʻllaniladi. Toʻlov bank oʻtkazmasi, Click yoki Payme orqali qabul qilinadi. Ijrochi narxlarni oʻzgartirishi mumkin, bunda Klinika kamida 30 kun oldin ogohlantiriladi; toʻlangan davr uchun narx oʻzgarmaydi.',
          ru: 'Цены указаны на сайте в сумах без НДС и оплачиваются авансом (помесячно или за год). При годовой оплате применяется скидка 20%. Оплата принимается банковским переводом, через Click или Payme. Исполнитель вправе изменять цены, уведомив Клинику не менее чем за 30 дней; стоимость оплаченного периода не меняется.',
        },
        {
          uz: 'Toʻlov muddati oʻtib 7 kun ichida toʻlanmasa, Ijrochi kirishni vaqtincha cheklashi mumkin. Foydalanilgan davr uchun pul qaytarilmaydi, qonunda nazarda tutilgan hollar bundan mustasno. SMS xabarlar provayder (Eskiz) tarifi boʻyicha alohida toʻlanadi.',
          ru: 'Если оплата не поступила в течение 7 дней после окончания оплаченного периода, Исполнитель вправе временно ограничить доступ. Возврат средств за использованный период не производится, за исключением случаев, предусмотренных законом. SMS-сообщения оплачиваются отдельно по тарифу провайдера (Eskiz).',
        },
      ],
    },
    {
      id: 'clinic-duties',
      heading: { uz: '5. Klinikaning majburiyatlari', ru: '5. Обязанности Клиники' },
      paragraphs: [
        {
          uz: 'Klinika: kiritilayotgan maʼlumotlarning toʻgʻriligi uchun javob beradi; bemorlardan shaxsga doir maʼlumotlarni qayta ishlashga rozilik oladi; foydalanuvchi parollarining maxfiyligini taʼminlaydi va ishdan ketgan xodimlarni oʻz vaqtida oʻchiradi; Xizmatdan qonunga zid maqsadlarda foydalanmaydi; dasturiy taʼminotni nusxalash, dekompilyatsiya qilish yoki uchinchi shaxslarga kirish huquqini berishga yoʻl qoʻymaydi.',
          ru: 'Клиника: отвечает за достоверность вносимых данных; получает у пациентов согласие на обработку персональных данных; обеспечивает конфиденциальность паролей пользователей и своевременно отключает уволенных сотрудников; не использует Сервис в противоправных целях; не допускает копирования, декомпиляции программного обеспечения или передачи доступа третьим лицам.',
        },
        {
          uz: 'Tibbiy xizmatlar koʻrsatish, tashxis qoʻyish va davolash boʻyicha barcha qarorlar va javobgarlik toʻliq Klinika va uning shifokorlari zimmasida. Xizmat tibbiy buyum emas va shifokor qarorini almashtirmaydi.',
          ru: 'Все решения и ответственность за оказание медицинских услуг, постановку диагноза и лечение полностью лежат на Клинике и её врачах. Сервис не является медицинским изделием и не заменяет решение врача.',
        },
      ],
    },
    {
      id: 'ip',
      heading: {
        uz: '6. Intellektual mulk va maʼlumotlarga egalik',
        ru: '6. Интеллектуальная собственность и владение данными',
      },
      paragraphs: [
        {
          uz: 'Xizmatning dasturiy kodi, dizayni va tovar belgisi Ijrochiga tegishli. Klinika tomonidan kiritilgan barcha maʼlumotlar (bemorlar, xizmatlar, toʻlovlar) Klinikaning mulki hisoblanadi; Klinika istalgan vaqtda ularni Excel formatida eksport qilishi mumkin. Ijrochi Klinika maʼlumotlaridan faqat Xizmatni koʻrsatish va anonim statistik tahlil uchun foydalanadi.',
          ru: 'Программный код, дизайн и товарный знак Сервиса принадлежат Исполнителю. Все данные, внесённые Клиникой (пациенты, услуги, оплаты), являются собственностью Клиники; Клиника может в любой момент выгрузить их в формате Excel. Исполнитель использует данные Клиники только для оказания Сервиса и обезличенного статистического анализа.',
        },
      ],
    },
    {
      id: 'liability',
      heading: { uz: '7. Javobgarlik cheklovi', ru: '7. Ограничение ответственности' },
      paragraphs: [
        {
          uz: 'Ijrochi Klinikaning bevosita zarari uchun oxirgi 3 oy ichida toʻlangan summa doirasida javob beradi. Ijrochi boy berilgan foyda, obroʻga zarar va uchinchi shaxslar (internet provayder, SMS provayder, toʻlov tizimlari) sababli yuzaga kelgan uzilishlar uchun javob bermaydi. Fors-major holatlari tomonlarni majburiyatlardan ozod qiladi.',
          ru: 'Исполнитель отвечает за прямой ущерб Клиники в пределах суммы, оплаченной за последние 3 месяца. Исполнитель не отвечает за упущенную выгоду, репутационный вред и перебои, вызванные третьими лицами (интернет-провайдер, SMS-провайдер, платёжные системы). Обстоятельства непреодолимой силы освобождают стороны от обязательств.',
        },
      ],
    },
    {
      id: 'termination',
      heading: { uz: '8. Muddat va bekor qilish', ru: '8. Срок и расторжение' },
      paragraphs: [
        {
          uz: 'Shartnoma muddatsiz tuziladi. Har bir tomon boshqa tomonni 30 kun oldin yozma (elektron pochta orqali) ogohlantirib shartnomani bekor qilishi mumkin. Bekor qilingandan soʻng Klinika 30 kun davomida maʼlumotlarni eksport qilishi mumkin; keyin ular qaytarib boʻlmaydigan tarzda oʻchiriladi. Shartlar qoʻpol buzilganda (kirishni uzatish, hujum urinishlari) Ijrochi kirishni darhol toʻxtatishi mumkin.',
          ru: 'Договор заключается бессрочно. Каждая сторона вправе расторгнуть его, письменно (по электронной почте) уведомив другую за 30 дней. После расторжения Клиника может выгрузить данные в течение 30 дней; затем они безвозвратно удаляются. При грубом нарушении условий (передача доступа, попытки атак) Исполнитель вправе немедленно прекратить доступ.',
        },
      ],
    },
    {
      id: 'disputes',
      heading: { uz: '9. Nizolarni hal qilish', ru: '9. Разрешение споров' },
      paragraphs: [
        {
          uz: 'Tomonlar nizolarni muzokaralar yoʻli bilan hal qilishga intiladi; daʼvo 15 kun ichida koʻrib chiqiladi. Kelishuvga erishilmasa, nizo Oʻzbekiston Respublikasi qonunchiligiga muvofiq Toshkent shahar tumanlararo iqtisodiy sudida koʻriladi.',
          ru: 'Стороны стремятся урегулировать споры путём переговоров; претензия рассматривается в течение 15 дней. При недостижении согласия спор передаётся в Ташкентский межрайонный экономический суд в соответствии с законодательством Республики Узбекистан.',
        },
      ],
    },
    {
      id: 'changes',
      heading: { uz: '10. Shartlarga oʻzgartirishlar', ru: '10. Изменение условий' },
      paragraphs: [
        {
          uz: 'Ijrochi shartlarni oʻzgartirishi mumkin; yangi tahrir shu sahifada eʼlon qilinadi va eʼlon qilingan kundan 14 kun oʻtgach kuchga kiradi. Oʻzgarishlarga rozi boʻlmagan Klinika shu muddat ichida shartnomani bekor qilish huquqiga ega.',
          ru: 'Исполнитель вправе изменять условия; новая редакция публикуется на этой странице и вступает в силу через 14 дней после публикации. Клиника, не согласная с изменениями, вправе расторгнуть договор в течение этого срока.',
        },
      ],
    },
  ],
};
