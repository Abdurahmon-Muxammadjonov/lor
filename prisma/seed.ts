/**
 * LOR CRM — demo maʼlumotlar (seed).
 *
 * Ishga tushirish:  npm run db:seed   (tsx prisma/seed.ts)
 *
 * Idempotent: klinika / xodim / kategoriya / xizmat / bemor — unikal kalit boʻyicha upsert.
 * Tranzaksion maʼlumotlar (qabullar, toʻlovlar, navbat, yozilishlar, smenalar, audit, SMS)
 * har safar oʻchirilib, seedlangan RNG bilan qayta yaratiladi — bir kunda qayta ishga
 * tushirilsa, natija aynan bir xil boʻladi.
 */
import {
  Prisma,
  PrismaClient,
  type AppointmentStatus,
  type Clinic,
  type Organ,
  type Patient,
  type PayMethod,
  type QueueStatus,
  type QueueType,
  type Service,
  type Side,
  type User,
} from '@prisma/client';
import Decimal from 'decimal.js';
import { hashPassword } from '../src/lib/auth/password';
import {
  calcLine,
  calcVisit,
  determinePatientType,
  type DiscountType,
  type PatientType,
} from '../src/lib/calc';
import { dateKeyToDate, todayKey } from '../src/lib/date';
import { D, roundToStep, sumMoney } from '../src/lib/money';
import { formatCardNumber, formatQueueNumber, formatReceiptNo } from '../src/lib/queue-number';
import { parseClinicSettings } from '../src/lib/settings/types';
import { CATEGORIES, LOR_PLUS_CATEGORIES, type CategorySeed } from './seed-data/categories';
import { CLINICS, DEMO_CLINIC, LOR_PLUS_CLINIC, type ClinicSeed } from './seed-data/clinic';
import { DIAGNOSES, type DiagnosisSeed } from './seed-data/diagnoses';
import { LOR_PLUS_PATIENTS, PATIENTS, type PatientSeed } from './seed-data/patients';
import { Rng, seedFromString } from './seed-data/rng';
import { LOR_PLUS_SERVICES, SERVICES, type ServiceSeed } from './seed-data/services';
import { USERS } from './seed-data/users';

const prisma = new PrismaClient({ log: ['warn', 'error'] });

/** SEED_NOW (ISO) — sinov uchun "hozir"ni qotirib qoʻyish; odatda haqiqiy vaqt */
const NOW_RAW = process.env.SEED_NOW ? new Date(process.env.SEED_NOW) : new Date();
if (Number.isNaN(NOW_RAW.getTime())) throw new Error(`SEED_NOW notoʻgʻri: ${process.env.SEED_NOW ?? ''}`);
/** Daqiqagacha yaxlitlangan — bir daqiqa ichida qayta ishga tushirilsa, vaqt tamgʻalari ham bir xil */
const NOW = new Date(Math.floor(NOW_RAW.getTime() / 60_000) * 60_000);
const TODAY = todayKey(NOW);
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

// ───────────────────────────── Yordamchilar ─────────────────────────────

/** "YYYY-MM-DD" + n kun */
function keyPlusDays(key: string, n: number): string {
  return new Date(dateKeyToDate(key).getTime() + n * DAY).toISOString().slice(0, 10);
}

/** Hafta kuni (0 = yakshanba ... 6 = shanba) */
function dow(key: string): number {
  return dateKeyToDate(key).getUTCDay();
}

/** Toshkent vaqti boʻyicha sana + soat → UTC Date */
function atTz(key: string, hm: string): Date {
  return new Date(`${key}T${hm}:00+05:00`);
}

/** Toshkent vaqti boʻyicha sana + daqiqalar (kun boshidan) → UTC Date */
function atMinutes(key: string, minutes: number): Date {
  const h = String(Math.floor(minutes / 60)).padStart(2, '0');
  const m = String(minutes % 60).padStart(2, '0');
  return atTz(key, `${h}:${m}`);
}

function addMinutes(d: Date, min: number): Date {
  return new Date(d.getTime() + min * MINUTE);
}

/** Bugungi vaqt hozirdan keyin boʻlsa — hozirdan biroz oldinga suriladi */
function clampPast(d: Date, backMinutes = 1): Date {
  const limit = NOW.getTime() - backMinutes * MINUTE;
  return d.getTime() > limit ? new Date(limit) : d;
}

function asDate(v: Date | string): Date {
  return v instanceof Date ? v : new Date(v);
}

function toJson(v: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
}

/** Decimal → DB uchun butun soʻm satri */
function money(v: Decimal | number | string): string {
  return D(v.toString()).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toFixed(0);
}

function dec(v: Prisma.Decimal | Decimal | number | string): Decimal {
  return D(v.toString());
}

/** Xizmat haqiqatan mavjudligini tekshirish */
function must<T>(v: T | undefined | null, what: string): T {
  if (v === undefined || v === null) throw new Error(`Seed: ${what} topilmadi`);
  return v;
}

// ───────────────────────────── Master maʼlumotlar (upsert) ─────────────────────────────

async function upsertClinic(seed: ClinicSeed): Promise<Clinic> {
  const data = {
    name: seed.name,
    phone: seed.phone,
    email: seed.email,
    address: seed.address,
    city: seed.city,
    timezone: 'Asia/Tashkent',
    childAgeLimit: seed.childAgeLimit,
    currency: 'UZS',
    roundTo: seed.roundTo,
    workStart: seed.workStart,
    workEnd: seed.workEnd,
    slotMinutes: seed.slotMinutes,
    kioskKey: seed.kioskKey,
    ticketFooter: seed.ticketFooter,
    settings: toJson(seed.settings),
    plan: seed.plan,
    isActive: true,
  };
  return prisma.clinic.upsert({
    where: { slug: seed.slug },
    create: { slug: seed.slug, ...data },
    update: data,
  });
}

async function upsertUsers(clinicBySlug: Map<string, Clinic>): Promise<Map<string, User>> {
  const out = new Map<string, User>();
  let loginIdx = 0;
  for (const u of USERS) {
    const clinic = must(clinicBySlug.get(u.clinicSlug), `klinika ${u.clinicSlug}`);
    const password = await hashPassword(u.password);
    // Bugun tizimga kirganlar (SUPER_ADMIN dan tashqari) — xodimlar sahifasida koʻrinadi
    const lastLoginAt =
      u.role === 'SUPER_ADMIN' ? null : clampPast(addMinutes(atTz(TODAY, '07:50'), loginIdx * 3), 15);
    loginIdx += 1;
    const data = {
      clinicId: clinic.id,
      email: u.email,
      password,
      fullName: u.fullName,
      role: u.role,
      phone: u.phone,
      specialty: u.specialty,
      room: u.room,
      color: u.color,
      salaryType: u.salaryType,
      salaryValue: String(u.salaryValue),
      schedule: toJson(u.schedule),
      isActive: true,
      lastLoginAt,
    };
    const row = await prisma.user.upsert({
      where: { login: u.login },
      create: { login: u.login, ...data },
      update: data,
    });
    out.set(u.login, row);
  }
  return out;
}

