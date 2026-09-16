import { Prisma, type PatientType, type PayMethod, type SalaryType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { CLINIC_TZ, dayRangeTz } from '@/lib/date';
import { D, moneyToJson } from '@/lib/money';
import { deltaPercent, sharePercent } from './format';
import { buildPeriods, previousRange } from './period';
import {
  PAY_METHODS,
  type DebtorRowDTO,
  type DebtorsReportDTO,
  type DoctorRowDTO,
  type DoctorsReportDTO,
  type FullReportDTO,
  type GroupBy,
  type MedStatDTO,
  type MedicineReportDTO,
  type MedicineRowDTO,
  type MethodAmountDTO,
  type PatientTypesReportDTO,
  type PatientTypesTrendDTO,
  type ReportFilters,
  type RevenuePeriodDTO,
  type RevenueReportDTO,
  type ServiceRowDTO,
  type ServicesReportDTO,
  type ShiftRowDTO,
  type ShiftsReportDTO,
  type SummaryCoreDTO,
  type SummaryDTO,
  type TypeStatDTO,
} from './types';

/**
 * Hisobot agregatsiyalari. Har bir soʻrov `clinicId` va [from,to] (Asia/Tashkent kun chegaralari) boʻyicha.
 * Sana bucketlari — raw SQL (parametrlangan tagged template), qolganlari Prisma aggregate/groupBy.
 * `"createdAt"` — timestamp(3) without tz (UTC) → `AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tashkent'`.
 * Pul — Decimal → butun number (`moneyToJson`).
 */

export interface QueryWindow {
  clinicId: string;
  from: string;
  to: string;
  start: Date;
  end: Date;
  doctorId: string | null;
}

export function toWindow(clinicId: string, filters: ReportFilters): QueryWindow {
  return {
    clinicId,
    from: filters.from,
    to: filters.to,
    start: dayRangeTz(filters.from).start,
    end: dayRangeTz(filters.to).end,
    doctorId: filters.doctorId ?? null,
  };
}

/** Raw SQL / aggregate natijalaridan number (Decimal, bigint, string, number) */
export function rawNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'string') return Number(v) || 0;
  if (typeof v === 'object' && 'toString' in v) return Number(String(v)) || 0;
  return 0;
}

/** Pul: Decimal-ga oʻxshash qiymat → butun soʻm */
export function money(v: unknown): number {
  if (v === null || v === undefined) return 0;
  try {
    return moneyToJson(D(typeof v === 'object' ? String(v) : (v as string | number)));
  } catch {
    return 0;
  }
}

/** Miqdor (0.5 qadam) → number, 1 kasr */
function qty(v: unknown): number {
  return Math.round(rawNumber(v) * 10) / 10;
}

function avg(total: number, count: number): number {
  return count > 0 ? Math.round(total / count) : 0;
}

function isPayMethod(v: unknown): v is PayMethod {
  return typeof v === 'string' && (PAY_METHODS as readonly string[]).includes(v);
}

function emptyMethodTotals(): Record<PayMethod, number> {
  return { CASH: 0, CARD: 0, TRANSFER: 0, CLICK: 0, PAYME: 0 };
}

function methodList(totals: Record<PayMethod, number>): MethodAmountDTO[] {
  const sum = PAY_METHODS.reduce((s, m) => s + totals[m], 0);
  return PAY_METHODS.map((m) => ({ method: m, amount: totals[m], share: sharePercent(totals[m], sum) }));
}

/** Sana bucket ifodasi — period.ts `periodKey` bilan bir xil kalitlar */
function bucketExpr(column: Prisma.Sql, groupBy: GroupBy): Prisma.Sql {
  const local = Prisma.sql`((${column} AT TIME ZONE 'UTC') AT TIME ZONE ${CLINIC_TZ})`;
  switch (groupBy) {
    case 'day':
      return Prisma.sql`to_char(${local}, 'YYYY-MM-DD')`;
    case 'week':
      return Prisma.sql`to_char(date_trunc('week', ${local}), 'YYYY-MM-DD')`;
    case 'month':
      return Prisma.sql`to_char(${local}, 'YYYY-MM')`;
  }
}

