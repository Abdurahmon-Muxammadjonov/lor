# LOR CRM — Arxitektura shartnomasi (CONTRACTS)

Bu hujjat loyihadagi **barcha modullar** uchun majburiy qoidalar. Har bir modul mustaqil papkada
yoziladi, lekin shu yerdagi interfeyslarga qatʼiy amal qiladi. Oʻqimasdan kod yozmang.

## 0. Stack (oʻzgartirilmaydi)

Next.js **14.2** App Router · React 18 · TypeScript strict (`noUncheckedIndexedAccess`) · Tailwind 3.4 + shadcn/ui
(qoʻlda yozilgan `src/components/ui/*`) · Framer Motion 11 · Prisma 5.22 (PostgreSQL) · NextAuth 4 (Credentials, JWT)
· TanStack Query 5 · Zustand 4 · React Hook Form 7 + Zod 3 · Recharts 2 · react-to-print 3 · decimal.js · date-fns 3
· lucide-react · sonner (toast) · exceljs (Excel) · @dnd-kit (kalendar drag&drop).

Import alias: `@/` → `src/`. Fayl nomlari: `kebab-case.tsx`. Komponentlar: `PascalCase`. Hooklar: `use-*.ts`.

## 1. Papka tuzilmasi va egalik

```
src/
  app/
    layout.tsx, providers.tsx, globals.css        ← [design-system egasi: globals.css; layout/providers tayyor]
    (marketing)/page.tsx, layout.tsx              ← [landing]
    (auth)/login/, forgot-password/, reset-password/   ← [auth]
    dashboard/layout.tsx, page.tsx                ← [dashboard-shell]
    dashboard/queue/                              ← [queue]
    dashboard/patients/, patients/[id]/           ← [patients]
    dashboard/visits/[id]/                        ← [visits]  (⭐ muolaja kalkulyatori)
    dashboard/appointments/                       ← [appointments]
    dashboard/cashier/                            ← [cashier]
    dashboard/services/                           ← [services]
    dashboard/doctors/                            ← [staff]
    dashboard/reports/                            ← [reports]
    dashboard/settings/                           ← [settings]
    kiosk/page.tsx, display/page.tsx              ← [queue]
    print/ticket/[id]/, print/receipt/[visitId]/  ← [queue] / [cashier]  (window.print fallback)
    api/
      auth/[...nextauth]/route.ts, auth/forgot/, auth/reset/   ← [auth]
      health/route.ts                                            ← tayyor
      dashboard/stats/route.ts                                   ← [dashboard-shell]
      queue/**, kiosk/**, display/**, print/**                   ← [queue]
      patients/**                                                ← [patients]
      visits/**, icd10/route.ts                                  ← [visits]
      appointments/**                                            ← [appointments]
      payments/**, shifts/**                                     ← [cashier]
      services/**, categories/**                                 ← [services]
      users/**                                                   ← [staff]
      reports/**                                                 ← [reports]
      settings/**, cron/**, webhooks/**                          ← [settings]
  components/
    ui/*            shadcn/ui primitivlari                       ← [design-system]
    effects/*       Aurora, Noise, Cursor, Magnetic, Reveal, Counter, Tilt, Glass, Marquee, Glow ← [design-system]
    shared/*        Money, PageHeader, EmptyState, DataTable, StatCard, Skeletons, ConfirmDialog, LangSwitch, SearchInput, Pagination ← [design-system]
    landing/*       ← [landing]
    dashboard/*     Sidebar, Topbar, charts ← [dashboard-shell]
    queue/*, patients/*, treatment/* (visits), appointments/*, cashier/*, services/*, staff/*, reports/*, settings/*
  lib/
    utils.ts, money.ts, calc.ts, prisma.ts, permissions.ts, date.ts, queue-number.ts   ← TAYYOR (oʻzgartirmang)
    api/*  (errors, respond, validate, handler, audit, client)                            ← TAYYOR
    auth/* (options, session, password, rate-limit)                                       ← TAYYOR; email.ts, reset-token.ts ← [auth]
    settings/types.ts                                                                     ← TAYYOR
    printer/*   escpos.ts, encode.ts, transports/{webusb,qz,network,browser}.ts, templates/{ticket,receipt}.ts, print.ts ← [queue]
    realtime/*  queue-events.ts (server), use-queue-realtime.ts (client)                  ← [queue]
    integrations/ eskiz.ts, telegram.ts, payments/{click,payme}.ts                        ← [settings]
    reports/*   aggregations, excel.ts                                                    ← [reports]
  i18n/           config, types, t, server.ts, client.tsx, messages/*  ← TAYYOR (messages/<modul>.ts ni modul egasi toʻldiradi)
  data/           icd10-lor.ts ← [visits]; anatomy.ts ← [visits]; landing-content.ts ← [landing]
  hooks/          use-debounce.ts, use-media-query.ts, use-reduced-motion.ts, use-hotkey.ts ← [design-system]
  stores/         use-ui-store.ts (sidebar) ← [dashboard-shell]; use-treatment-draft.ts ← [visits]; use-printer-store.ts ← [queue]
prisma/schema.prisma ← TAYYOR;  prisma/seed.ts, prisma/migrations ← [seed]
tests/           *.test.ts ← har modul oʻz testini yozadi (vitest)
supabase/rls.sql ← [security]
```

