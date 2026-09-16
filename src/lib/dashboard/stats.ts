import { Prisma, type PayMethod } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { D, moneyToJson } from '@/lib/money';
import { CLINIC_TZ, dateKeyToDate, dayRangeTz, todayKey, todayRange, yesterdayRange } from '@/lib/date';
import type {
  ByMethodDTO,
  DashboardStatsDTO,
  DebtDTO,
  DoctorStatDTO,
  SeriesPointDTO,
  StatsRange,
  TodayAppointmentDTO,
  TodayStatsDTO,
  TodaySummaryDTO,
  TopServiceDTO,
} from './types';

/**
 * Bosh sahifa statistikasi — barcha soʻrovlar `clinicId` boʻyicha, pul Decimal → butun number.
 * Kunlik seriya uchun bitta raw SQL: `createdAt` (timestamp, UTC) → Asia/Tashkent kuni.
 */

export interface StatsOptions {
  range: StatsRange;
  /** Shifokor filtri (DOCTOR roli uchun majburan oʻzi) */
  doctorId?: string | null;
  now?: Date;
}

const PAY_METHODS: readonly PayMethod[] = ['CASH', 'CARD', 'TRANSFER', 'CLICK', 'PAYME'] as const;

/** Raw SQL / aggregate natijalaridan butun number (Decimal, bigint, string, number) */
export function rawNumber(v: unknown): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  if (typeof v === 'bigint') return Number(v);
  if (typeof v === 'string') return Number(v) || 0;
  if (typeof v === 'object' && v !== null && 'toString' in v) return Number(String(v)) || 0;
  return 0;
}

/** Pul: Decimal-ga oʻxshash qiymat → butun soʻm */
function money(v: unknown): number {
  if (v === null || v === undefined) return 0;
  try {
    return moneyToJson(D(typeof v === 'object' ? String(v) : (v as string | number)));
  } catch {
    return 0;
  }
}

export function deltaPercent(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
}

/** `range` kunlik kalitlar roʻyxati (bugun bilan tugaydi), Asia/Tashkent */
export function rangeDateKeys(range: number, now: Date = new Date()): string[] {
  const keys: string[] = [];
  for (let i = range - 1; i >= 0; i--) {
    keys.push(todayKey(new Date(now.getTime() - i * 86_400_000)));
  }
  return keys;
}

/** Davr boshlanishi (UTC Date) va oxiri (hozir) */
export function rangeBounds(range: number, now: Date = new Date()): { start: Date; end: Date; keys: string[] } {
  const keys = rangeDateKeys(range, now);
  const first = keys[0] ?? todayKey(now);
  return { start: dayRangeTz(first).start, end: dayRangeTz(keys[keys.length - 1] ?? first).end, keys };
}

interface SeriesRow {
  day: string;
  revenue: unknown;
  visits: unknown;
}

/**
 * Kunlik tushum (toʻlovlar) va qabullar soni — bitta raw SQL (ikki CTE, FULL JOIN).
 * `"createdAt"` timestamp(3) without tz (UTC) → `AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Tashkent'`.
 */
/**
 * Raw SQL uchun vaqt chegarasi: Prisma `Date` ni `timestamptz` qilib uzatadi, ustun esa
 * `timestamp without time zone` (UTC). DB sessiyasi zonasi UTC boʻlmasa (`Asia/Tashkent`)
 * taqqoslash surilib ketadi, shuning uchun parametrni `AT TIME ZONE 'UTC'` bilan ustun
 * bilan bir xil "naive UTC" koʻrinishiga keltiramiz (indeks ishlashda qoladi).
 */
function utcTs(d: Date): Prisma.Sql {
  return Prisma.sql`(${d} AT TIME ZONE 'UTC')`;
}

async function dailySeries(clinicId: string, start: Date, end: Date, doctorId: string | null): Promise<SeriesRow[]> {
  const doctorPay = doctorId ? Prisma.sql`AND v."doctorId" = ${doctorId}` : Prisma.empty;
  const doctorVisit = doctorId ? Prisma.sql`AND "doctorId" = ${doctorId}` : Prisma.empty;
  const tz = CLINIC_TZ;
  return prisma.$queryRaw<SeriesRow[]>`
    WITH pay AS (
      SELECT to_char((p."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS day,
             SUM(p.amount) AS revenue
      FROM "Payment" p
      JOIN "Visit" v ON v.id = p."visitId"
      WHERE p."clinicId" = ${clinicId}
        AND p."createdAt" >= ${utcTs(start)} AND p."createdAt" <= ${utcTs(end)}
        ${doctorPay}
      GROUP BY 1
    ),
    vis AS (
      SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}, 'YYYY-MM-DD') AS day,
             COUNT(*)::int AS visits
      FROM "Visit"
      WHERE "clinicId" = ${clinicId}
        AND "createdAt" >= ${utcTs(start)} AND "createdAt" <= ${utcTs(end)}
        AND status <> 'CANCELLED'
        ${doctorVisit}
      GROUP BY 1
    )
    SELECT COALESCE(pay.day, vis.day) AS day,
           COALESCE(pay.revenue, 0) AS revenue,
           COALESCE(vis.visits, 0) AS visits
    FROM pay FULL OUTER JOIN vis ON vis.day = pay.day
    ORDER BY 1
  `;
}