async function upsertCategories(clinic: Clinic, seeds: CategorySeed[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const c of seeds) {
    const row = await prisma.serviceCategory.upsert({
      where: { clinicId_name: { clinicId: clinic.id, name: c.name } },
      create: { clinicId: clinic.id, name: c.name, nameRu: c.nameRu, icon: c.icon, order: c.order },
      update: { nameRu: c.nameRu, icon: c.icon, order: c.order },
    });
    out.set(c.key, row.id);
  }
  return out;
}

async function upsertServices(
  clinic: Clinic,
  seeds: ServiceSeed[],
  categoryIds: Map<string, string>,
): Promise<Service[]> {
  const out: Service[] = [];
  for (const s of seeds) {
    const categoryId = must(categoryIds.get(s.category), `kategoriya ${s.category}`);
    const data = {
      categoryId,
      name: s.name,
      nameRu: s.nameRu,
      unit: s.unit,
      priceAdultNoMed: String(s.priceAdultNoMed),
      priceAdultMed: String(s.priceAdultMed),
      priceChildNoMed: String(s.priceChildNoMed),
      priceChildMed: String(s.priceChildMed),
      allowHalf: s.allowHalf,
      medicineOptional: s.medicineOptional,
      durationMin: s.durationMin,
      defaultOrgan: s.defaultOrgan,
      isActive: true,
      order: s.order,
    };
    const row = await prisma.service.upsert({
      where: { clinicId_code: { clinicId: clinic.id, code: s.code } },
      create: { clinicId: clinic.id, code: s.code, ...data },
      update: data,
    });
    out.push(row);
  }
  return out;
}

/**
 * Bemorlar: karta raqami 2026-00001 dan tartib bilan; createdAt oxirgi `spreadDays` kun
 * ichida (eng eski bemor eng kichik karta raqamini oladi).
 */
async function upsertPatients(
  clinic: Clinic,
  seeds: PatientSeed[],
  rng: Rng,
  spreadDays: number,
  minDaysAgo: number,
): Promise<Patient[]> {
  const daysAgo = seeds.map(() => rng.int(minDaysAgo, spreadDays)).sort((a, b) => b - a);
  const out: Patient[] = [];
  for (let i = 0; i < seeds.length; i++) {
    const s = must(seeds[i], `bemor #${i}`);
    const ago = must(daysAgo[i], 'daysAgo');
    const createdAt = clampPast(atMinutes(keyPlusDays(TODAY, -ago), rng.int(8 * 60, 19 * 60)));
    const cardNumber = formatCardNumber(2026, i + 1);
    const data = {
      fullName: s.fullName,
      birthDate: dateKeyToDate(s.birthDate),
      gender: s.gender,
      phone: s.phone,
      phone2: s.phone2,
      address: s.address,
      allergies: s.allergies,
      chronic: s.chronic,
      notes: s.notes,
      source: s.source,
      smsConsent: true,
      createdAt,
    };
    const row = await prisma.patient.upsert({
      where: { clinicId_cardNumber: { clinicId: clinic.id, cardNumber } },
      create: { clinicId: clinic.id, cardNumber, ...data },
      update: data,
    });
    out.push(row);
  }
  return out;
}

// ───────────────────────────── Tranzaksion maʼlumotlar ─────────────────────────────

interface Ctx {
  clinic: Clinic;
  rng: Rng;
  doctors: User[];
  cashier: User;
  admin: User;
  reception: User | null;
  services: Service[];
  serviceByCode: Map<string, Service>;
  patients: Patient[];
  /** Kun boʻyicha chek raqami hisoblagichi */
  receiptSeq: Map<string, number>;
  /** ID prefiksi: demo → "demo-v-0001" */
  idPrefix: string;
  counters: {
    visit: number;
    line: number;
    payment: number;
    queue: number;
    appointment: number;
    shift: number;
  };
}

interface PaymentRec extends Omit<Prisma.PaymentCreateManyInput, 'createdAt' | 'shiftId'> {
  createdAt: Date;
  shiftId: string | null;
}

interface Bundle {
  shifts: Prisma.CashShiftCreateManyInput[];
  queues: Prisma.QueueCreateManyInput[];
  appointments: Prisma.AppointmentCreateManyInput[];
  visits: Prisma.VisitCreateManyInput[];
  lines: Prisma.TreatmentLineCreateManyInput[];
  payments: PaymentRec[];
  audits: Prisma.AuditLogCreateManyInput[];
  sms: Prisma.SmsLogCreateManyInput[];
}

function emptyBundle(): Bundle {
  return {
    shifts: [],
    queues: [],
    appointments: [],
    visits: [],
    lines: [],
    payments: [],
    audits: [],
    sms: [],
  };
}

function nextId(ctx: Ctx, kind: keyof Ctx['counters']): string {
  ctx.counters[kind] += 1;
  const short: Record<keyof Ctx['counters'], string> = {
    visit: 'v',
    line: 'l',
    payment: 'p',
    queue: 'q',
    appointment: 'a',
    shift: 's',
  };
  return `${ctx.idPrefix}-${short[kind]}-${String(ctx.counters[kind]).padStart(4, '0')}`;
}

function nextReceiptNo(ctx: Ctx, at: Date): string {
  const key = todayKey(at);
  const seq = (ctx.receiptSeq.get(key) ?? 0) + 1;
  ctx.receiptSeq.set(key, seq);
  return formatReceiptNo(key, seq);
}

function pickSide(rng: Rng, organ: Organ | null): Side | null {
  if (organ === 'EAR')
    return rng.weighted<Side>([
      ['LEFT', 35],
      ['RIGHT', 35],
      ['BOTH', 30],
    ]);
  if (organ === 'NOSE')
    return rng.weighted<Side>([
      ['BOTH', 60],
      ['LEFT', 20],
      ['RIGHT', 20],
    ]);
  return null;
}

const LINE_DETAILS: Record<string, string> = {
  'N-003': 'gaymor sinusi',
  'N-004': 'gaymor sinusi',
  'E-001': 'tashqi eshitish yoʻli',
  'E-007': 'tashqi eshitish yoʻli',
  'T-001': 'tanglay bodomchalari',
  'T-006': 'tanglay bodomchalari',
  'D-003': 'burun boʻshligʻi, burun-halqum',
  'D-004': 'hiqildoq, ovoz boylamlari',
};

const LINE_NOTES = [
  'Bemor muolajani yaxshi koʻtardi',
  'Mahalliy ogʻriqsizlantirish bilan',
  'Kurs davom etmoqda',
  'Nazorat koʻrigi 5 kundan soʻng',
];