**Qoida:** boshqa modul papkasidagi faylni oʻzgartirmang. Kerak boʻlsa oʻz papkangizda yozing.
`src/i18n/messages/<modul>.ts` — faqat oʻz modulingizni toʻldiring (`common.ts` — design-system egasi).

## 2. Pul va hisoblash (`src/lib/money.ts`, `src/lib/calc.ts`)

- DB: `Decimal(14,2)`, **butun soʻm**. Arifmetika faqat `decimal.js` (`D()`), float ISHLATILMAYDI.
- API JSON: pul — **butun number** (`serialize()` Prisma.Decimal → number qiladi). Kiruvchi pul: `zMoney` (number|string → int).
- UI: `formatMoney(v)` → `"1 250 000 soʻm"` (`suffix` param bilan `'сум'` — RU da `t('common.currency')`).
- `calcLine(line, service)` → `{unitPrice, gross, discount, net, quantity}` (Decimal). `calcVisit(nets, globalDiscount, payments, roundTo)`.
- `validateQuantity(q, allowHalf)` — `CalcError('INVALID_QUANTITY' | 'HALF_NOT_ALLOWED')`. `snapQuantity`, `quantityStep`, `formatQuantity`.
- `pickUnitPrice(service, patientType, withMedicine)` — `medicineOptional=false` boʻlsa doim "dori bilan" narx.
- `determinePatientType(birthDate, clinic.childAgeLimit)` → `'ADULT' | 'CHILD'`.
- Serverda **snapshot**: TreatmentLine ga `serviceCode, serviceName, serviceNameRu, unit, unitPrice, grossTotal, discountTotal, lineTotal` yoziladi. Chek/tarix faqat snapshotdan oʻqiydi.
- Visit jamlari (`totalGross, discount, totalNet, paidAmount`) har qator/toʻlov oʻzgarganda serverda qayta hisoblanadi (`recalcVisit(tx, visitId)` — [visits] moduli `src/lib/visits/recalc.ts` da yozadi; [cashier] uni import qiladi).

## 3. API qoidalari (`src/lib/api`)

```ts
import { withAuth, ok, created, ApiError, parseBody, parseQuery, audit, zMoney, zId, zPage, zText } from '@/lib/api';

export const GET = withAuth({ permission: 'patients.view' }, async ({ user, clinicId, req, params }) => {
  const q = parseQuery(req, z.object({ search: z.string().optional() }).merge(zPage));
  ...
  return ok({ items, total, page, pageSize });
});
export const POST = withAuth({ permission: 'patients.write' }, async ({ user, clinicId, req, ip }) => {
  const body = await parseBody(req, CreatePatientSchema);
  const row = await prisma.$transaction(async (tx) => { ...; await audit({...}, tx); return created; });
  return created(row);
});
```