/**
 * Raw SQL uchun vaqt chegarasi. Prisma `Date` parametrni `timestamptz` sifatida uzatadi,
 * ustunlar esa `timestamp without time zone` (UTC). DB sessiyasi vaqt zonasi UTC boʻlmasa
 * (masalan `Asia/Tashkent`) taqqoslash sessiya zonasi boʻyicha surilib ketadi, shuning uchun
 * parametrni aniq `AT TIME ZONE 'UTC'` bilan ustun bilan bir xil "naive UTC" koʻrinishiga keltiramiz.
 * Ustunning oʻzi oʻzgarmaydi — (clinicId, createdAt) indekslari ishlayveradi.
 */
function utcTs(d: Date): Prisma.Sql {
  return Prisma.sql`(${d} AT TIME ZONE 'UTC')`;
}

const VISIT_CREATED = Prisma.raw('v."createdAt"');
const PAYMENT_CREATED = Prisma.raw('p."createdAt"');

/** Qabul filtri (alias `v`): klinika, davr, bekor qilinmagan, shifokor */
function visitWhere(w: QueryWindow): Prisma.Sql {
  const doctor = w.doctorId ? Prisma.sql`AND v."doctorId" = ${w.doctorId}` : Prisma.empty;
  return Prisma.sql`v."clinicId" = ${w.clinicId} AND v."createdAt" >= ${utcTs(w.start)} AND v."createdAt" <= ${utcTs(w.end)} AND v.status <> 'CANCELLED' ${doctor}`;
}

/** Toʻlov filtri (alias `p`, qabul `v` bilan JOIN qilingan) */
function paymentWhere(w: QueryWindow): Prisma.Sql {
  const doctor = w.doctorId ? Prisma.sql`AND v."doctorId" = ${w.doctorId}` : Prisma.empty;
  return Prisma.sql`p."clinicId" = ${w.clinicId} AND p."createdAt" >= ${utcTs(w.start)} AND p."createdAt" <= ${utcTs(w.end)} ${doctor}`;
}

function doctorVisitFilter(w: QueryWindow): Prisma.VisitWhereInput {
  return w.doctorId ? { doctorId: w.doctorId } : {};
}

// ───────────────────────────── SUMMARY ─────────────────────────────

interface DistinctRow {
  patients: unknown;
  debt: unknown;
}

async function summaryCore(w: QueryWindow): Promise<SummaryCoreDTO> {
  const [pay, vis, distinct, newPatients] = await Promise.all([
    prisma.payment.aggregate({
      where: { clinicId: w.clinicId, createdAt: { gte: w.start, lte: w.end }, ...(w.doctorId ? { visit: { doctorId: w.doctorId } } : {}) },
      _sum: { amount: true },
    }),
    prisma.visit.aggregate({
      where: { clinicId: w.clinicId, createdAt: { gte: w.start, lte: w.end }, status: { not: 'CANCELLED' }, ...doctorVisitFilter(w) },
      _count: { _all: true },
      _sum: { totalNet: true, discount: true },
    }),
    prisma.$queryRaw<DistinctRow[]>`
      SELECT COUNT(DISTINCT v."patientId")::int AS patients,
             COALESCE(SUM(CASE WHEN v.status = 'COMPLETED' AND v."totalNet" > v."paidAmount" THEN v."totalNet" - v."paidAmount" ELSE 0 END), 0) AS debt
      FROM "Visit" v
      WHERE ${visitWhere(w)}
    `,
    prisma.patient.count({
      where: {
        clinicId: w.clinicId,
        createdAt: { gte: w.start, lte: w.end },
        ...(w.doctorId ? { visits: { some: { doctorId: w.doctorId, createdAt: { gte: w.start, lte: w.end }, status: { not: 'CANCELLED' } } } } : {}),
      },
    }),
  ]);
  const revenue = money(pay._sum.amount);
  const visits = vis._count._all;
  const row = distinct[0];
  return {
    revenue,
    visits,
    patients: rawNumber(row?.patients),
    newPatients,
    avgCheck: avg(revenue, visits),
    debt: money(row?.debt),
    discount: money(vis._sum.discount),
    servicesTotal: money(vis._sum.totalNet),
  };
}