function pickQuantity(rng: Rng, service: Service): number {
  if (!service.allowHalf)
    return rng.weighted<number>([
      [1, 9],
      [2, 1],
    ]);
  if (service.unit === 'seans')
    return rng.weighted<number>([
      [1, 3],
      [3, 2],
      [5, 3],
      [7, 1],
      [10, 1],
      [2.5, 1],
      [1.5, 1],
    ]);
  return rng.weighted<number>([
    [1, 6],
    [1.5, 1],
    [2, 2],
    [0.5, 1],
  ]);
}

function pickDiscount(rng: Rng): { type: DiscountType; value: number } {
  if (!rng.chance(0.12)) return { type: 'NONE', value: 0 };
  if (rng.chance(0.6)) return { type: 'PERCENT', value: rng.pick([5, 10, 15, 20]) };
  return { type: 'FIXED', value: rng.pick([10000, 20000, 30000, 50000]) };
}

function pickMethod(rng: Rng): PayMethod {
  return rng.weighted<PayMethod>([
    ['CASH', 45],
    ['CARD', 22],
    ['CLICK', 15],
    ['PAYME', 12],
    ['TRANSFER', 6],
  ]);
}

interface LineOut {
  data: Prisma.TreatmentLineCreateManyInput;
  gross: Decimal;
  discount: Decimal;
  net: Decimal;
}

/** Bitta muolaja qatori — snapshot calcLine orqali */
function makeLine(
  ctx: Ctx,
  visitId: string,
  service: Service,
  patientType: PatientType,
  order: number,
  createdAt: Date,
): LineOut {
  const rng = ctx.rng;
  const withMedicine = service.medicineOptional ? rng.chance(0.5) : true;
  const quantity = pickQuantity(rng, service);
  const discount = pickDiscount(rng);
  const r = calcLine(
    { patientType, withMedicine, quantity, discountType: discount.type, discountValue: discount.value },
    {
      priceAdultNoMed: dec(service.priceAdultNoMed),
      priceAdultMed: dec(service.priceAdultMed),
      priceChildNoMed: dec(service.priceChildNoMed),
      priceChildMed: dec(service.priceChildMed),
      allowHalf: service.allowHalf,
      medicineOptional: service.medicineOptional,
    },
  );
  const organ = service.defaultOrgan;
  const data: Prisma.TreatmentLineCreateManyInput = {
    id: nextId(ctx, 'line'),
    visitId,
    serviceId: service.id,
    serviceCode: service.code,
    serviceName: service.name,
    serviceNameRu: service.nameRu,
    unit: service.unit,
    patientType,
    withMedicine,
    quantity: r.quantity.toFixed(1),
    unitPrice: money(r.unitPrice),
    grossTotal: money(r.gross),
    discountType: discount.type,
    discountValue: discount.type === 'NONE' ? '0' : D(discount.value).toFixed(2),
    discountTotal: money(r.discount),
    lineTotal: money(r.net),
    side: pickSide(rng, organ),
    organ,
    detail: LINE_DETAILS[service.code] ?? null,
    note: rng.chance(0.1) ? rng.pick(LINE_NOTES) : null,
    order,
    createdAt,
  };
  return { data, gross: r.gross, discount: r.discount, net: r.net };
}

function pickDoctor(ctx: Ctx, patientType: PatientType): User {
  const pediatric = ctx.doctors.filter((d) => (d.specialty ?? '').includes('Bolalar'));
  const general = ctx.doctors.filter((d) => !(d.specialty ?? '').includes('Bolalar'));
  if (patientType === 'CHILD' && pediatric.length > 0 && ctx.rng.chance(0.7)) return ctx.rng.pick(pediatric);
  if (patientType === 'ADULT' && general.length > 0 && ctx.rng.chance(0.9)) return ctx.rng.pick(general);
  return ctx.rng.pick(ctx.doctors);
}

function pickDiagnosis(rng: Rng, patientType: PatientType): DiagnosisSeed {
  const pool = DIAGNOSES.filter((d) =>
    patientType === 'CHILD' ? d.childOnly !== false : d.childOnly !== true,
  );
  return rng.pick(pool);
}

/** Qabul uchun xizmatlar roʻyxati: koʻrik + tashxisga mos muolajalar (1–5 ta) */
function pickServices(ctx: Ctx, diag: DiagnosisSeed, maxLines: number): Service[] {
  const rng = ctx.rng;
  const byCode = ctx.serviceByCode;
  const chosen: Service[] = [];
  const exam = rng.chance(0.65)
    ? (byCode.get('D-001') ?? byCode.get('P-001'))
    : (byCode.get('D-002') ?? byCode.get('P-002'));
  if (exam) chosen.push(exam);

  const candidates = diag.services
    .map((code) => byCode.get(code))
    .filter((s): s is Service => s !== undefined)
    // Operatsiyalar kamdan-kam (20 %)
    .filter((s) => !s.code.startsWith('S-') || rng.chance(0.2));

  const fallback = ctx.services.filter(
    (s) => !chosen.includes(s) && !['D-001', 'D-002', 'P-001', 'P-002'].includes(s.code),
  );
  const pool = candidates.length > 0 ? candidates : rng.sample(fallback, 3);
  const extraCount = Math.min(
    maxLines - chosen.length,
    rng.weighted<number>([
      [0, 1],
      [1, 4],
      [2, 4],
      [3, 2],
      [4, 1],
    ]),
  );
  for (const s of pool) {
    if (chosen.length >= 1 + extraCount) break;
    if (!chosen.includes(s)) chosen.push(s);
  }
  if (chosen.length === 0) chosen.push(rng.pick(ctx.services));
  return chosen;
}

interface VisitOpts {
  patient: Patient;
  createdAt: Date;
  status: 'OPEN' | 'COMPLETED';
  /** Qatorlar boʻlsinmi (OPEN qabullarda baʼzan boʻsh) */
  withLines: boolean;
  /** 'full' | 'partial' | 'none' | 'auto' (COMPLETED: 15 % qarz) */
  payment: 'full' | 'partial' | 'none' | 'auto';
  doctor?: User;
  queueId?: string | null;
  appointmentId?: string | null;
  maxLines?: number;
}