- Javob: `{ ok: true, data }` / `{ ok: false, error: { code, message, details } }`. Roʻyxatlar: `{ items, total, page, pageSize }`.
- **Har bir soʻrov `clinicId` boʻyicha filtrlanadi** (`where: { clinicId }`), `findUnique` oʻrniga `findFirst({ where: { id, clinicId } })`.
- Rol tekshiruvi faqat `withAuth({ permission })` orqali — `src/lib/permissions.ts` matritsasi. UI da `can(role, perm)` bilan yashiriladi, lekin himoya serverda.
- Dinamik segment: `withAuth<{ id: string }>({...}, async ({ params }) => ...)`.
- Pul/narx/toʻlov oʻzgarishlari → `audit()` (`PRICE_CHANGE`, `PAYMENT`, `REFUND`, ...).
- Ochiq endpointlar (`/api/kiosk/*`, `/api/display/*`) `withPublic` + `?key=<clinic.kioskKey>` bilan klinikani aniqlaydi. Middleware ularni oʻtkazadi.
- Route fayllarda `export const dynamic = 'force-dynamic'` (DB oʻqiydigan GET larda).
- Zod sxemalar `src/lib/<modul>/schemas.ts` da; client va server bir sxemani ishlatadi.

**Mijoz:** `import { api, qs } from '@/lib/api/client'` → `api.get<T>('/api/patients' + qs({search}))`. TanStack Query kalitlari:
`['patients', params]`, `['patient', id]`, `['visit', id]`, `['queue', dateKey]`, `['services']`, `['stats', range]`, `['shift','current']` …
Mutatsiyadan soʻng `queryClient.invalidateQueries({ queryKey: [...] })`. Xatolarni `toast.error(err.message)` (sonner).

## 4. Auth va sessiya

- `getCurrentUser()` / `requireUser(permission?)` — server komponentlarda (`src/lib/auth/session.ts`).
- Client: `useSession()` (next-auth/react) → `session.user.{id, role, clinicId, clinicName, fullName, room, color}`.
- Login: `signIn('credentials', { login, password, redirect: false })`. Xato kodlari: `INVALID_CREDENTIALS | RATE_LIMITED | INACTIVE | CLINIC_INACTIVE` (`res.error`).
- Middleware `/dashboard/*` va `/api/*` ni himoya qiladi; mutatsiyalar `X-Requested-With: lor-crm` sarlavhasisiz 403 (api client buni avtomatik qoʻyadi).
- Rollar: SUPER_ADMIN, ADMIN, DOCTOR, RECEPTION, CASHIER. `homeForRole(role)`.

## 5. i18n (UZ lotin / RU) — hamma matn ikki tilda

- Server: `const t = getT(); t('patients.title')`, `getLocale()`. Client: `const t = useT()`, `const { locale, setLocale } = useLocale()`.
- Har modul `src/i18n/messages/<modul>.ts` ni `defineMessages({ uz: {...}, ru: {...} })` bilan toʻldiradi. `ru` shakli `uz` bilan bir xil boʻlishi shart (tip tekshiradi).
- Kalit yoʻli `<modul>.<...>`: `t('queue.kiosk.title')`. Parametr: `t('queue.ahead', { n: 3 })` → `"{n}"`.
- Ikki tilli DB maydonlari (`name`/`nameRu`): `pickLang(obj, locale)`.
- Oʻzbek apostrofi: **ʻ (U+02BB)** — `oʻ`, `gʻ`. Tutuq belgisi: **ʼ (U+02BC)** — `maʼlumot`. `'` ISHLATMANG.
- Umumiy kalitlar (`common.*`, design-system egasi yozadi): `save, cancel, delete, edit, add, search, close, back, next, confirm, yes, no, loading, noData, error, success, currency ("soʻm"/"сум"), today, yesterday, date, time, status, actions, total, all, print, export, filter, name, phone, birthDate, gender.male, gender.female, role.ADMIN…, patientType.ADULT/CHILD, withMedicine, withoutMedicine, side.LEFT/RIGHT/BOTH, organ.EAR/NOSE/THROAT/LARYNX/OTHER, payMethod.CASH/CARD/TRANSFER/CLICK/PAYME, queueStatus.*, visitStatus.*, appointmentStatus.*, nav.* (sidebar nomlari), validation.required/phone/min/max`.