async function byMethod(w: QueryWindow): Promise<MethodAmountDTO[]> {
  const groups = await prisma.payment.groupBy({
    by: ['method'],
    where: { clinicId: w.clinicId, createdAt: { gte: w.start, lte: w.end }, ...(w.doctorId ? { visit: { doctorId: w.doctorId } } : {}) },
    _sum: { amount: true },
  });
  const totals = emptyMethodTotals();
  for (const g of groups) totals[g.method] = money(g._sum.amount);
  return methodList(totals);
}

export async function summary(clinicId: string, filters: ReportFilters): Promise<SummaryDTO> {
  const w = toWindow(clinicId, filters);
  const prev = previousRange({ from: filters.from, to: filters.to });
  const pw = toWindow(clinicId, { ...prev, doctorId: filters.doctorId });
  const [current, previous, methods] = await Promise.all([summaryCore(w), summaryCore(pw), byMethod(w)]);
  return {
    ...current,
    range: { from: filters.from, to: filters.to },
    previousRange: prev,
    previous,
    deltas: {
      revenue: deltaPercent(current.revenue, previous.revenue),
      visits: deltaPercent(current.visits, previous.visits),
      patients: deltaPercent(current.patients, previous.patients),
      avgCheck: deltaPercent(current.avgCheck, previous.avgCheck),
      debt: deltaPercent(current.debt, previous.debt),
    },
    byMethod: methods,
  };
}

// ───────────────────────────── REVENUE ─────────────────────────────

interface PayBucketRow {
  period: string;
  method: string;
  amount: unknown;
}
interface VisitBucketRow {
  period: string;
  visits: unknown;
}

export async function revenue(clinicId: string, filters: ReportFilters, groupBy: GroupBy): Promise<RevenueReportDTO> {
  const w = toWindow(clinicId, filters);
  const [pays, vis] = await Promise.all([
    prisma.$queryRaw<PayBucketRow[]>`
      SELECT ${bucketExpr(PAYMENT_CREATED, groupBy)} AS period, p.method::text AS method, SUM(p.amount) AS amount
      FROM "Payment" p
      JOIN "Visit" v ON v.id = p."visitId"
      WHERE ${paymentWhere(w)}
      GROUP BY 1, 2
    `,
    prisma.$queryRaw<VisitBucketRow[]>`
      SELECT ${bucketExpr(VISIT_CREATED, groupBy)} AS period, COUNT(*)::int AS visits
      FROM "Visit" v
      WHERE ${visitWhere(w)}
      GROUP BY 1
    `,
  ]);

  const payMap = new Map<string, Record<PayMethod, number>>();
  for (const r of pays) {
    if (!isPayMethod(r.method)) continue;
    const bucket = payMap.get(r.period) ?? emptyMethodTotals();
    bucket[r.method] += money(r.amount);
    payMap.set(r.period, bucket);
  }
  const visitMap = new Map<string, number>();
  for (const r of vis) visitMap.set(r.period, rawNumber(r.visits));

  const grand = emptyMethodTotals();
  let visitsTotal = 0;
  const periods: RevenuePeriodDTO[] = buildPeriods(filters.from, filters.to, groupBy).map((p) => {
    const totals = payMap.get(p.period) ?? emptyMethodTotals();
    const rev = PAY_METHODS.reduce((s, m) => s + totals[m], 0);
    const visits = visitMap.get(p.period) ?? 0;
    for (const m of PAY_METHODS) grand[m] += totals[m];
    visitsTotal += visits;
    return { ...p, revenue: rev, visits, avgCheck: avg(rev, visits), byMethod: methodList(totals) };
  });
  const revenueTotal = PAY_METHODS.reduce((s, m) => s + grand[m], 0);
  return {
    groupBy,
    range: { from: filters.from, to: filters.to },
    periods,
    totals: { revenue: revenueTotal, visits: visitsTotal, avgCheck: avg(revenueTotal, visitsTotal), byMethod: methodList(grand) },
  };
}

// ───────────────────────────── DOCTORS ─────────────────────────────

interface DoctorRow {
  doctorId: string;
  fullName: string;
  specialty: string | null;
  color: string;
  isActive: boolean;
  salaryType: SalaryType;
  salaryValue: unknown;
  visits: unknown;
  patients: unknown;
  servicesTotal: unknown;
  revenue: unknown;
}