/** Bitta qabul (qatorlar + toʻlovlar bilan) — jamlar calcVisit bilan */
function makeVisit(ctx: Ctx, b: Bundle, o: VisitOpts): Prisma.VisitCreateManyInput {
  const rng = ctx.rng;
  const id = nextId(ctx, 'visit');
  const patientType = determinePatientType(o.patient.birthDate, ctx.clinic.childAgeLimit, o.createdAt);
  const doctor = o.doctor ?? pickDoctor(ctx, patientType);
  const diag = pickDiagnosis(rng, patientType);

  const lines: LineOut[] = [];
  if (o.withLines) {
    const services = pickServices(ctx, diag, o.maxLines ?? 5);
    services.forEach((s, i) =>
      lines.push(makeLine(ctx, id, s, patientType, i + 1, addMinutes(o.createdAt, 3 + i * 2))),
    );
  }

  const global: { type: DiscountType; value: number } =
    lines.length > 0 && rng.chance(0.06)
      ? rng.chance(0.5)
        ? { type: 'PERCENT', value: rng.pick([5, 10]) }
        : { type: 'FIXED', value: 20000 }
      : { type: 'NONE', value: 0 };

  const nets = lines.map((l) => l.net);
  const pre = calcVisit(nets, global, [], ctx.clinic.roundTo);
  const total = pre.total;

  // Toʻlovlar
  const payAmounts: Decimal[] = [];
  const mode = o.payment === 'auto' ? (rng.chance(0.15) ? 'partial' : 'full') : o.payment;
  if (total.gt(0) && mode !== 'none') {
    if (mode === 'partial') {
      let part = roundToStep(total.mul(rng.pick([0.3, 0.4, 0.5, 0.6, 0.7, 0.8])), 1000);
      if (part.gte(total)) part = roundToStep(total.div(2), 100);
      if (part.gt(0)) payAmounts.push(part);
    } else if (rng.chance(0.2) && total.gte(100000)) {
      const first = roundToStep(total.mul(0.5), 1000);
      payAmounts.push(first, total.minus(first));
    } else {
      payAmounts.push(total);
    }
  }
  const completedAt = o.status === 'COMPLETED' ? addMinutes(o.createdAt, rng.int(15, 60)) : null;
  let payAt = addMinutes(completedAt ?? o.createdAt, rng.int(2, 12));
  const usedMethods = new Set<PayMethod>();
  for (const amount of payAmounts) {
    let method = pickMethod(rng);
    if (usedMethods.has(method)) method = method === 'CASH' ? 'CARD' : 'CASH';
    usedMethods.add(method);
    payAt = clampPast(payAt);
    b.payments.push({
      id: nextId(ctx, 'payment'),
      clinicId: ctx.clinic.id,
      visitId: id,
      shiftId: null,
      amount: money(amount),
      method,
      cashierId: ctx.cashier.id,
      receiptNo: nextReceiptNo(ctx, payAt),
      note: null,
      createdAt: payAt,
    });
    payAt = addMinutes(payAt, rng.int(1, 5));
  }

  const totals = calcVisit(nets, global, payAmounts, ctx.clinic.roundTo);
  const totalGross = sumMoney(lines.map((l) => l.gross));
  const discount = sumMoney(lines.map((l) => l.discount)).plus(totals.globalDiscount);

  const hasClinical = lines.length > 0 || o.status === 'COMPLETED';
  const visit: Prisma.VisitCreateManyInput = {
    id,
    clinicId: ctx.clinic.id,
    patientId: o.patient.id,
    doctorId: doctor.id,
    queueId: o.queueId ?? null,
    appointmentId: o.appointmentId ?? null,
    complaint: diag.complaint,
    anamnesis: hasClinical ? diag.anamnesis : null,
    examination: hasClinical ? diag.examination : null,
    diagnosis: hasClinical ? diag.diagnosis : null,
    icd10: hasClinical ? diag.icd10 : null,
    plan: hasClinical ? diag.plan : null,
    recommendations: o.status === 'COMPLETED' ? diag.recommendations : null,
    status: o.status,
    globalDiscountType: global.type,
    globalDiscountValue: global.type === 'NONE' ? '0' : D(global.value).toFixed(2),
    totalGross: money(totalGross),
    discount: money(discount),
    totalNet: money(totals.total),
    paidAmount: money(totals.paid),
    completedAt: completedAt ? clampPast(completedAt) : null,
    createdAt: o.createdAt,
  };
  b.visits.push(visit);
  for (const l of lines) b.lines.push(l.data);
  return visit;
}

/** Bemorlar orasidan qabul sanasigacha roʻyxatga olinganlarini tanlash */
function pickPatient(ctx: Ctx, at: Date, exclude: Set<string> = new Set()): Patient {
  const eligible = ctx.patients.filter((p) => p.createdAt.getTime() <= at.getTime() && !exclude.has(p.id));
  return ctx.rng.pick(eligible.length > 0 ? eligible : ctx.patients);
}

/** Tarixiy qabullar: `count` ta, oxirgi `days` kun, ish kunlari ogʻirroq */
function makeHistory(ctx: Ctx, b: Bundle, count: number, days: number): void {
  const rng = ctx.rng;
  const dayKeys: string[] = [];
  for (let d = days; d >= 1; d--) dayKeys.push(keyPlusDays(TODAY, -d));
  const weights = dayKeys.map((k): readonly [string, number] => {
    const w = dow(k);
    return [k, w === 0 ? 0.6 : w === 6 ? 2 : 4];
  });
  const perDay = new Map<string, number>();
  for (let i = 0; i < count; i++) {
    const k = rng.weighted(weights);
    perDay.set(k, (perDay.get(k) ?? 0) + 1);
  }
  for (const key of dayKeys) {
    const n = perDay.get(key) ?? 0;
    if (n === 0) continue;
    const times = Array.from({ length: n }, () => rng.int(8 * 60 + 30, 19 * 60)).sort((a, c) => a - c);
    for (const t of times) {
      const createdAt = atMinutes(key, t);
      makeVisit(ctx, b, {
        patient: pickPatient(ctx, createdAt),
        createdAt,
        status: 'COMPLETED',
        withLines: true,
        payment: 'auto',
      });
    }
  }
}

/** Kassa smenalari: oxirgi `days` kun yopiq + bugun ochiq; toʻlovlar kun boʻyicha bogʻlanadi */
function makeShifts(ctx: Ctx, b: Bundle, days: number): void {
  const rng = ctx.rng;
  const shiftByDay = new Map<string, Prisma.CashShiftCreateManyInput>();
  for (let d = days; d >= 0; d--) {
    const key = keyPlusDays(TODAY, -d);
    const isToday = d === 0;
    const shift: Prisma.CashShiftCreateManyInput = {
      id: nextId(ctx, 'shift'),
      clinicId: ctx.clinic.id,
      cashierId: ctx.cashier.id,
      openedAt: isToday ? clampPast(atTz(key, '08:00'), 5) : atTz(key, '08:00'),
      closedAt: isToday ? null : atTz(key, '20:00'),
      openingCash: String(rng.pick([200000, 300000, 500000])),
      closingCash: null,
      totalCash: '0',
      totalCard: '0',
      totalTransfer: '0',
      totalClick: '0',
      totalPayme: '0',
      note: isToday ? null : 'Smena yopildi, kassa hisob-kitobi toʻgʻri',
    };
    shiftByDay.set(key, shift);
  }

  const sums = new Map<string, Record<PayMethod, Decimal>>();
  for (const p of b.payments) {
    const key = todayKey(p.createdAt);
    const shift = shiftByDay.get(key);
    if (!shift) continue;
    p.shiftId = shift.id ?? null;
    const s = sums.get(key) ?? { CASH: D(0), CARD: D(0), TRANSFER: D(0), CLICK: D(0), PAYME: D(0) };
    s[p.method] = s[p.method].plus(D(p.amount));
    sums.set(key, s);
  }
  for (const [key, shift] of shiftByDay) {
    const s = sums.get(key);
    if (shift.closedAt && s) {
      shift.totalCash = money(s.CASH);
      shift.totalCard = money(s.CARD);
      shift.totalTransfer = money(s.TRANSFER);
      shift.totalClick = money(s.CLICK);
      shift.totalPayme = money(s.PAYME);
      shift.closingCash = money(D(shift.openingCash ?? 0).plus(s.CASH));
    } else if (shift.closedAt) {
      shift.closingCash = shift.openingCash;
    }
    b.shifts.push(shift);
  }
}

