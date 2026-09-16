# Demo maʼlumotlar (seed)

```bash
npm run db:seed          # tsx prisma/seed.ts  (DATABASE_URL .env dan)
```

Seed **idempotent**: klinika, xodim, kategoriya, xizmat va bemorlar unikal kalit boʻyicha `upsert`
qilinadi (`slug`, `login`, `clinicId+name`, `clinicId+code`, `clinicId+cardNumber`). Tranzaksion
maʼlumotlar (qabullar, muolaja qatorlari, toʻlovlar, navbat, yozilishlar, kassa smenalari, audit, SMS)
ikkala demo klinika uchun **oʻchirilib qayta yaratiladi**. Barcha tasodifiy qiymatlar seedlangan RNG
(`prisma/seed-data/rng.ts`, mulberry32) orqali olinadi — bir kunda qayta ishga tushirilsa, natija
aynan bir xil (jadval checksumlari tekshirilgan). Sanalar "bugun" (Asia/Tashkent) ga nisbatan
hisoblanadi, shuning uchun boshqa kunda tarix mos ravishda siljiydi.

Sinov uchun "hozir"ni qotirish mumkin: `SEED_NOW=2026-09-20T09:30:00+05:00 npx tsx prisma/seed.ts`.

## Fayllar

| Fayl | Mazmun |
| --- | --- |
| `prisma/seed.ts` | Orkestrator: upsert, tozalash, tarix generatori, bugungi navbat/qabullar, smenalar, audit, SMS, xulosa |
| `prisma/seed-data/rng.ts` | Deterministik RNG (`int`, `pick`, `chance`, `weighted`, `shuffle`, `sample`) |
| `prisma/seed-data/clinic.ts` | 2 ta klinika (`demo`, `lor-plus`) va `parseClinicSettings` orqali tekshirilgan sozlamalar |
| `prisma/seed-data/users.ts` | Xodimlar, `parseWeeklySchedule` orqali ish jadvallari |
| `prisma/seed-data/categories.ts` | 7 ta kategoriya (demo) + 3 ta (lor-plus) |
| `prisma/seed-data/services.ts` | 63 ta LOR xizmati (demo) + 10 ta (lor-plus), 4 xil narx |
| `prisma/seed-data/patients.ts` | 60 ta bemor (demo, 18 tasi bola) + 6 ta (lor-plus) |
| `prisma/seed-data/diagnoses.ts` | 21 ta LOR tashxisi (ICD-10, shikoyat, anamnez, reja, tavsiya, odatiy xizmatlar) |

## Klinikalar

| Slug | Nomi | Shahar | Kiosk kaliti | roundTo | Bola yoshi | Ish vaqti |
| --- | --- | --- | --- | --- | --- | --- |
| `demo` | Shifo LOR Klinikasi | Toshkent | `demo-kiosk-key-2026` | 100 | < 14 | 08:00–20:00 |
| `lor-plus` | LOR Plus Medical | Samarqand | `lorplus-kiosk-key-2026` | 1000 | < 12 | 09:00–18:00 |

Kiosk / ekran: `/kiosk?key=demo-kiosk-key-2026`, `/display?key=demo-kiosk-key-2026`.

## Loginlar va parollar

| Login | Parol | Rol | Klinika | F.I.Sh. | Xona | Maosh |
| --- | --- | --- | --- | --- | --- | --- |
| `superadmin` | `Super123!` | SUPER_ADMIN | demo | Tizim administratori | — | — |
| `admin` | `Admin123!` | ADMIN | demo | Karimova Dilnoza Baxtiyorovna | 1 | FIXED 12 000 000 |
| `abdurahmon` | `12345678` | ADMIN | demo | Abdurahmon | — | — |
| `doctor` | `Doctor123!` | DOCTOR | demo | Rahimov Jasur Anvarovich (LOR-shifokor) | 3 | PERCENT 30 % |
| `doctor2` | `Doctor123!` | DOCTOR | demo | Yusupova Malika Rustamovna (LOR, otoxirurg) | 5 | PERCENT 35 % |
| `doctor3` | `Doctor123!` | DOCTOR | demo | Toshmatov Bekzod Oʻktamovich (bolalar LOR) | 7 | FIXED 8 000 000 |
| `reception` | `Reception123!` | RECEPTION | demo | Nazarova Gulnora Sobirovna | Registratura | FIXED 4 500 000 |
| `cashier` | `Cashier123!` | CASHIER | demo | Ergashev Sardor Alisherovich | Kassa | FIXED 4 500 000 |
| `admin2` | `Admin123!` | ADMIN | lor-plus | Saidov Otabek Farhodovich | 1 | FIXED 10 000 000 |
| `doctor4` | `Doctor123!` | DOCTOR | lor-plus | Mirzayeva Nilufar Shavkatovna | 2 | PERCENT 40 % |

Emaillar: `super@lor.uz`, `admin@lor.uz`, `doctor@lor.uz`, `doctor2@lor.uz`, `doctor3@lor.uz`,
`reception@lor.uz`, `cashier@lor.uz`, `admin@lorplus.uz`, `doctor@lorplus.uz`. Parollar bcrypt (12 raund).

## Xizmatlar (demo)

