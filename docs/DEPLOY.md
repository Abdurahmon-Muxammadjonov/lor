# Vercel + Supabase ga joylash

## 1. Maʼlumotlar bazasi (Supabase)

Lokal `postgresql://postgres@127.0.0.1:54329/lor_dev` **Vercel'dan koʻrinmaydi** — internetdagi
PostgreSQL kerak. Eng oson yoʻl — Supabase (bepul reja yetadi):

1. https://supabase.com → **New project** (region: `Frankfurt (eu-central-1)` — Oʻzbekistonga eng yaqini).
2. **Project Settings → Database → Connection string** boʻlimidan ikkita URL oling:
   - **Transaction pooler** (port `6543`) → `DATABASE_URL`, oxiriga `?pgbouncer=true&connection_limit=1` qoʻshing
   - **Session / direct** (port `5432`) → `DIRECT_URL` (migratsiyalar uchun)
3. Lokal kompyuterda shu bazaga sxema va demo maʼlumotlarni yozing:

```bash
DATABASE_URL="<pooler-url>" DIRECT_URL="<direct-url>" npx prisma migrate deploy
DATABASE_URL="<pooler-url>" DIRECT_URL="<direct-url>" npm run db:seed
```

## 2. Vercel loyihasi

1. https://vercel.com/new → GitHub repo `Abdurahmon-Muxammadjonov/lor` ni import qiling.
2. Framework: **Next.js** (avtomatik aniqlanadi). Build buyrugʻi va Output — oʻzgartirmang
   (`npm run build` = `prisma generate && next build`).
3. **Environment Variables** (Production va Preview uchun ham qoʻshing):

| Oʻzgaruvchi | Qiymat |
|---|---|
| `DATABASE_URL` | Supabase pooler URL (`:6543`, `?pgbouncer=true&connection_limit=1`) |
| `DIRECT_URL` | Supabase direct URL (`:5432`) |
| `NEXTAUTH_SECRET` | `openssl rand -base64 48` natijasi |
| `NEXTAUTH_URL` | `https://<loyiha>.vercel.app` |
| `APP_URL` | `https://<loyiha>.vercel.app` |
| `CRON_SECRET` | tasodifiy satr (cron endpointlarini himoyalaydi) |

Ixtiyoriy (keyin qoʻshsa ham boʻladi): `ESKIZ_EMAIL`, `ESKIZ_PASSWORD`, `ESKIZ_FROM`,
`TELEGRAM_BOT_TOKEN`, `TELEGRAM_ADMIN_CHAT_ID`, `SMTP_*`, `CLICK_*`, `PAYME_*`
— qarang: [`INTEGRATIONS.md`](INTEGRATIONS.md).

4. **Deploy** → domen tayyor boʻlgach `NEXTAUTH_URL` va `APP_URL` ni haqiqiy domenga moslang va qayta deploy qiling.

## 3. Cron (muhim: reja cheklovi)

Vercel **Hobby (bepul)** rejasida cron kuniga **1 martadan** koʻp ishlay olmaydi va **2 tadan** koʻp
boʻlmasligi kerak. Shuning uchun repodagi `vercel.json` da faqat 2 ta kunlik cron bor
(tugʻilgan kunlar va Telegram kunlik hisoboti) — aks holda deploy **xato bilan toʻxtaydi**:

> Error: Hobby accounts are limited to daily cron jobs.

**Pro rejaga oʻtganda** `vercel.pro.json` tarkibini `vercel.json` ga koʻchiring — SMS navbati har 5
daqiqada, eslatmalar har soatda ishlaydi:

```bash
cp vercel.pro.json vercel.json && git commit -am "chore: pro cron jadvali" && git push
```

**Hobby'da qolib, SMS eslatmalarni ishlatmoqchi boʻlsangiz** — tashqi bepul cron xizmatidan
foydalaning (masalan https://cron-job.org): har 5 daqiqada quyidagilarni chaqirsin:

```
GET https://<domen>/api/cron/sms         Authorization: Bearer <CRON_SECRET>
GET https://<domen>/api/cron/reminders   Authorization: Bearer <CRON_SECRET>
```

## 4. Deploy'dan keyin tekshirish

```bash
curl -s https://<domen>/api/health          # {"ok":true,...,"db":"up"}
```

Soʻng `/login` orqali kiring (seed hisoblari: `admin` / `Admin123!`).
Kiosk: `/kiosk?key=demo-kiosk-key-2026`, TV tablo: `/display?key=demo-kiosk-key-2026`
(kalitni Sozlamalar → Navbat boʻlimida yangilash mumkin).

## Tez-tez uchraydigan xatolar

| Xato | Sabab / yechim |
|---|---|
| `Hobby accounts are limited to daily cron jobs` | `vercel.json` da kunlik boʻlmagan cron. Repodagi joriy `vercel.json` Hobby uchun mos — eskisini tiklamang. |
| `Can't reach database server` | `DATABASE_URL` lokal manzilga (`127.0.0.1`) ishora qilyapti yoki Supabase URL notoʻgʻri. |
| `Please provide a NEXTAUTH_SECRET` | `NEXTAUTH_SECRET` qoʻshilmagan. |
| Kirgandan keyin darhol `/login` ga qaytaradi | `NEXTAUTH_URL` haqiqiy domenga teng emas. |
| `prisma: command not found` / `@prisma/client did not initialize` | Build buyrugʻi oʻzgartirilgan. `npm run build` boʻlishi kerak (ichida `prisma generate` bor). |
| `Prisma: too many connections` | `DATABASE_URL` da pooler (`:6543`) va `?pgbouncer=true&connection_limit=1` yoʻq. |