/** Bugungi navbat, ochiq qabullar, shu haftadagi yozilishlar (faqat demo klinika) */
function makeToday(ctx: Ctx, b: Bundle): void {
  const rng = ctx.rng;
  const settings = parseClinicSettings(ctx.clinic.settings);
  const prefixes = settings.queue.prefixes;
  const date = dateKeyToDate(TODAY);
  const used = new Set<string>();
  const takePatient = (at: Date): Patient => {
    const p = pickPatient(ctx, at, used);
    used.add(p.id);
    return p;
  };
  const doctorA = must(ctx.doctors[0], 'doctor');
  const doctorB = ctx.doctors[1] ?? doctorA;
  const doctorC = ctx.doctors[2] ?? doctorA;
  const t = (hm: string, back = 1): Date => clampPast(atTz(TODAY, hm), back);
  /** Bugungi faoliyat uchun bemor — bugun ertalabgacha roʻyxatga olinganlardan */
  const morning = t('08:00', 30);

  // ── Shu haftadagi yozilishlar (Dush–Shan, 12 ta) ──
  const todayDow = dow(TODAY);
  const monday = keyPlusDays(TODAY, todayDow === 0 ? -6 : 1 - todayDow);
  const slotsByDoctor = new Map<string, string[]>([
    [doctorA.id, ['09:20', '11:00', '15:00', '16:40']],
    [doctorB.id, ['08:40', '10:20', '13:00', '14:40']],
    [doctorC.id, ['10:00', '11:40', '15:20', '17:00']],
  ]);
  const doctorsCycle = [doctorA, doctorB, doctorC];
  const appointmentPlan: Array<{ key: string; doctor: User; hm: string }> = [];
  let cycle = 0;
  for (let i = 0; i < 6; i++) {
    const key = keyPlusDays(monday, i);
    const isToday = key === TODAY;
    const n = isToday ? 3 : todayDow === 0 ? 2 : i === 5 ? 1 : 2;
    const usedSlots = new Set<string>();
    for (let j = 0; j < n; j++) {
      let doctor = must(doctorsCycle[cycle % doctorsCycle.length], 'doctor');
      cycle += 1;
      // Bolalar shifokori shanba kuni ishlamaydi (jadval) — boshqa shifokorga
      if (dow(key) === 6 && doctor.id === doctorC.id && doctorC.id !== doctorA.id) doctor = doctorB;
      const slots = must(slotsByDoctor.get(doctor.id), 'slots');
      const free = slots.filter((s) => !usedSlots.has(`${doctor.id}${s}`));
      if (free.length === 0) continue;
      // Bugun: 2 ta ertalabki (ARRIVED) + 1 ta kechki (CONFIRMED); boshqa kunlar — tasodifiy slot
      const wanted = isToday ? (j < 2 ? slots[j] : slots[slots.length - 1]) : undefined;
      const hm = wanted !== undefined && free.includes(wanted) ? wanted : rng.pick(free);
      usedSlots.add(`${doctor.id}${hm}`);
      appointmentPlan.push({ key, doctor, hm });
    }
  }
  // Umumiy soni aniq 12 boʻlsin
  while (appointmentPlan.length > 12) appointmentPlan.pop();
  while (appointmentPlan.length < 12) {
    const key = keyPlusDays(monday, rng.int(0, 5));
    const doctor = rng.pick(doctorsCycle);
    const hm = rng.pick(must(slotsByDoctor.get(doctor.id), 'slots'));
    if (!appointmentPlan.some((a) => a.key === key && a.doctor.id === doctor.id && a.hm === hm)) {
      appointmentPlan.push({ key, doctor, hm });
    }
  }

  const arrivedToday: Prisma.AppointmentCreateManyInput[] = [];
  const creator = ctx.reception ?? ctx.admin;
  const smsSettings = settings.sms;
  const renderSms = (tpl: string, patient: Patient, startAt: Date, doctor: User): string =>
    tpl
      .replace('{clinic}', ctx.clinic.name)
      .replace('{name}', patient.fullName.split(' ')[1] ?? patient.fullName)
      .replace('{date}', startAt.toLocaleDateString('ru-RU', { timeZone: 'Asia/Tashkent' }))
      .replace(
        '{time}',
        startAt.toLocaleTimeString('ru-RU', {
          timeZone: 'Asia/Tashkent',
          hour: '2-digit',
          minute: '2-digit',
        }),
      )
      .replace('{doctor}', doctor.fullName)
      .replace('{phone}', ctx.clinic.phone);

  let arrivedCount = 0;
  let smsFailedUsed = false;
  for (const a of appointmentPlan) {
    const startAt = atTz(a.key, a.hm);
    const endAt = addMinutes(startAt, ctx.clinic.slotMinutes);
    // Yozilish 1–5 kun oldin yaratilgan; kelajakdagi kun boʻlsa — bugun ertalab
    const plannedAt = addMinutes(startAt, -rng.int(1, 5) * 24 * 60);
    const createdAt = plannedAt.getTime() < morning.getTime() ? plannedAt : morning;
    const patient = takePatient(createdAt);
    let status: AppointmentStatus;
    if (a.key < TODAY) status = rng.chance(0.8) ? 'DONE' : 'NO_SHOW';
    else if (a.key === TODAY) status = arrivedCount < 2 ? 'ARRIVED' : 'CONFIRMED';
    else status = rng.chance(0.55) ? 'CONFIRMED' : 'SCHEDULED';
    if (status === 'ARRIVED') arrivedCount += 1;

    const confirmSentAt =
      status === 'CONFIRMED' || status === 'ARRIVED' || status === 'DONE' ? addMinutes(createdAt, 1) : null;
    const reminderSentAt =
      a.key <= keyPlusDays(TODAY, 1) && status !== 'SCHEDULED'
        ? clampPast(addMinutes(startAt, -24 * 60))
        : null;
    const row: Prisma.AppointmentCreateManyInput = {
      id: nextId(ctx, 'appointment'),
      clinicId: ctx.clinic.id,
      patientId: patient.id,
      doctorId: a.doctor.id,
      createdById: creator.id,
      startAt,
      endAt,
      status,
      note: rng.chance(0.3)
        ? rng.pick(['Qayta koʻrik', 'Nazorat koʻrigi', 'Birinchi murojaat', 'Kurs davomi'])
        : null,
      reminderSentAt,
      confirmSentAt,
      createdAt,
    };
    b.appointments.push(row);
    if (status === 'ARRIVED') arrivedToday.push(row);

    // SMS loglari (tasdiq / eslatma)
    if (confirmSentAt) {
      const failed = !smsFailedUsed && status === 'CONFIRMED' && a.key > TODAY;
      if (failed) smsFailedUsed = true;
      b.sms.push({
        clinicId: ctx.clinic.id,
        patientId: patient.id,
        phone: patient.phone,
        text: renderSms(smsSettings.confirmTemplate, patient, startAt, a.doctor),
        kind: 'APPOINTMENT_CONFIRM',
        status: failed ? 'FAILED' : 'SENT',
        provider: 'eskiz',
        providerId: failed ? null : `esk-${String(rng.int(100000, 999999))}`,
        error: failed ? 'Eskiz: balans yetarli emas' : null,
        sentAt: failed ? null : confirmSentAt,
        createdAt: confirmSentAt,
      });
    }
    if (reminderSentAt) {
      b.sms.push({
        clinicId: ctx.clinic.id,
        patientId: patient.id,
        phone: patient.phone,
        text: renderSms(smsSettings.reminderTemplate, patient, startAt, a.doctor),
        kind: 'APPOINTMENT_REMINDER',
        status: 'SENT',
        provider: 'eskiz',
        providerId: `esk-${String(rng.int(100000, 999999))}`,
        error: null,
        sentAt: reminderSentAt,
        createdAt: reminderSentAt,
      });
    }
  }

  // ── Bugungi navbat (8 ta talon) ──
  const q = (
    seqByPrefix: Map<string, number>,
    type: QueueType,
    status: QueueStatus,
    hm: string,
    patient: Patient | null,
    doctor: User | null,
  ): Prisma.QueueCreateManyInput => {
    const prefix = prefixes[type];
    const seq = (seqByPrefix.get(prefix) ?? 0) + 1;
    seqByPrefix.set(prefix, seq);
    const createdAt = t(hm, 3);
    const calledAt = status === 'WAITING' ? null : clampPast(addMinutes(createdAt, rng.int(10, 25)), 2);
    const servedAt =
      status === 'SERVING' || status === 'DONE' ? clampPast(addMinutes(calledAt ?? createdAt, 2), 1) : null;
    const doneAt = status === 'DONE' ? clampPast(addMinutes(servedAt ?? createdAt, rng.int(10, 20))) : null;
    return {
      id: nextId(ctx, 'queue'),
      clinicId: ctx.clinic.id,
      date,
      number: formatQueueNumber(prefix, seq),
      prefix,
      seq,
      type,
      patientId: patient?.id ?? null,
      doctorId: doctor?.id ?? null,
      room: doctor?.room ?? null,
      status,
      calledAt,
      servedAt,
      doneAt,
      printedAt: createdAt,
      createdAt,
    };
  };
  const seqByPrefix = new Map<string, number>();
  const pA1 = takePatient(morning);
  const pA2 = takePatient(morning);
  const pA3 = takePatient(morning);
  const pA4 = takePatient(morning);
  const pA5 = takePatient(morning);
  const pB1 = takePatient(morning);
  const pC1 = takePatient(morning);
  const pWalk1 = takePatient(morning);
  const pWalk2 = takePatient(morning);

  const qA1 = q(seqByPrefix, 'DOCTOR', 'DONE', '08:05', pA1, doctorB);
  const qA2 = q(seqByPrefix, 'DOCTOR', 'DONE', '08:20', pA2, doctorA);
  const qA3 = q(seqByPrefix, 'DOCTOR', 'SERVING', '09:10', pA3, doctorA);
  const qA4 = q(seqByPrefix, 'DOCTOR', 'CALLED', '09:35', pA4, doctorC);
  const qA5 = q(seqByPrefix, 'DOCTOR', 'WAITING', '09:50', pA5, null);
  const qB1 = q(seqByPrefix, 'RECHECK', 'WAITING', '10:05', pB1, doctorB);
  const qC1 = q(seqByPrefix, 'LAB', 'DONE', '08:40', pC1, null);
  const qD1 = q(seqByPrefix, 'CASHIER', 'WAITING', '10:15', pWalk2, null);
  b.queues.push(qA1, qA2, qA3, qA4, qA5, qB1, qC1, qD1);

  // ── Bugungi qabullar: 2 ta yakunlangan + 6 ta ochiq ──
  const appt1 = arrivedToday[0];
  const appt2 = arrivedToday[1];
  const patientOf = (a: Prisma.AppointmentCreateManyInput | undefined, fallback: Patient): Patient =>
    a
      ? must(
          ctx.patients.find((p) => p.id === a.patientId),
          'yozilgan bemor',
        )
      : fallback;
  const doctorOf = (a: Prisma.AppointmentCreateManyInput | undefined, fallback: User): User =>
    a
      ? must(
          ctx.doctors.find((d) => d.id === a.doctorId),
          'yozilgan shifokor',
        )
      : fallback;

  makeVisit(ctx, b, {
    patient: pA1,
    createdAt: t('08:25', 4),
    status: 'COMPLETED',
    withLines: true,
    payment: 'full',
    doctor: doctorB,
    queueId: qA1.id,
  });
  makeVisit(ctx, b, {
    patient: pA2,
    createdAt: t('08:45', 4),
    status: 'COMPLETED',
    withLines: true,
    payment: 'full',
    doctor: doctorA,
    queueId: qA2.id,
  });
  makeVisit(ctx, b, {
    patient: pA3,
    createdAt: t('09:30', 3),
    status: 'OPEN',
    withLines: true,
    payment: 'none',
    doctor: doctorA,
    queueId: qA3.id,
  });
  makeVisit(ctx, b, {
    patient: pA4,
    createdAt: t('09:55', 3),
    status: 'OPEN',
    withLines: false,
    payment: 'none',
    doctor: doctorC,
    queueId: qA4.id,
  });
  makeVisit(ctx, b, {
    patient: patientOf(appt1, takePatient(morning)),
    createdAt: t('10:05', 3),
    status: 'OPEN',
    withLines: true,
    payment: 'partial',
    doctor: doctorOf(appt1, doctorA),
    appointmentId: appt1?.id ?? null,
  });
  makeVisit(ctx, b, {
    patient: patientOf(appt2, takePatient(morning)),
    createdAt: t('10:25', 3),
    status: 'OPEN',
    withLines: false,
    payment: 'none',
    doctor: doctorOf(appt2, doctorB),
    appointmentId: appt2?.id ?? null,
  });
  makeVisit(ctx, b, {
    patient: pWalk1,
    createdAt: t('10:40', 3),
    status: 'OPEN',
    withLines: true,
    payment: 'full',
    doctor: doctorC,
  });
  makeVisit(ctx, b, {
    patient: pWalk2,
    createdAt: t('10:50', 3),
    status: 'OPEN',
    withLines: true,
    payment: 'none',
    doctor: doctorB,
    maxLines: 2,
  });

  // ── Qoʻshimcha SMS namunalari ──
  const bdayPatient = takePatient(NOW);
  const bdayAt = clampPast(atTz(TODAY, '09:00'), 10);
  b.sms.push(
    {
      clinicId: ctx.clinic.id,
      patientId: bdayPatient.id,
      phone: bdayPatient.phone,
      text: smsSettings.birthdayTemplate
        .replace('{clinic}', ctx.clinic.name)
        .replace('{name}', bdayPatient.fullName),
      kind: 'BIRTHDAY',
      status: 'SENT',
      provider: 'eskiz',
      providerId: `esk-${String(rng.int(100000, 999999))}`,
      error: null,
      sentAt: bdayAt,
      createdAt: bdayAt,
    },
    {
      clinicId: ctx.clinic.id,
      patientId: pB1.id,
      phone: pB1.phone,
      text: `${ctx.clinic.name}: analiz natijalaringiz tayyor. Qabulxonadan olib ketishingiz mumkin. Tel: ${ctx.clinic.phone}`,
      kind: 'CUSTOM',
      status: 'PENDING',
      provider: 'eskiz',
      providerId: null,
      error: null,
      sentAt: null,
      createdAt: clampPast(atTz(TODAY, '10:30'), 1),
    },
  );
}