## 6. Dizayn tizimi ("Clinical Luxury Dark")

CSS oʻzgaruvchilar (`globals.css`): `--bg-base #060810, --bg-elevated #0D1220, --surface #131A2B, --border #1F2A40, --accent #00D4FF, --accent-2 #7C5CFF, --accent-3 #00FFB2, --text #EAF0FF, --text-muted #8A99B8, --danger #FF4D6D, --radius 12px`.
Tailwind: `bg-bg-base bg-bg-elevated bg-surface border-line text-text text-text-muted text-accent bg-accent-2 text-danger bg-gradient-accent shadow-glow font-heading`.
shadcn semantik ranglar ham ishlaydi (`bg-background text-foreground bg-card border-border text-muted-foreground bg-primary`).

Utility klasslar (`globals.css` da design-system egasi yozadi): `.glass` (blur 20px + 1px gradient border), `.glass-strong`, `.text-gradient`,
`.glow`, `.glow-violet`, `.noise` (overlay 0.03), `.scrollbar-thin`, `.font-heading` (letter-spacing -0.03em), `.tabular` (tabular-nums).

**UI primitivlar** (`src/components/ui/*`, standart shadcn API, `cn()`): `button` (variant: default|secondary|outline|ghost|destructive|link|gradient, size: default|sm|lg|xl|icon), `input`, `textarea`, `label`, `card` (Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter), `dialog`, `select`, `tabs`, `accordion`, `dropdown-menu`, `popover`, `switch`, `radio-group`, `checkbox`, `tooltip`, `scroll-area`, `separator`, `avatar`, `badge` (variant: default|secondary|outline|success|warning|danger|accent), `table` (Table, TableHeader, TableBody, TableRow, TableHead, TableCell), `skeleton`, `command` (cmdk), `sheet` (Dialog asosida), `progress`, `calendar` (oddiy oy grid, react-day-picker YOʻQ), `segmented` (radio-group asosida pill toggle: `<Segmented value onChange options=[{value,label}] />`), `number-stepper` (`<NumberStepper value onChange step min max />` — 0.5 qadam).

**Shared** (`src/components/shared/*`): `<Money value suffix? className? />`, `<PageHeader title description? actions? />`, `<EmptyState icon title description? action? />`, `<StatCard title value delta? icon trend? />`, `<DataTable columns data loading? emptyText? />` (oddiy, generic), `<ConfirmDialog />`, `<LangSwitch />`, `<SearchInput />`, `<Pagination page pageSize total onChange />`, `<StatusBadge status kind="queue|visit|appointment" />`, `<Logo />`.

**Effects** (`src/components/effects/*`): `<AuroraBackground />`, `<NoiseOverlay />`, `<CustomCursor />` (faqat desktop, pointer:fine), `<Magnetic>` (tugma oʻrami), `<Reveal delay? >` (whileInView, stagger 0.08), `<Counter to suffix? duration? />`, `<Tilt>` (3D, qoʻlda), `<Marquee>`, `<GlowCard>`.
Barchasi `prefers-reduced-motion` ni hurmat qiladi (`useReducedMotion` hook: `src/hooks/use-reduced-motion.ts`). Mobilda (`< 768px`) ogʻir effektlar oʻchadi.

## 7. Realtime (navbat)

