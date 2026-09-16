# Integratsiyalar — sozlash qoʻllanmasi

Bu hujjat LOR CRM dagi tashqi xizmatlarni ulash tartibini tavsiflaydi: **Eskiz.uz** (SMS), **Telegram bot**,
**Click** va **Payme** (toʻlovlar), **Vercel Cron** (fon vazifalari) va **uchta printer transporti**
(WebUSB / QZ Tray / tarmoq IP:9100).

Barcha sirlar faqat **server muhit oʻzgaruvchilarida** (`.env`, Vercel → Project → Settings → Environment Variables)
saqlanadi. UI ularni hech qachon koʻrsatmaydi: `Sozlamalar → Klinika → Integratsiyalar holati`
(`GET /api/settings/integrations`) faqat “sozlangan / sozlanmagan” degan `boolean` ni qaytaradi.

Klinikaga tegishli (sirsiz) sozlamalar — shablonlar, chat ID lar, soatlar, prefikslar — `Clinic.settings` JSON da
(`src/lib/settings/types.ts`) va `/dashboard/settings` sahifasidan tahrirlanadi.

> Muhit oʻzgaruvchisini oʻzgartirgandan soʻng ilovani qayta ishga tushiring (Vercel da — **Redeploy**).

---

## 1. Eskiz.uz — SMS

Kod: `src/lib/integrations/eskiz.ts`. API: `https://notify.eskiz.uz/api`.

### 1.1 Muhit oʻzgaruvchilari

| Oʻzgaruvchi | Majburiy | Tavsif |
| --- | --- | --- |
| `ESKIZ_EMAIL` | ha | Eskiz kabinetidagi email (login) |
| `ESKIZ_PASSWORD` | ha | Eskiz API paroli (kabinet paroli emas — **API** boʻlimidan) |
| `ESKIZ_FROM` | yoʻq | Standart yuboruvchi nomi, default `4546` (test nomi) |
| `ESKIZ_BASE_URL` | yoʻq | API manzilini almashtirish (sinov stendi uchun) |

Ikkalasi (`ESKIZ_EMAIL` + `ESKIZ_PASSWORD`) boʻsh boʻlsa `isEskizConfigured()` → `false`: SMS lar yuborilmaydi,
`SmsLog` yozuvlari `FAILED` holatida qoladi.

### 1.2 Ishlash tartibi

1. `POST /api/auth/login {email, password}` → token. Token modul xotirasida ~29 kun keshlanadi;
   `401` kelsa avtomatik qayta login qilinib, soʻrov bir marta takrorlanadi.
2. `POST /api/message/sms/send {mobile_phone, message, from}` → `{id, status}`.
3. Telefon `normalizeEskizPhone()` bilan `998XXXXXXXXX` koʻrinishiga keltiriladi (9 xonali raqamga `998` qoʻshiladi).
   Notoʻgʻri raqam — `SmsLog` darhol `FAILED`.
4. Yuborish **darhol emas**: ilova `SmsLog` ga `PENDING` qator yozadi, uni `GET /api/cron/sms` (har 5 daqiqada,
   bir yugurishda 50 tagacha) yuboradi. Shu sababli SMS kechikishi 5 daqiqagacha boʻlishi normal.

### 1.3 Klinika sozlamalari (`Sozlamalar → SMS`)

- **SMS yuborishni yoqish** (`sms.enabled`) — oʻchirilgan boʻlsa yangi SMS lar navbatga qoʻyilmaydi.
- **Yuboruvchi nomi** (`sms.from`) — Eskiz kabinetida tasdiqlangan nom (moderatsiyadan oʻtmagan nom bilan
  yuborish rad etiladi). Test uchun `4546`.
- **Shablonlar**: yozilish tasdigʻi, eslatma, tugʻilgan kun tabrigi. Oʻrin egallovchilar:
  `{clinic}` `{name}` `{date}` `{time}` `{doctor}` `{phone}`. Nomaʼlum kalit oʻzgarishsiz qoladi (xato koʻrinib tursin).
- **Eslatma vaqti** (`sms.reminderHoursBefore`, 1–72) — qabuldan necha soat oldin yuborilsin.
- Formada har bir shablon uchun **koʻrinishi** va SMS narxi koʻrsatiladi: lotin matn GSM-7 (160/153 belgi),
  kirill matn UCS-2 (70/67 belgi) — kirill matn 2 baravar qimmat tushadi.

### 1.4 Tekshirish

`Sozlamalar → SMS → Test yuborish` → `POST /api/settings/sms/test {phone}`. Bitta SMS darhol yuboriladi
(`SmsLog.kind = CUSTOM`) va Eskiz balansidan yechiladi. Xato boʻlsa toast da Eskiz javobi koʻrsatiladi.

