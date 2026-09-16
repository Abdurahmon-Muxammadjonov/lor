# LOR CRM

LOR (quloq-burun-tomoq) klinikalari uchun SaaS CRM: navbat va talon printeri, muolaja kalkulyatori,
bemor kartalari, kassa va cheklar, hisobotlar — UZ (lotin) va RU tillarida.

## Imkoniyatlar

- **Muolaja kalkulyatori** — har bir muolaja uchun 4 xil narx (kattalar/bolalar × dori bilan/dorisiz),
  0.5 qadamli miqdor, qator va umumiy chegirma (% yoki soʻm), 100 soʻmgacha yaxlitlash.
  Barcha hisob `decimal.js` da — `float` ishlatilmaydi. Narx qabulga **snapshot** qilinadi:
  narxnoma keyin oʻzgarsa ham eski qabullar summasi oʻzgarmaydi.
- **Navbat** — kiosk (planshet) rejimi, ESC/POS termal printerda talon, TV tablosi (jonli, ovozli chaqiruv),
  raqamlar har kuni `A-001` dan boshlanadi.
- **Bemorlar** — karta raqami (`2026-00042`), qidiruv (ism/telefon/karta), tashriflar tarixi, moliya.
- **Qabul** — shikoyat/anamnez/koʻrik, MKB-10 (LOR boʻlimi), anatomik tanlov (quloq/burun/tomoq, chap/oʻng).
- **Kalendar** — shifokorlar boʻyicha ustunlar, drag & drop, boʻsh slotlar, SMS tasdiq va eslatma.
- **Kassa** — toʻlovlar (naqd/karta/oʻtkazma/Click/Payme), chek (QR bilan), smena ochish/yopish.
- **Hisobotlar** — tushum, shifokorlar, muolajalar, kattalar/bolalar, dori sarfi, smenalar, qarzdorlar; Excel eksport.
- **Sozlamalar** — klinika, printer (WebUSB / QZ Tray / tarmoq 9100), Eskiz SMS, Telegram, navbat, rollar, audit jurnali.
- **Rollar** — `SUPER_ADMIN`, `ADMIN`, `DOCTOR`, `RECEPTION`, `CASHIER`; tekshiruv server tomonda (har bir API route'da).

## Stack

Next.js 14 (App Router) · TypeScript (strict) · Tailwind CSS + shadcn/ui · Framer Motion ·
Prisma 5 + PostgreSQL · NextAuth (Credentials, JWT, bcrypt) · TanStack Query · Zustand ·
React Hook Form + Zod · Recharts · ExcelJS · Vitest.

## Ishga tushirish

```bash
npm install
cp .env.example .env          # DATABASE_URL, NEXTAUTH_SECRET va h.k. toʻldiring
npx prisma migrate deploy     # yoki: npx prisma migrate dev
npm run db:seed               # demo klinika, 60+ xizmat, bemorlar va tashriflar
npm run dev                   # http://localhost:3000
```

### Demo hisoblar (seed)

| Login | Parol | Rol |
|---|---|---|
| `admin` | `Admin123!` | ADMIN |
| `doctor` | `Doctor123!` | DOCTOR |
| `reception` | `Reception123!` | RECEPTION |
| `cashier` | `Cashier123!` | CASHIER |

Kiosk: `/kiosk?key=demo-kiosk-key-2026` · TV tablo: `/display?key=demo-kiosk-key-2026`

## Buyruqlar

```bash
npm run dev         # ishlab chiqish serveri
npm run build       # production build
npm run start       # production server
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm run test        # vitest
npm run db:studio   # Prisma Studio
```

## Hujjatlar

- [`docs/CONTRACTS.md`](docs/CONTRACTS.md) — arxitektura shartnomasi (papkalar, API qoidalari, pul va hisob qoidalari, i18n, dizayn tizimi)
- [`docs/FOUNDATION.md`](docs/FOUNDATION.md) — UI/shared/effects komponentlari va ularning propslari
- [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md) — Eskiz SMS, Telegram, Click, Payme, Vercel cron, printer sozlash
- [`docs/SEED.md`](docs/SEED.md) — demo maʼlumotlar tarkibi

## Deploy

Vercel + Supabase (yoki boshqa PostgreSQL). `vercel.json` da cron jadvallari: SMS yuborish, eslatmalar,
tugʻilgan kunlar, kunlik Telegram hisoboti. Cron endpointlari `CRON_SECRET` bilan himoyalangan.