async function sumPayments(clinicId: string, start: Date, end: Date, doctorId: string | null): Promise<number> {
  const agg = await prisma.payment.aggregate({
    where: {
      clinicId,
      createdAt: { gte: start, lte: end },
      ...(doctorId ? { visit: { doctorId } } : {}),
    },
    _sum: { amount: true },
  });
  return money(agg._sum.amount);
}

async function countVisits(clinicId: string, start: Date, end: Date, doctorId: string | null): Promise<{ count: number; totalNet: number }> {
  const agg = await prisma.visit.aggregate({
    where: {
      clinicId,
      createdAt: { gte: start, lte: end },
      status: { not: 'CANCELLED' },
      ...(doctorId ? { doctorId } : {}),
    },
    _count: { _all: true },
    _sum: { totalNet: true },
  });
  return { count: agg._count._all, totalNet: money(agg._sum.totalNet) };
}

/** Bugun navbatda kutayotganlar (WAITING) */
export async function getQueueWaiting(clinicId: string, now: Date = new Date()): Promise<number> {
  return prisma.queue.count({
    where: { clinicId, date: dateKeyToDate(todayKey(now)), status: 'WAITING' },
  });
}

export async function getTodayStats(clinicId: string, doctorId: string | null, now: Date = new Date()): Promise<TodayStatsDTO> {
  const today = todayRange(now);
  const yesterday = yesterdayRange(now);
  const [revenue, revenueYesterday, visitsToday, visitsYesterday, waiting] = await Promise.all([
    sumPayments(clinicId, today.start, today.end, doctorId),
    sumPayments(clinicId, yesterday.start, yesterday.end, doctorId),
    countVisits(clinicId, today.start, today.end, doctorId),
    countVisits(clinicId, yesterday.start, yesterday.end, doctorId),
    getQueueWaiting(clinicId, now),
  ]);
  const avgCheck = visitsToday.count > 0 ? moneyToJson(D(visitsToday.totalNet).div(visitsToday.count)) : 0;
  return {
    revenue,
    revenueYesterday,
    deltaPct: deltaPercent(revenue, revenueYesterday),
    visits: visitsToday.count,
    visitsYesterday: visitsYesterday.count,
    visitsDeltaPct: deltaPercent(visitsToday.count, visitsYesterday.count),
    avgCheck,
    waiting,
  };
}

async function byMethod(clinicId: string, start: Date, end: Date, doctorId: string | null): Promise<ByMethodDTO[]> {
  const rows = await prisma.payment.groupBy({
    by: ['method'],
    where: {
      clinicId,
      createdAt: { gte: start, lte: end },
      ...(doctorId ? { visit: { doctorId } } : {}),
    },
    _sum: { amount: true },
  });
  const map = new Map<PayMethod, number>(rows.map((r) => [r.method, money(r._sum.amount)] as const));
  return PAY_METHODS.map((method) => ({ method, amount: map.get(method) ?? 0 })).filter((r) => r.amount !== 0);
}

async function topServices(clinicId: string, start: Date, end: Date, doctorId: string | null): Promise<TopServiceDTO[]> {
  const rows = await prisma.treatmentLine.groupBy({
    by: ['serviceId'],
    where: {
      visit: {
        clinicId,
        createdAt: { gte: start, lte: end },
        status: { not: 'CANCELLED' },
        ...(doctorId ? { doctorId } : {}),
      },
    },
    _sum: { lineTotal: true },
    _count: { _all: true },
    orderBy: { _sum: { lineTotal: 'desc' } },
    take: 10,
  });
  if (rows.length === 0) return [];
  const services = await prisma.service.findMany({
    where: { clinicId, id: { in: rows.map((r) => r.serviceId) } },
    select: { id: true, name: true, nameRu: true },
  });
  const byId = new Map(services.map((s) => [s.id, s] as const));
  return rows.map((r) => {
    const s = byId.get(r.serviceId);
    return {
      serviceId: r.serviceId,
      serviceName: s?.name ?? '—',
      serviceNameRu: s?.nameRu ?? s?.name ?? '—',
      count: r._count._all,
      revenue: money(r._sum.lineTotal),
    };
  });
}