Kategoriyalar va kod prefikslari: **D** Koʻrik va diagnostika (11) · **N** Burun muolajalari (11) ·
**E** Quloq muolajalari (9) · **T** Tomoq muolajalari (8) · **F** Fizioterapiya (8) ·
**S** Kichik operatsiyalar (8) · **L** Analizlar (8). Jami **63**.

Narx qoidalari: butun ming soʻm, bolalar < kattalar, dori bilan > dorisiz. Koʻriklar, operatsiyalar va
analizlar `allowHalf=false`; muolajalar va kurslar (`seans`) `allowHalf=true`. Doim dori bilan
bajariladigan xizmatlar (`medicineOptional=false`): N-005, N-008, E-003, E-009, T-002, T-003.
Masalan N-001 «Burun yuvish (kukushka / ANTK)»: 120 000 / 150 000 (kattalar), 90 000 / 110 000 (bolalar).

## Bemorlar (demo)

60 ta bemor, karta raqamlari `2026-00001 … 2026-00060` (`formatCardNumber`), telefonlar `+9989XXXXXXXX`
(takrorlanmaydi), 18 tasi 14 yoshgacha, yoshi 1–75, Toshkent tumanlari manzillari, allergiya
(`Penitsillin`, `Yoʻq`, …), surunkali kasalliklar, izohlar. `createdAt` oxirgi 12 oyga tarqatilgan
(eng eski bemor eng kichik karta raqamini oladi); hech bir qabul bemor roʻyxatga olinishidan oldin emas.

## Tarixiy va bugungi maʼlumotlar (demo)

| Nima | Miqdor | Izoh |
| --- | --- | --- |
| Qabullar (COMPLETED) | 260 + bugun 2 | Oxirgi 90 kun, ish kunlari ogʻirroq (Dush–Jum 4 : Shan 2 : Yak 0.6) |
| Ochiq qabullar (OPEN) | 6 | Bugun: navbat/yozilishga bogʻlangan, baʼzilari qatorsiz, biri qisman toʻlangan |
| Muolaja qatorlari | ~760 | Har qabulda 1–5 ta; snapshot `calcLine` bilan; miqdor 0.5 karrali (`allowHalf`) yoki butun |
| Toʻlovlar | ~300 | CASH / CARD / CLICK / PAYME / TRANSFER; ~15 % qabullar qisman toʻlangan (qarz); chek raqami `YYYYMMDD-0001` |
| Navbat (bugun) | 8 | A-001…A-005 (DOCTOR), B-001 (RECHECK), C-001 (LAB), D-001 (CASHIER); DONE/SERVING/CALLED/WAITING |
| Yozilishlar (shu hafta) | 12 | Dush–Shan; oʻtganlar DONE/NO_SHOW, bugun 2 ta ARRIVED (qabulga bogʻlangan) + 1 CONFIRMED, kelgusi SCHEDULED/CONFIRMED |
| Kassa smenalari | 7 yopiq + 1 ochiq | Oxirgi 7 kun yopiq (jamlar toʻlov usuli boʻyicha), bugun `cashier` uchun ochiq; toʻlovlar kun boʻyicha bogʻlangan |
| Audit | ~38 | PRICE_CHANGE (5), SETTINGS, SHIFT_OPEN/CLOSE, PAYMENT (oxirgi 2 kun), VISIT_COMPLETE, LOGIN |
| SMS loglari | ~17 | APPOINTMENT_CONFIRM (SENT + 1 FAILED), APPOINTMENT_REMINDER, BIRTHDAY, CUSTOM (PENDING) |

Qabul jamlari `calcVisit` bilan bir xil: `totalGross = Σ grossTotal`, `discount = Σ discountTotal + umumiy chegirma`,
`totalNet = roundToStep(Σ lineTotal − umumiy chegirma, clinic.roundTo)`, `paidAmount = Σ payment.amount`.
Tashxislar — haqiqiy ICD-10 kodlari (J01.0, H66.0, J35.0, H60.3, J31.0, J03.9, H61.2, J32.0, J04.0, H65.0,
J34.2, J35.2, J30.1, J02.9, H72.9, J33.0, J06.9, T16, R04.0, J36, H90.3). Bolalar koʻproq `doctor3` ga,
kattalar `doctor` / `doctor2` ga tushadi.

LOR Plus (`lor-plus`): 18 ta qabul (oxirgi 30 kun), 3 yopiq + 1 ochiq smena — multi-tenant izolyatsiyani
tekshirish uchun (`admin2` faqat oʻz klinikasini koʻrishi kerak).

## Tekshirish

```bash
psql -h 127.0.0.1 -p 54329 -U postgres -d lor_dev -Atc 'select count(*) from "Service"'      # 73 (63 + 10)
psql -h 127.0.0.1 -p 54329 -U postgres -d lor_dev -Atc 'select count(*) from "Visit"'        # 286
psql -h 127.0.0.1 -p 54329 -U postgres -d lor_dev -Atc 'select number,status from "Queue" order by seq'
```

Seed oxirida klinikalar boʻyicha jadval (users, categories, services, patients, visits, openVisits, lines,
payments, debtVisits, queues, appointments, shifts, audits, sms) konsolga chiqariladi.