function computeSalary(type: SalaryType, value: number, revenueAmount: number): number {
  if (type === 'FIXED') return value;
  return moneyToJson(D(revenueAmount).mul(D(value)).div(100));
}

export async function doctors(clinicId: string, filters: ReportFilters): Promise<DoctorsReportDTO> {
  const w = toWindow(clinicId, filters);
  const onlyDoctor = w.doctorId ? Prisma.sql`AND u.id = ${w.doctorId}` : Prisma.empty;
  const rows = await prisma.$queryRaw<DoctorRow[]>`
    WITH vis AS (
      SELECT v."doctorId", COUNT(*)::int AS visits, COUNT(DISTINCT v."patientId")::int AS patients, SUM(v."totalNet") AS services_total
      FROM "Visit" v
      WHERE v."clinicId" = ${w.clinicId} AND v."createdAt" >= ${utcTs(w.start)} AND v."createdAt" <= ${utcTs(w.end)} AND v.status <> 'CANCELLED'
      GROUP BY 1
    ),
    pay AS (
      SELECT v."doctorId", SUM(p.amount) AS revenue
      FROM "Payment" p
      JOIN "Visit" v ON v.id = p."visitId"
      WHERE p."clinicId" = ${w.clinicId} AND p."createdAt" >= ${utcTs(w.start)} AND p."createdAt" <= ${utcTs(w.end)}
      GROUP BY 1
    )
    SELECT u.id AS "doctorId", u."fullName", u.specialty, u.color, u."isActive", u."salaryType"::text AS "salaryType", u."salaryValue",
           COALESCE(vis.visits, 0) AS visits, COALESCE(vis.patients, 0) AS patients,
           COALESCE(vis.services_total, 0) AS "servicesTotal", COALESCE(pay.revenue, 0) AS revenue
    FROM "User" u
    LEFT JOIN vis ON vis."doctorId" = u.id
    LEFT JOIN pay ON pay."doctorId" = u.id
    WHERE u."clinicId" = ${w.clinicId}
      AND ((u.role = 'DOCTOR' AND u."isActive") OR vis."doctorId" IS NOT NULL OR pay."doctorId" IS NOT NULL)
      ${onlyDoctor}
    ORDER BY revenue DESC, u."fullName" ASC
  `;

  const revenueTotal = rows.reduce((s, r) => s + money(r.revenue), 0);
  const list: DoctorRowDTO[] = rows.map((r) => {
    const rev = money(r.revenue);
    const visits = rawNumber(r.visits);
    const salaryValue = money(r.salaryValue);
    const salaryType: SalaryType = r.salaryType === 'FIXED' ? 'FIXED' : 'PERCENT';
    return {
      doctorId: r.doctorId,
      fullName: r.fullName,
      specialty: r.specialty,
      color: r.color,
      isActive: r.isActive,
      patients: rawNumber(r.patients),
      visits,
      revenue: rev,
      servicesTotal: money(r.servicesTotal),
      avgCheck: avg(rev, visits),
      share: sharePercent(rev, revenueTotal),
      salaryType,
      salaryValue,
      salary: computeSalary(salaryType, salaryValue, rev),
    };
  });
  const totals = list.reduce(
    (acc, r) => {
      acc.patients += r.patients;
      acc.visits += r.visits;
      acc.revenue += r.revenue;
      acc.servicesTotal += r.servicesTotal;
      acc.salary += r.salary;
      return acc;
    },
    { patients: 0, visits: 0, revenue: 0, servicesTotal: 0, avgCheck: 0, salary: 0 },
  );
  totals.avgCheck = avg(totals.revenue, totals.visits);
  return { range: { from: filters.from, to: filters.to }, rows: list, totals };
}

// ───────────────────────────── SERVICES ─────────────────────────────

interface ServiceRow {
  serviceId: string;
  code: string;
  name: string;
  nameRu: string;
  unit: string;
  categoryName: string | null;
  categoryNameRu: string | null;
  lines: unknown;
  count: unknown;
  revenue: unknown;
  gross: unknown;
  discount: unknown;
  adultCount: unknown;
  childCount: unknown;
  medCount: unknown;
}