/** Audit yozuvlari: narx oʻzgarishlari, toʻlovlar, smenalar, kirishlar */
function makeAudit(ctx: Ctx, b: Bundle): void {
  const rng = ctx.rng;
  const ua =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';
  const ip = '192.168.1.24';

  // Narx oʻzgarishlari (admin)
  const priceChanges: Array<[string, number]> = [
    ['N-001', -25],
    ['T-001', -20],
    ['D-001', -9],
    ['F-002', -3],
    ['E-001', -14],
  ];
  for (const [code, daysAgo] of priceChanges) {
    const s = ctx.serviceByCode.get(code) ?? ctx.services[0];
    if (!s) continue;
    const delta = rng.pick([10000, 20000, 30000]);
    const after = {
      priceAdultNoMed: dec(s.priceAdultNoMed).toNumber(),
      priceAdultMed: dec(s.priceAdultMed).toNumber(),
      priceChildNoMed: dec(s.priceChildNoMed).toNumber(),
      priceChildMed: dec(s.priceChildMed).toNumber(),
    };
    const before = {
      priceAdultNoMed: after.priceAdultNoMed - delta,
      priceAdultMed: after.priceAdultMed - delta,
      priceChildNoMed: Math.max(1000, after.priceChildNoMed - delta),
      priceChildMed: Math.max(1000, after.priceChildMed - delta),
    };
    b.audits.push({
      clinicId: ctx.clinic.id,
      userId: ctx.admin.id,
      action: 'PRICE_CHANGE',
      entity: 'Service',
      entityId: s.id,
      before: toJson({ code: s.code, ...before }),
      after: toJson({ code: s.code, ...after }),
      ip,
      userAgent: ua,
      createdAt: atMinutes(keyPlusDays(TODAY, daysAgo), rng.int(9 * 60, 18 * 60)),
    });
  }

  // Sozlamalar oʻzgartirilgan
  b.audits.push({
    clinicId: ctx.clinic.id,
    userId: ctx.admin.id,
    action: 'SETTINGS',
    entity: 'Clinic',
    entityId: ctx.clinic.id,
    before: toJson({ printer: { transport: 'BROWSER', paperWidth: 80 } }),
    after: toJson({ printer: { transport: 'BROWSER', paperWidth: 58 } }),
    ip,
    userAgent: ua,
    createdAt: atTz(keyPlusDays(TODAY, -30), '11:45'),
  });

  // Smenalar
  for (const s of b.shifts) {
    const openedAt = asDate(s.openedAt ?? NOW);
    b.audits.push({
      clinicId: ctx.clinic.id,
      userId: ctx.cashier.id,
      action: 'SHIFT_OPEN',
      entity: 'CashShift',
      entityId: s.id,
      after: toJson({ openingCash: Number(s.openingCash) }),
      ip,
      userAgent: ua,
      createdAt: openedAt,
    });
    if (s.closedAt) {
      const closedAt = asDate(s.closedAt);
      b.audits.push({
        clinicId: ctx.clinic.id,
        userId: ctx.cashier.id,
        action: 'SHIFT_CLOSE',
        entity: 'CashShift',
        entityId: s.id,
        after: toJson({
          totalCash: Number(s.totalCash),
          totalCard: Number(s.totalCard),
          totalClick: Number(s.totalClick),
          totalPayme: Number(s.totalPayme),
          totalTransfer: Number(s.totalTransfer),
          closingCash: Number(s.closingCash),
        }),
        ip,
        userAgent: ua,
        createdAt: closedAt,
      });
    }
  }

  // Oxirgi 2 kundagi toʻlovlar
  const since = keyPlusDays(TODAY, -1);
  for (const p of b.payments) {
    if (todayKey(p.createdAt) < since) continue;
    b.audits.push({
      clinicId: ctx.clinic.id,
      userId: p.cashierId,
      action: 'PAYMENT',
      entity: 'Payment',
      entityId: p.id,
      after: toJson({
        visitId: p.visitId,
        amount: Number(p.amount),
        method: p.method,
        receiptNo: p.receiptNo,
      }),
      ip,
      userAgent: ua,
      createdAt: p.createdAt,
    });
  }

  // Bugun yakunlangan qabullar
  for (const v of b.visits) {
    if (v.status !== 'COMPLETED' || !v.completedAt || todayKey(asDate(v.completedAt)) !== TODAY) continue;
    b.audits.push({
      clinicId: ctx.clinic.id,
      userId: v.doctorId,
      action: 'VISIT_COMPLETE',
      entity: 'Visit',
      entityId: v.id,
      after: toJson({ totalNet: Number(v.totalNet), paidAmount: Number(v.paidAmount), icd10: v.icd10 }),
      ip,
      userAgent: ua,
      createdAt: v.completedAt,
    });
  }

  // Bugungi kirishlar
  const logins: Array<[User, string]> = [
    [ctx.admin, '07:50'],
    [ctx.cashier, '07:55'],
    ...ctx.doctors.map((d, i): [User, string] => [d, `08:${String(5 + i * 7).padStart(2, '0')}`]),
  ];
  if (ctx.reception) logins.push([ctx.reception, '07:52']);
  for (const [u, hm] of logins) {
    b.audits.push({
      clinicId: ctx.clinic.id,
      userId: u.id,
      action: 'LOGIN',
      entity: 'User',
      entityId: u.id,
      after: toJson({ login: u.login, role: u.role }),
      ip,
      userAgent: ua,
      createdAt: clampPast(atTz(TODAY, hm), 15),
    });
  }
}