`src/lib/realtime/queue-events.ts` — serverda: `publishQueueEvent(clinicId, event)`. Transport: **SSE** `GET /api/display/stream?key=` (2 s DB polling → `data:` event). Client: `useQueueRealtime(key | null, { onEvent })` (Supabase Realtime agar `NEXT_PUBLIC_SUPABASE_URL` boʻlsa, aks holda SSE, u ham boʻlmasa 3 s polling). Dashboard queue sahifasi ham shu hookdan foydalanadi (`key` oʻrniga sessiya — `/api/queue/stream`).

## 8. Chop etish

`src/lib/printer/print.ts`: `printTicket(ticket: TicketData, settings: PrinterSettings)` va `printReceipt(receipt: ReceiptData, settings)`. Transportni `settings.transport` tanlaydi: `WEBUSB` (navigator.usb), `QZ` (window.qz, `/qz-tray.js` public dan yuklanadi), `NETWORK` (`POST /api/print/raw` → server `net.Socket` IP:9100), `BROWSER` (`/print/ticket/[id]` iframe + `window.print()`). Har qanday transport xatosida BROWSER fallback. ESC/POS builder 58/80 mm, kodlash CP866/CP1251/ASCII (`encode.ts` — oʻz jadvali, kutubxonasiz; serverda `iconv-lite` ishlatish mumkin).
Tipler: `TicketData { clinicName, phone, number, service, date, time, ahead, waitMin, footer }`, `ReceiptData { clinicName, phone, address?, receiptNo, patientName, cardNumber, doctor, lines: {name, qty, unit, unitPrice, total, side?, organ?}[], subtotal, discount, total, paid, balance, cashier, dateTime, qrText?, footer }`.

## 9. Sozlamalar

`Clinic.settings` Json → `parseClinicSettings(json)` (`src/lib/settings/types.ts`): `printer`, `sms`, `telegram`, `queue` (prefikslar A/B/C/D, kiosk turlari). `User.schedule` → `parseWeeklySchedule`.

## 10. Testlar (vitest, `tests/*.test.ts` yoki `src/**/*.test.ts`)

DB kerak boʻlsa `process.env.DATABASE_URL` (lokal Postgres) — DB testlarini `tests/db/*.test.ts` ga yozing va faylning boshida `if (!process.env.DATABASE_URL) describe.skip(...)`. API route testlari: `vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))` bilan sessiya berib, route handlerni `new NextRequest(...)` bilan chaqirish.

## 11. Qabul mezonlari (har biri test bilan isbotlanadi)

1. `1.5 × 120 000 = 180 000` · 2–3. bemor turi / dori oʻzgarganda narx darhol (client `useMemo` + `calcLine`) · 4. `allowHalf=false` → 0.5 rad (UI stepper + server 400 `HALF_NOT_ALLOWED`) · 5. 5 xil qator alohida, jami toʻgʻri · 6. chegirma % va soʻm · 7. kiosk → raqam + printer · 8. raqam har kuni 001 dan (`Queue.date` + `seq`) · 9. DOCTOR narxni oʻzgartira olmaydi (`services.write` → 403) · 10. narx oʻzgarsa eski qabul summasi oʻzgarmaydi (snapshot) · 11. Lighthouse ≥ 85 / a11y ≥ 95 · 12. UZ↔RU butun saytda.

## 12. Umumiy sifat qoidalari

- TODO / placeholder / lorem ipsum YOʻQ. Barcha matn haqiqiy oʻzbek (lotin) va rus tilida.
- Har bir sahifa: loading holati (`Skeleton`), boʻsh holat (`EmptyState`), xato (toast). Mobil (≥ 360px) ishlaydi.
- `'use client'` faqat kerak boʻlganda. Server komponentlarda `requireUser()`.
- `console.log` qoldirmang. Har bir eksport tipi aniq. `any` ISHLATMANG (`unknown` + narrowing).
- Tugmalarda `aria-label`, formalarda `<Label htmlFor>`; kontrast WCAG AA (muted matn `#8A99B8` faqat 14px+ da).
- Sana: `fmtDate/fmtTime/fmtDateTime(d, locale)` (`src/lib/date.ts`). Telefon: `formatPhone`, `normalizePhone`.