export async function services(clinicId: string, filters: ReportFilters): Promise<ServicesReportDTO> {
  const w = toWindow(clinicId, filters);
  const rows = await prisma.$queryRaw<ServiceRow[]>`
    SELECT l."serviceId", l."serviceCode" AS code, l."serviceName" AS name, l."serviceNameRu" AS "nameRu", MAX(l.unit) AS unit,
           c.name AS "categoryName", c."nameRu" AS "categoryNameRu",
           COUNT(*)::int AS lines, SUM(l.quantity) AS count, SUM(l."lineTotal") AS revenue,
           SUM(l."grossTotal") AS gross, SUM(l."discountTotal") AS discount,
           SUM(CASE WHEN l."patientType" = 'ADULT' THEN l.quantity ELSE 0 END) AS "adultCount",
           SUM(CASE WHEN l."patientType" = 'CHILD' THEN l.quantity ELSE 0 END) AS "childCount",
           SUM(CASE WHEN l."withMedicine" THEN l.quantity ELSE 0 END) AS "medCount"
    FROM "TreatmentLine" l
    JOIN "Visit" v ON v.id = l."visitId"
    LEFT JOIN "Service" s ON s.id = l."serviceId"
    LEFT JOIN "ServiceCategory" c ON c.id = s."categoryId"
    WHERE ${visitWhere(w)}
    GROUP BY l."serviceId", l."serviceCode", l."serviceName", l."serviceNameRu", c.name, c."nameRu"
    ORDER BY revenue DESC, count DESC, name ASC
  `;
  const revenueTotal = rows.reduce((s, r) => s + money(r.revenue), 0);
  const list: ServiceRowDTO[] = rows.map((r) => {
    const count = qty(r.count);
    const medCount = qty(r.medCount);
    return {
      serviceId: r.serviceId,
      code: r.code,
      name: r.name,
      nameRu: r.nameRu,
      unit: r.unit,
      category: r.categoryName ? { name: r.categoryName, nameRu: r.categoryNameRu ?? r.categoryName } : null,
      count,
      lines: rawNumber(r.lines),
      revenue: money(r.revenue),
      gross: money(r.gross),
      discount: money(r.discount),
      share: sharePercent(money(r.revenue), revenueTotal),
      adultCount: qty(r.adultCount),
      childCount: qty(r.childCount),
      medCount,
      noMedCount: Math.round((count - medCount) * 10) / 10,
    };
  });
  const totals = list.reduce(
    (acc, r) => {
      acc.count += r.count;
      acc.lines += r.lines;
      acc.revenue += r.revenue;
      acc.gross += r.gross;
      acc.discount += r.discount;
      acc.adultCount += r.adultCount;
      acc.childCount += r.childCount;
      acc.medCount += r.medCount;
      return acc;
    },
    { count: 0, lines: 0, revenue: 0, gross: 0, discount: 0, adultCount: 0, childCount: 0, medCount: 0 },
  );
  for (const k of ['count', 'adultCount', 'childCount', 'medCount'] as const) totals[k] = Math.round(totals[k] * 10) / 10;
  return { range: { from: filters.from, to: filters.to }, rows: list, totals };
}

// ───────────────────────────── PATIENT TYPES ─────────────────────────────

interface TypeRow {
  type: string;
  lines: unknown;
  visits: unknown;
  revenue: unknown;
}
interface TypeTrendRow extends TypeRow {
  period: string;
}

function emptyType(): TypeStatDTO {
  return { visits: 0, lines: 0, revenue: 0 };
}

function isPatientType(v: unknown): v is PatientType {
  return v === 'ADULT' || v === 'CHILD';
}