async function wipeTransactional(clinicId: string): Promise<void> {
  await prisma.payment.deleteMany({ where: { clinicId } });
  await prisma.visit.deleteMany({ where: { clinicId } }); // TreatmentLine — cascade
  await prisma.queue.deleteMany({ where: { clinicId } });
  await prisma.appointment.deleteMany({ where: { clinicId } });
  await prisma.cashShift.deleteMany({ where: { clinicId } });
  await prisma.auditLog.deleteMany({ where: { clinicId } });
  await prisma.smsLog.deleteMany({ where: { clinicId } });
}

async function insertBundle(b: Bundle): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      if (b.shifts.length) await tx.cashShift.createMany({ data: b.shifts });
      if (b.queues.length) await tx.queue.createMany({ data: b.queues });
      if (b.appointments.length) await tx.appointment.createMany({ data: b.appointments });
      if (b.visits.length) await tx.visit.createMany({ data: b.visits });
      if (b.lines.length) await tx.treatmentLine.createMany({ data: b.lines });
      if (b.payments.length) await tx.payment.createMany({ data: b.payments });
      if (b.audits.length) await tx.auditLog.createMany({ data: b.audits });
      if (b.sms.length) await tx.smsLog.createMany({ data: b.sms });
    },
    { maxWait: 20_000, timeout: 120_000 },
  );
}