---

## 2. Telegram bot

Kod: `src/lib/integrations/telegram.ts`. API: `https://api.telegram.org/bot<TOKEN>/…`.

### 2.1 Botni yaratish

1. Telegram da [@BotFather](https://t.me/BotFather) ga `/newbot` yuboring, nom va username bering.
2. BotFather bergan tokenni `TELEGRAM_BOT_TOKEN` ga yozing (`123456:AA…`).
3. Chat ID ni aniqlash: botga `/start` yuboring va [@userinfobot](https://t.me/userinfobot) dan `Id` ni oling.
   **Guruh** ID lari manfiy boʻladi (`-100…`) — botni guruhga qoʻshib, administrator qilish kerak.

| Oʻzgaruvchi | Majburiy | Tavsif |
| --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | ha | BotFather tokeni |

### 2.2 Klinika sozlamalari (`Sozlamalar → Telegram`)

- **Telegram xabarlarini yoqish** (`telegram.enabled`).
- **Administrator chat ID lari** (`telegram.adminChatIds`, 20 tagacha) — kunlik hisobot shu chatlarga boradi.
  Roʻyxat boʻsh boʻlsa hisobot yuborilmaydi.
- **Kunlik hisobot vaqti** (`telegram.dailyReportHour`, 0–23) — klinika vaqt zonasi boʻyicha.
- **Bemorlarga eslatma** (`telegram.patientReminders`) — bemorda `telegramChatId` boʻlsa, qabul eslatmasi
  SMS bilan bir qatorda Telegram orqali ham yuboriladi.

Sozlamalar sahifasi bot username ini `getMe` orqali oladi (10 daqiqa keshlanadi); token notoʻgʻri boʻlsa
“Bot nomi olinmadi” koʻrsatiladi.

### 2.3 Tekshirish

`Sozlamalar → Telegram → Test xabar` → `POST /api/settings/telegram/test {chatId?, report?}`:

- `chatId` boʻsh — sozlamalardagi barcha admin chatlarga;
- `report: true` — bugungi **haqiqiy** kunlik hisobot (bir kunda faqat bir marta yuboriladi, `?force` bilan qayta).

Xabarlar `parse_mode=HTML` bilan yuboriladi; matnlar `escapeTelegramHtml()` orqali qochiriladi.

---

## 3. Click (SHOP API)

Kod: `src/lib/integrations/payments/click.ts`, `click-protocol.ts`. Webhook: `POST /api/webhooks/click`.

| Oʻzgaruvchi | Majburiy | Tavsif |
| --- | --- | --- |
| `CLICK_MERCHANT_ID` | ha | Merchant ID (kabinetdan) |
| `CLICK_SERVICE_ID` | ha | Service ID |
| `CLICK_SECRET_KEY` | ha | Secret key (imzo `md5` uchun) |
| `CLICK_MERCHANT_USER_ID` | yoʻq | Toʻlov havolasida `merchant_user_id` sifatida qoʻshiladi |

### 3.1 Kabinetda sozlash

Click merchant kabinetida **Prepare / Complete** URL sifatida bitta manzilni koʻrsating:

```
https://<domen>/api/webhooks/click
```

Ikkala bosqich ham shu endpointga `application/x-www-form-urlencoded` (yoki JSON) bilan keladi va
`action` maydoni bilan ajraladi: `0` — Prepare, `1` — Complete.

### 3.2 Protokol

- Imzo: `md5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id [+ merchant_prepare_id] + amount + action + sign_time)`
  — `verifyClickSignature()`. Notoʻgʻri imzo → `error = -1` (SIGN_CHECK_FAILED).
- `merchant_trans_id` = **Visit.id** (qabul identifikatori). Summa **soʻmda** (`amount`, kasrli).
- Javob doim `HTTP 200` + JSON: `{click_trans_id, merchant_trans_id, merchant_prepare_id|merchant_confirm_id, error, error_note}`.
- Muvaffaqiyatli `Complete` da `Payment` (`method = CLICK`) yaratiladi va qabul jamlari qayta hisoblanadi;
  takroriy soʻrov yangi toʻlov yaratmaydi (`ClickTransaction` holati boʻyicha idempotent).
- Toʻlov havolasi: `clickInvoiceUrl()` → `https://my.click.uz/services/pay?service_id=…&merchant_id=…&amount=…&transaction_param=<visitId>`.

---

## 4. Payme (Merchant API)

Kod: `src/lib/integrations/payments/payme.ts`, `payme-protocol.ts`. Webhook: `POST /api/webhooks/payme`.

| Oʻzgaruvchi | Majburiy | Tavsif |
| --- | --- | --- |
| `PAYME_MERCHANT_ID` | ha | Kassa (merchant) ID |
| `PAYME_KEY` | ha | Ishlab chiqarish kaliti (`X-Auth` paroli) |
| `PAYME_TEST_KEY` | yoʻq | Sinov kaliti — ikkalasi ham qabul qilinadi |
| `PAYME_CHECKOUT_URL` | yoʻq | Default `https://checkout.paycom.uz` |

### 4.1 Kabinetda sozlash

Payme kabinetida (Merchant Cabinet → Kassa → Sozlamalar):

- **Endpoint**: `https://<domen>/api/webhooks/payme`
- **Hisob maydoni (account)**: `visit_id` — qabul identifikatori.

### 4.2 Protokol

- JSON-RPC 2.0: `CheckPerformTransaction`, `CreateTransaction`, `PerformTransaction`, `CancelTransaction`,
  `CheckTransaction`, `GetStatement`.
- Avtorizatsiya: `Authorization: Basic base64("Paycom:<PAYME_KEY>")` — `PAYME_KEY` yoki `PAYME_TEST_KEY`.
  Notoʻgʻri boʻlsa `-32504`.
- Summa **tiyinda** (1 soʻm = 100 tiyin); `tiyinToSum` / `sumToTiyin`.
- Javob doim `HTTP 200`; xatolar `{error: {code, message}}` ichida (`PAYME_ERROR`).
- Tranzaksiya kutish muddati — 12 soat; `PerformTransaction` da `Payment` (`method = PAYME`) yaratiladi,
  `CancelTransaction` da qaytarish (manfiy toʻlov) yoziladi.
- Toʻlov havolasi: `paymeCheckoutUrl()` → `https://checkout.paycom.uz/<base64("m=…;ac.visit_id=…;a=<tiyin>;c=<return>")>`.

---

## 5. Vercel Cron (fon vazifalari)

Jadval `vercel.json` da (repo ildizi):

| Endpoint | Jadval (UTC) | Vazifa |
| --- | --- | --- |
| `/api/cron/sms` | `*/5 * * * *` | `SmsLog` dagi `PENDING` xabarlarni Eskiz orqali yuborish (50 tagacha) |
| `/api/cron/reminders` | `0 * * * *` | Qabul eslatmalari: `sms.reminderHoursBefore ± 30 daqiqa` oynasi (SMS + Telegram) |
| `/api/cron/birthdays` | `0 4 * * *` | Bugun tugʻilgan bemorlarga tabrik (09:00 Toshkent) |
| `/api/cron/daily-report` | `0 16 * * *` | Telegram kunlik hisobot (21:00 Toshkent) |

`vercel.json`:

```json
{
  "crons": [
    { "path": "/api/cron/sms", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/reminders", "schedule": "0 * * * *" },
    { "path": "/api/cron/birthdays", "schedule": "0 4 * * *" },
    { "path": "/api/cron/daily-report", "schedule": "0 16 * * *" }
  ]
}
```

### 5.1 Himoya

| Oʻzgaruvchi | Majburiy | Tavsif |
| --- | --- | --- |
| `CRON_SECRET` | ha | `Authorization: Bearer <CRON_SECRET>` |

Vercel Cron bu sarlavhani avtomatik qoʻshadi. `CRON_SECRET` boʻsh yoki `change-me` boʻlsa **hamma soʻrov rad etiladi**
(`401`) — bu ataylab tanlangan xavfsiz default. Solishtirish vaqt boʻyicha xavfsiz (`timingSafeEqual`).

Qoʻlda tekshirish:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" https://<domen>/api/cron/sms
```

### 5.2 Eslatmalar

- Vercel Hobby rejasida cron kuniga 1 marta ishlaydi va aniq daqiqa kafolatlanmaydi — ishlab chiqarish uchun Pro kerak.
- `daily-report` soatlik ishga tushirilsa ham bir klinikaga kuniga faqat bir marta yuboriladi (`AuditLog` belgisi),
  har klinika oʻz `dailyReportHour` soatida oladi (klinika vaqt zonasi boʻyicha).
- Har bir endpoint `maxDuration = 60` s bilan ishlaydi.

---

## 6. Printer: uchta transport

Sozlash: `Sozlamalar → Printer` (`Clinic.settings.printer`). Kod: `src/lib/printer/*`.
Har qanday transport xatosida **BROWSER** zaxira usuliga oʻtiladi (`/print/ticket/[id]` + `window.print()`),
shuning uchun chek hech qachon “yoʻqolmaydi”.

Umumiy sozlamalar: qogʻoz kengligi **58/80 mm**, kodlash **CP866 / CP1251 / ASCII**
(kirill uchun CP866 — koʻpchilik printerlar; Epson va baʼzi xitoy modellari CP1251), chek pastidagi matn,
QR kod, qogʻozni kesish, talon/chekni avtomatik chop etish.

### 6.1 WEBUSB — brauzerdan toʻgʻridan-toʻgʻri USB

- Faqat **Chrome / Edge** (Firefox va Safari `navigator.usb` ni qoʻllamaydi) va faqat **HTTPS** (yoki `localhost`).
- `Sozlamalar → Printer → WebUSB qurilmani tanlash` tugmasi brauzerning qurilma tanlash oynasini ochadi
  (foydalanuvchi harakati talab qilinadi). Tanlov brauzerda saqlanadi — “Unutish” bilan bekor qilinadi.
- Printer roʻyxatda koʻrinmasa **Barcha USB qurilmalar** tugmasidan foydalaning (baʼzi modellar standart
  “printer” sinfini eʼlon qilmaydi).
- Windows da printer drayveri qurilmani band qilib turgan boʻlsa WebUSB ochilmaydi — drayverni oʻchiring
  (yoki [Zadig](https://zadig.akeo.ie) bilan WinUSB ga almashtiring), aks holda QZ Tray dan foydalaning.
- Drayver kerak emas, server ishtirok etmaydi: baytlar brauzerdan USB ga toʻgʻridan-toʻgʻri yoziladi.

### 6.2 QZ — QZ Tray dasturi

- Kompyuterga [QZ Tray](https://qz.io/download) **2.2.x** oʻrnatiladi va fonda ishlab turadi
  (WebSocket `localhost:8181/8182`).
- Sahifa `qz-tray.js` ni CDN dan yuklaydi: `https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.js`.
- **Imzosiz rejim**: sertifikat berilmagani uchun QZ Tray har ulanishda “Untrusted website … allow?” dialogini
  koʻrsatadi. Administrator bir marta **Remember this decision** ni belgilasa, keyingi ulanishlar soʻrovsiz oʻtadi.
  (Oʻz sertifikatingiz boʻlsa `setCertificate(pem, signer)` bilan dialogni butunlay olib tashlash mumkin.)
- `Roʻyxatdan tanlash` tugmasi OS dagi printerlar roʻyxatini oladi; nomi boʻsh qoldirilsa **standart printer**
  ishlatiladi. Windows drayverlari bilan ishlaydi — eng ishonchli variant.

### 6.3 NETWORK — Ethernet/Wi-Fi printer (IP:9100)

- Printerga statik IP bering (`192.168.1.50` kabi), **RAW / JetDirect** portini yoqing — odatda **9100**.
- `Sozlamalar → Printer → Tarmoq` da IP va portni kiriting (IP majburiy, aks holda forma saqlanmaydi).
- Chop etish zanjiri: brauzer ESC/POS baytlarni base64 qilib `POST /api/print/raw` ga yuboradi
  (`queue.view` ruxsati talab qilinadi), server `node:net` orqali `host:port` ga TCP ulanadi va baytlarni uzatadi.
  **IP/port faqat klinika sozlamalaridan olinadi** — mijoz ixtiyoriy manzil yubora olmaydi (SSRF himoyasi).
- Umumiy vaqt chegarasi 5 s: javob boʻlmasa `NETWORK_TIMEOUT` va BROWSER zaxirasi.
- ⚠️ Server printerga **tarmoq boʻyicha yeta olishi** shart. Vercel (bulut) dan klinikaning lokal
  `192.168.x.x` manziliga ulanib boʻlmaydi — bunday holatda printerga oq IP/port-forward bering,
  VPN/tunnel qoʻying yoki WEBUSB/QZ transportidan foydalaning.

### 6.4 BROWSER — zaxira

`window.print()` bilan oddiy chop etish oynasi. Har qanday printer bilan ishlaydi, lekin foydalanuvchi
tasdigʻi kerak va ESC/POS buyruqlari (kesish, kassa yashigi) qoʻllanmaydi. `Sozlamalar` dagi “Test chop etish”
bu rejimda oʻchirilgan — kiosk sahifasida sinab koʻring.

---

## 7. Tekshirish roʻyxati

1. `Sozlamalar → Klinika → Integratsiyalar holati` — Eskiz, Telegram, Click, Payme, Cron “Sozlangan” boʻlsin.
2. `Sozlamalar → SMS → Test yuborish` — oʻz raqamingizga SMS keldimi.
3. `Sozlamalar → Telegram → Test xabar` va `Bugungi hisobotni yuborish`.
4. `curl -H "Authorization: Bearer $CRON_SECRET" https://<domen>/api/cron/sms` → `{"ok":true,…}`.
5. Click/Payme kabinetidagi sinov rejimida bitta toʻlovni oxirigacha oʻtkazing va `Kassa` da koʻring.
6. `Sozlamalar → Printer → Test chop etish` (BROWSER dan boshqa transportlarda).