export async function patientTypes(clinicId: string, filters: ReportFilters, groupBy: GroupBy = 'month'): Promise<PatientTypesReportDTO> {
  const w = toWindow(clinicId, filters);
  const [totals, trend] = await Promise.all([
    prisma.$queryRaw<TypeRow[]>`
      SELECT l."patientType"::text AS type, COUNT(*)::int AS lines, COUNT(DISTINCT l."visitId")::int AS visits, SUM(l."lineTotal") AS revenue
      FROM "TreatmentLine" l
      JOIN "Visit" v ON v.id = l."visitId"
      WHERE ${visitWhere(w)}
      GROUP BY 1
    `,
    prisma.$queryRaw<TypeTrendRow[]>`
      SELECT ${bucketExpr(VISIT_CREATED, groupBy)} AS period, l."patientType"::text AS type,
             COUNT(*)::int AS lines, COUNT(DISTINCT l."visitId")::int AS visits, SUM(l."lineTotal") AS revenue
      FROM "TreatmentLine" l
      JOIN "Visit" v ON v.id = l."visitId"
      WHERE ${visitWhere(w)}
      GROUP BY 1, 2
    `,
  ]);
  const stat: Record<PatientType, TypeStatDTO> = { ADULT: emptyType(), CHILD: emptyType() };
  for (const r of totals) {
    if (!isPatientType(r.type)) continue;
    stat[r.type] = { visits: rawNumber(r.visits), lines: rawNumber(r.lines), revenue: money(r.revenue) };
  }
  const trendMap = new Map<string, Record<PatientType, TypeStatDTO>>();
  for (const r of trend) {
    if (!isPatientType(r.type)) continue;
    const bucket = trendMap.get(r.period) ?? { ADULT: emptyType(), CHILD: emptyType() };
    bucket[r.type] = { visits: rawNumber(r.visits), lines: rawNumber(r.lines), revenue: money(r.revenue) };
    trendMap.set(r.period, bucket);
  }
  const trendList: PatientTypesTrendDTO[] = buildPeriods(filters.from, filters.to, groupBy).map((p) => {
    const b = trendMap.get(p.period);
    return { ...p, adult: b?.ADULT ?? emptyType(), child: b?.CHILD ?? emptyType() };
  });
  const total: TypeStatDTO = {
    visits: stat.ADULT.visits + stat.CHILD.visits,
    lines: stat.ADULT.lines + stat.CHILD.lines,
    revenue: stat.ADULT.revenue + stat.CHILD.revenue,
  };
  return {
    groupBy,
    range: { from: filters.from, to: filters.to },
    adult: { ...stat.ADULT, share: sharePercent(stat.ADULT.revenue, total.revenue) },
    child: { ...stat.CHILD, share: sharePercent(stat.CHILD.revenue, total.revenue) },
    total,
    trend: trendList,
  };
}

// ───────────────────────────── MEDICINE ─────────────────────────────

interface MedRow {
  serviceId: string;
  code: string;
  name: string;
  nameRu: string;
  unit: string;
  medicineOptional: boolean | null;
  withMedicine: boolean;
  lines: unknown;
  count: unknown;
  revenue: unknown;
}

function emptyMed(): MedStatDTO {
  return { lines: 0, count: 0, revenue: 0 };
}

function addMed(a: MedStatDTO, b: MedStatDTO): MedStatDTO {
  return { lines: a.lines + b.lines, count: Math.round((a.count + b.count) * 10) / 10, revenue: a.revenue + b.revenue };
}