function buildCtx(
  clinic: Clinic,
  users: Map<string, User>,
  services: Service[],
  patients: Patient[],
  idPrefix: string,
): Ctx {
  const clinicUsers = [...users.values()].filter((u) => u.clinicId === clinic.id);
  const doctors = clinicUsers.filter((u) => u.role === 'DOCTOR');
  const admin = must(
    clinicUsers.find((u) => u.role === 'ADMIN'),
    `admin (${clinic.slug})`,
  );
  const cashier = clinicUsers.find((u) => u.role === 'CASHIER') ?? admin;
  const reception = clinicUsers.find((u) => u.role === 'RECEPTION') ?? null;
  if (doctors.length === 0) throw new Error(`Seed: ${clinic.slug} klinikasida shifokor yoʻq`);
  return {
    clinic,
    rng: new Rng(seedFromString(`lor-crm-seed-v1:${clinic.slug}:${TODAY}`)),
    doctors,
    cashier,
    admin,
    reception,
    services,
    serviceByCode: new Map(services.map((s) => [s.code, s])),
    patients,
    receiptSeq: new Map(),
    idPrefix,
    counters: { visit: 0, line: 0, payment: 0, queue: 0, appointment: 0, shift: 0 },
  };
}

interface Summary {
  clinic: string;
  users: number;
  categories: number;
  services: number;
  patients: number;
  visits: number;
  openVisits: number;
  lines: number;
  payments: number;
  debtVisits: number;
  queues: number;
  appointments: number;
  shifts: number;
  audits: number;
  sms: number;
}

function summarize(
  b: Bundle,
  clinic: string,
  users: number,
  categories: number,
  services: number,
  patients: number,
): Summary {
  return {
    clinic,
    users,
    categories,
    services,
    patients,
    visits: b.visits.length,
    openVisits: b.visits.filter((v) => v.status === 'OPEN').length,
    lines: b.lines.length,
    payments: b.payments.length,
    debtVisits: b.visits.filter(
      (v) => v.status === 'COMPLETED' && D(String(v.paidAmount)).lt(D(String(v.totalNet))),
    ).length,
    queues: b.queues.length,
    appointments: b.appointments.length,
    shifts: b.shifts.length,
    audits: b.audits.length,
    sms: b.sms.length,
  };
}

// ───────────────────────────── Asosiy oqim ─────────────────────────────

async function main(): Promise<void> {
  const started = Date.now();
  console.info(`Seed boshlandi — bugun (Asia/Tashkent): ${TODAY}`);

  // 1) Klinikalar
  const clinicBySlug = new Map<string, Clinic>();
  for (const c of CLINICS) clinicBySlug.set(c.slug, await upsertClinic(c));
  const demo = must(clinicBySlug.get(DEMO_CLINIC.slug), 'demo klinika');
  const plus = must(clinicBySlug.get(LOR_PLUS_CLINIC.slug), 'lor-plus klinika');

  // 2) Xodimlar
  const users = await upsertUsers(clinicBySlug);

  // 3) Kategoriyalar va xizmatlar
  const demoCategories = await upsertCategories(demo, CATEGORIES);
  const demoServices = await upsertServices(demo, SERVICES, demoCategories);
  const plusCategories = await upsertCategories(plus, LOR_PLUS_CATEGORIES);
  const plusServices = await upsertServices(plus, LOR_PLUS_SERVICES, plusCategories);

  // 4) Bemorlar
  const patientRng = new Rng(seedFromString(`lor-crm-patients:${TODAY}`));
  const demoPatients = await upsertPatients(demo, PATIENTS, patientRng, 364, 0);
  const plusPatients = await upsertPatients(plus, LOR_PLUS_PATIENTS, patientRng, 150, 40);

  // 5) Tranzaksion maʼlumotlarni tozalash
  await wipeTransactional(demo.id);
  await wipeTransactional(plus.id);

  // 6) Demo klinika: 260 ta tarixiy qabul (90 kun), bugungi navbat/qabullar, smenalar, audit, SMS
  const demoCtx = buildCtx(demo, users, demoServices, demoPatients, 'demo');
  const demoBundle = emptyBundle();
  makeHistory(demoCtx, demoBundle, 260, 90);
  makeToday(demoCtx, demoBundle);
  makeShifts(demoCtx, demoBundle, 7);
  makeAudit(demoCtx, demoBundle);
  await insertBundle(demoBundle);

  // 7) LOR Plus: 18 ta qabul (30 kun) + smenalar — izolyatsiya testi uchun
  const plusCtx = buildCtx(plus, users, plusServices, plusPatients, 'plus');
  const plusBundle = emptyBundle();
  makeHistory(plusCtx, plusBundle, 18, 30);
  makeShifts(plusCtx, plusBundle, 3);
  await insertBundle(plusBundle);

  // 8) Xulosa
  const countUsers = (clinicId: string): number =>
    [...users.values()].filter((u) => u.clinicId === clinicId).length;
  const rows = [
    summarize(
      demoBundle,
      demo.slug,
      countUsers(demo.id),
      demoCategories.size,
      demoServices.length,
      demoPatients.length,
    ),
    summarize(
      plusBundle,
      plus.slug,
      countUsers(plus.id),
      plusCategories.size,
      plusServices.length,
      plusPatients.length,
    ),
  ];
  console.table(rows);
  console.info(`Seed yakunlandi: ${((Date.now() - started) / 1000).toFixed(1)} s`);
}

main()
  .catch((e: unknown) => {
    console.error('Seed xatosi:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