async function doctorStats(clinicId: string, start: Date, end: Date, doctorId: string | null): Promise<DoctorStatDTO[]> {
  const rows = await prisma.visit.groupBy({
    by: ['doctorId'],
    where: {
      clinicId,
      createdAt: { gte: start, lte: end },
      status: { not: 'CANCELLED' },
      ...(doctorId ? { doctorId } : {}),
    },
    _count: { _all: true },
    _sum: { totalNet: true },
  });
  const ids = rows.map((r) => r.doctorId);
  const users = ids.length
    ? await prisma.user.findMany({ where: { clinicId, id: { in: ids } }, select: { id: true, fullName: true, color: true } })
    : [];
  const byId = new Map(users.map((u) => [u.id, u] as const));
  return rows
    .map((r) => {
      const u = byId.get(r.doctorId);
      const revenue = money(r._sum.totalNet);
      const patients = r._count._all;
      return {
        id: r.doctorId,
        fullName: u?.fullName ?? '—',
        color: u?.color ?? '#8A99B8',
        patients,
        revenue,
        avgCheck: patients > 0 ? moneyToJson(D(revenue).div(patients)) : 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

interface DebtRow {
  visitId: string;
  patientId: string;
  patientName: string;
  cardNumber: string;
  createdAt: Date;
  balance: unknown;
}

/** Yakunlangan, toʻliq toʻlanmagan qabullar (qoldiq boʻyicha kamayish tartibida) + jami qarz */
async function debts(clinicId: string, doctorId: string | null, limit = 20): Promise<{ items: DebtDTO[]; total: number }> {
  const doctorCond = doctorId ? Prisma.sql`AND v."doctorId" = ${doctorId}` : Prisma.empty;
  const [rows, totals] = await Promise.all([
    prisma.$queryRaw<DebtRow[]>`
      SELECT v.id AS "visitId", v."patientId", p."fullName" AS "patientName", p."cardNumber",
             v."createdAt", (v."totalNet" - v."paidAmount") AS balance
      FROM "Visit" v
      JOIN "Patient" p ON p.id = v."patientId"
      WHERE v."clinicId" = ${clinicId}
        AND v.status = 'COMPLETED'
        AND v."totalNet" > v."paidAmount"
        ${doctorCond}
      ORDER BY balance DESC, v."createdAt" DESC
      LIMIT ${limit}
    `,
    prisma.$queryRaw<Array<{ total: unknown }>>`
      SELECT COALESCE(SUM(v."totalNet" - v."paidAmount"), 0) AS total
      FROM "Visit" v
      WHERE v."clinicId" = ${clinicId}
        AND v.status = 'COMPLETED'
        AND v."totalNet" > v."paidAmount"
        ${doctorCond}
    `,
  ]);
  return {
    items: rows.map((r) => ({
      visitId: r.visitId,
      patientId: r.patientId,
      patientName: r.patientName,
      cardNumber: r.cardNumber,
      date: new Date(r.createdAt).toISOString(),
      balance: money(r.balance),
    })),
    total: money(totals[0]?.total),
  };
}

export async function getDashboardStats(clinicId: string, opts: StatsOptions): Promise<DashboardStatsDTO> {
  const now = opts.now ?? new Date();
  const doctorId = opts.doctorId ?? null;
  const { start, end, keys } = rangeBounds(opts.range, now);

  const [today, seriesRows, methods, top, doctors, debtData] = await Promise.all([
    getTodayStats(clinicId, doctorId, now),
    dailySeries(clinicId, start, end, doctorId),
    byMethod(clinicId, start, end, doctorId),
    topServices(clinicId, start, end, doctorId),
    doctorStats(clinicId, start, end, doctorId),
    debts(clinicId, doctorId),
  ]);

  const byDay = new Map<string, { revenue: number; visits: number }>(
    seriesRows.map((r) => [r.day, { revenue: money(r.revenue), visits: rawNumber(r.visits) }] as const),
  );
  const series: SeriesPointDTO[] = keys.map((date) => ({ date, revenue: byDay.get(date)?.revenue ?? 0, visits: byDay.get(date)?.visits ?? 0 }));

  return {
    range: opts.range,
    doctorId,
    today,
    series,
    byMethod: methods,
    topServices: top,
    doctors,
    debts: debtData.items,
    debtTotal: debtData.total,
    generatedAt: now.toISOString(),
  };
}

/** Topbar "Bugun" popoveri va bosh sahifadagi yozilishlar roʻyxati */
export async function getTodaySummary(clinicId: string, doctorId: string | null, now: Date = new Date(), limit = 8): Promise<TodaySummaryDTO> {
  const today = todayRange(now);
  const [revenue, visits, waiting, appointments] = await Promise.all([
    sumPayments(clinicId, today.start, today.end, doctorId),
    countVisits(clinicId, today.start, today.end, doctorId),
    getQueueWaiting(clinicId, now),
    prisma.appointment.findMany({
      where: {
        clinicId,
        startAt: { gte: today.start, lte: today.end },
        status: { in: ['SCHEDULED', 'CONFIRMED', 'ARRIVED'] },
        ...(doctorId ? { doctorId } : {}),
      },
      orderBy: { startAt: 'asc' },
      take: limit,
      select: {
        id: true,
        startAt: true,
        endAt: true,
        status: true,
        patient: { select: { id: true, fullName: true } },
        doctor: { select: { id: true, fullName: true, color: true } },
      },
    }),
  ]);
  const items: TodayAppointmentDTO[] = appointments.map((a) => ({
    id: a.id,
    startAt: a.startAt.toISOString(),
    endAt: a.endAt.toISOString(),
    patientId: a.patient.id,
    patientName: a.patient.fullName,
    doctorId: a.doctor.id,
    doctorName: a.doctor.fullName,
    doctorColor: a.doctor.color,
    status: a.status,
  }));
  return { revenue, visits: visits.count, waiting, appointments: items, generatedAt: now.toISOString() };
}