export async function medicine(clinicId: string, filters: ReportFilters): Promise<MedicineReportDTO> {
  const w = toWindow(clinicId, filters);
  const rows = await prisma.$queryRaw<MedRow[]>`
    SELECT l."serviceId", l."serviceCode" AS code, l."serviceName" AS name, l."serviceNameRu" AS "nameRu", MAX(l.unit) AS unit,
           BOOL_OR(s."medicineOptional") AS "medicineOptional", l."withMedicine" AS "withMedicine",
           COUNT(*)::int AS lines, SUM(l.quantity) AS count, SUM(l."lineTotal") AS revenue
    FROM "TreatmentLine" l
    JOIN "Visit" v ON v.id = l."visitId"
    LEFT JOIN "Service" s ON s.id = l."serviceId"
    WHERE ${visitWhere(w)}
    GROUP BY l."serviceId", l."serviceCode", l."serviceName", l."serviceNameRu", l."withMedicine"
  `;
  const map = new Map<string, MedicineRowDTO>();
  for (const r of rows) {
    const key = `${r.serviceId}|${r.code}|${r.name}`;
    const row =
      map.get(key) ??
      ({
        serviceId: r.serviceId,
        code: r.code,
        name: r.name,
        nameRu: r.nameRu,
        unit: r.unit,
        medicineOptional: r.medicineOptional ?? true,
        med: emptyMed(),
        noMed: emptyMed(),
        total: emptyMed(),
        medShare: 0,
      } satisfies MedicineRowDTO);
    const stat: MedStatDTO = { lines: rawNumber(r.lines), count: qty(r.count), revenue: money(r.revenue) };
    if (r.withMedicine) row.med = addMed(row.med, stat);
    else row.noMed = addMed(row.noMed, stat);
    map.set(key, row);
  }
  const list = [...map.values()].map((row) => {
    const total = addMed(row.med, row.noMed);
    return { ...row, total, medShare: sharePercent(row.med.count, total.count) };
  });
  list.sort((a, b) => b.total.count - a.total.count || b.total.revenue - a.total.revenue || a.name.localeCompare(b.name));
  const totals = list.reduce(
    (acc, r) => ({ med: addMed(acc.med, r.med), noMed: addMed(acc.noMed, r.noMed), total: addMed(acc.total, r.total), medShare: 0 }),
    { med: emptyMed(), noMed: emptyMed(), total: emptyMed(), medShare: 0 },
  );
  totals.medShare = sharePercent(totals.med.count, totals.total.count);
  return { range: { from: filters.from, to: filters.to }, rows: list, totals };
}

// ───────────────────────────── SHIFTS ─────────────────────────────

export async function shifts(clinicId: string, filters: ReportFilters): Promise<ShiftsReportDTO> {
  const w = toWindow(clinicId, filters);
  const list = await prisma.cashShift.findMany({
    where: { clinicId, openedAt: { gte: w.start, lte: w.end } },
    include: { cashier: { select: { id: true, fullName: true } }, _count: { select: { payments: true } } },
    orderBy: { openedAt: 'desc' },
  });
  const openIds = list.filter((s) => !s.closedAt).map((s) => s.id);
  const live = new Map<string, Record<PayMethod, number>>();
  if (openIds.length > 0) {
    const groups = await prisma.payment.groupBy({
      by: ['shiftId', 'method'],
      where: { clinicId, shiftId: { in: openIds } },
      _sum: { amount: true },
    });
    for (const g of groups) {
      if (!g.shiftId) continue;
      const bucket = live.get(g.shiftId) ?? emptyMethodTotals();
      bucket[g.method] += money(g._sum.amount);
      live.set(g.shiftId, bucket);
    }
  }
  const rows: ShiftRowDTO[] = list.map((s) => {
    const closed = !!s.closedAt;
    const totals: Record<PayMethod, number> = closed
      ? {
          CASH: money(s.totalCash),
          CARD: money(s.totalCard),
          TRANSFER: money(s.totalTransfer),
          CLICK: money(s.totalClick),
          PAYME: money(s.totalPayme),
        }
      : live.get(s.id) ?? emptyMethodTotals();
    const total = PAY_METHODS.reduce((sum, m) => sum + totals[m], 0);
    const openingCash = money(s.openingCash);
    const closingCash = s.closingCash === null ? null : money(s.closingCash);
    const expectedCash = openingCash + totals.CASH;
    return {
      id: s.id,
      cashier: s.cashier,
      status: closed ? 'CLOSED' : 'OPEN',
      openedAt: s.openedAt.toISOString(),
      closedAt: s.closedAt ? s.closedAt.toISOString() : null,
      openingCash,
      closingCash,
      totals,
      total,
      expectedCash,
      difference: closed && closingCash !== null ? closingCash - expectedCash : null,
      paymentsCount: s._count.payments,
      note: s.note,
    };
  });
  const totals = rows.reduce(
    (acc, r) => {
      for (const m of PAY_METHODS) acc.totals[m] += r.totals[m];
      acc.total += r.total;
      acc.difference += r.difference ?? 0;
      acc.count += 1;
      if (r.status === 'OPEN') acc.open += 1;
      return acc;
    },
    { totals: emptyMethodTotals(), total: 0, difference: 0, count: 0, open: 0 },
  );
  return { range: { from: filters.from, to: filters.to }, rows, totals };
}

// ───────────────────────────── DEBTORS ─────────────────────────────

interface DebtorRow {
  patientId: string;
  visits: unknown;
  debt: unknown;
  lastVisit: Date;
  lastVisitId: string;
}

export async function debtors(clinicId: string, filters: ReportFilters, allTime = false): Promise<DebtorsReportDTO> {
  const w = toWindow(clinicId, filters);
  const range = allTime ? Prisma.empty : Prisma.sql`AND v."createdAt" >= ${utcTs(w.start)} AND v."createdAt" <= ${utcTs(w.end)}`;
  const doctor = w.doctorId ? Prisma.sql`AND v."doctorId" = ${w.doctorId}` : Prisma.empty;
  const rows = await prisma.$queryRaw<DebtorRow[]>`
    SELECT v."patientId", COUNT(*)::int AS visits, SUM(v."totalNet" - v."paidAmount") AS debt,
           MAX(v."createdAt") AS "lastVisit",
           (ARRAY_AGG(v.id ORDER BY v."createdAt" DESC))[1] AS "lastVisitId"
    FROM "Visit" v
    WHERE v."clinicId" = ${clinicId} AND v.status = 'COMPLETED' AND v."totalNet" > v."paidAmount" ${range} ${doctor}
    GROUP BY 1
    ORDER BY debt DESC, "lastVisit" DESC
  `;
  const ids = rows.map((r) => r.patientId);
  const [patients, sms] =
    ids.length === 0
      ? [[], []]
      : await Promise.all([
          prisma.patient.findMany({
            where: { clinicId, id: { in: ids } },
            select: { id: true, fullName: true, cardNumber: true, phone: true, smsConsent: true },
          }),
          prisma.smsLog.groupBy({
            by: ['patientId'],
            where: { clinicId, patientId: { in: ids }, kind: 'CUSTOM', status: { in: ['PENDING', 'SENT'] } },
            _max: { createdAt: true },
          }),
        ]);
  const patientMap = new Map(patients.map((p) => [p.id, p]));
  const smsMap = new Map<string, Date>();
  for (const s of sms) if (s.patientId && s._max.createdAt) smsMap.set(s.patientId, s._max.createdAt);

  const list: DebtorRowDTO[] = [];
  for (const r of rows) {
    const p = patientMap.get(r.patientId);
    if (!p) continue;
    list.push({
      patient: p,
      visits: rawNumber(r.visits),
      totalDebt: money(r.debt),
      lastVisit: new Date(r.lastVisit).toISOString(),
      lastVisitId: r.lastVisitId,
      lastSmsAt: smsMap.get(r.patientId)?.toISOString() ?? null,
    });
  }
  return {
    range: { from: filters.from, to: filters.to },
    allTime,
    rows: list,
    total: list.reduce((s, r) => s + r.totalDebt, 0),
    count: list.length,
  };
}

/** Bemorning joriy qarzi (yakunlangan qabullar boʻyicha) — SMS eslatma uchun */
export async function patientDebt(clinicId: string, patientId: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ debt: unknown }[]>`
    SELECT COALESCE(SUM(v."totalNet" - v."paidAmount"), 0) AS debt
    FROM "Visit" v
    WHERE v."clinicId" = ${clinicId} AND v."patientId" = ${patientId} AND v.status = 'COMPLETED' AND v."totalNet" > v."paidAmount"
  `;
  return money(rows[0]?.debt);
}

// ───────────────────────────── FULL ─────────────────────────────

export async function full(clinicId: string, filters: ReportFilters, groupBy: GroupBy, allTimeDebtors = false): Promise<FullReportDTO> {
  const [s, r, d, sv, pt, m, sh, db] = await Promise.all([
    summary(clinicId, filters),
    revenue(clinicId, filters, groupBy),
    doctors(clinicId, filters),
    services(clinicId, filters),
    patientTypes(clinicId, filters, groupBy),
    medicine(clinicId, filters),
    shifts(clinicId, filters),
    debtors(clinicId, filters, allTimeDebtors),
  ]);
  return { summary: s, revenue: r, doctors: d, services: sv, patientTypes: pt, medicine: m, shifts: sh, debtors: db };
}
