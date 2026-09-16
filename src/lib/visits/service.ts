import { Prisma, type Role } from '@prisma/client';
import { prisma, type Tx } from '@/lib/prisma';
import { ApiError } from '@/lib/api/errors';
import { audit } from '@/lib/api/audit';
import { serialize } from '@/lib/api/respond';
import { dayRangeTz } from '@/lib/date';
import { computeLineSnapshot, recalcVisit } from './recalc';
import type { Serialized, VisitListItemDTO } from './types';
import type { TreatmentServiceDTO, VisitDetailDTO } from './dto';
import type {
  AddLineInput,
  CreateVisitInput,
  GlobalDiscountInput,
  ListVisitsQuery,
  UpdateLineInput,
  UpdateVisitInput,
} from './schemas';

/**
 * Qabul (Visit) biznes-mantigʻi. Barcha soʻrovlar `clinicId` boʻyicha chegaralangan,
 * pul faqat `computeLineSnapshot` / `recalcVisit` orqali hisoblanadi (float YOʻQ).
 *
 * Qoidalar:
 *  - qatorlar/chegirma faqat OPEN qabulda oʻzgaradi (aks holda 409 VISIT_CLOSED)
 *  - narx snapshoti qatorda saqlanadi — xizmat narxi keyin oʻzgarsa tarix buzilmaydi
 *  - har bir pul oʻzgarishi audit qilinadi
 */

export interface VisitActor {
  id: string;
  role: Role;
}

export interface VisitCtx {
  clinicId: string;
  actor: VisitActor;
  ip?: string | null;
  userAgent?: string | null;
}

export const visitInclude = {
  patient: {
    select: {
      id: true,
      cardNumber: true,
      fullName: true,
      birthDate: true,
      gender: true,
      phone: true,
      allergies: true,
      chronic: true,
    },
  },
  doctor: { select: { id: true, fullName: true, specialty: true, room: true, color: true } },
  lines: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] },
  payments: { include: { cashier: { select: { id: true, fullName: true } } }, orderBy: { createdAt: 'asc' } },
  queue: { select: { id: true, number: true, prefix: true, seq: true, status: true, date: true } },
  appointment: { select: { id: true, startAt: true, endAt: true, status: true } },
  clinic: { select: { id: true, childAgeLimit: true, roundTo: true, name: true } },
} satisfies Prisma.VisitInclude;

export type VisitDetail = Prisma.VisitGetPayload<{ include: typeof visitInclude }>;

const serviceSelect = {
  id: true,
  categoryId: true,
  code: true,
  name: true,
  nameRu: true,
  unit: true,
  priceAdultNoMed: true,
  priceAdultMed: true,
  priceChildNoMed: true,
  priceChildMed: true,
  allowHalf: true,
  medicineOptional: true,
  durationMin: true,
  defaultOrgan: true,
  isActive: true,
  order: true,
  category: { select: { id: true, name: true, nameRu: true, icon: true, order: true } },
} satisfies Prisma.ServiceSelect;

export type TreatmentService = Prisma.ServiceGetPayload<{ select: typeof serviceSelect }>;

/** Prisma → API JSON (Decimal → number, Date → ISO) */
export function toVisitDetailDTO(visit: VisitDetail): VisitDetailDTO {
  const dto: Serialized<VisitDetail> = serialize(visit) as unknown as Serialized<VisitDetail>;
  return dto;
}

export function toTreatmentServiceDTOs(services: TreatmentService[]): TreatmentServiceDTO[] {
  const dto: Serialized<TreatmentService>[] = serialize(
    services,
  ) as unknown as Serialized<TreatmentService>[];
  return dto;
}

// ───────────────────────────── Yordamchilar ─────────────────────────────

const VISIT_CLOSED = () => new ApiError(409, 'VISIT_CLOSED', 'Qabul yopilgan — oʻzgartirib boʻlmaydi');

async function loadVisitDetail(tx: Tx, clinicId: string, visitId: string): Promise<VisitDetail> {
  const visit = await tx.visit.findFirst({ where: { id: visitId, clinicId }, include: visitInclude });
  if (!visit) throw ApiError.notFound('Qabul topilmadi');
  return visit;
}

async function loadOpenVisit(tx: Tx, clinicId: string, visitId: string) {
  const visit = await tx.visit.findFirst({
    where: { id: visitId, clinicId },
    select: {
      id: true,
      status: true,
      paidAmount: true,
      queueId: true,
      appointmentId: true,
      globalDiscountType: true,
      globalDiscountValue: true,
    },
  });
  if (!visit) throw ApiError.notFound('Qabul topilmadi');
  if (visit.status !== 'OPEN') throw VISIT_CLOSED();
  return visit;
}

async function loadService(tx: Tx, clinicId: string, serviceId: string, requireActive: boolean) {
  const service = await tx.service.findFirst({ where: { id: serviceId, clinicId } });
  if (!service) throw ApiError.notFound('Xizmat topilmadi');
  if (requireActive && !service.isActive)
    throw new ApiError(409, 'CONFLICT', 'Xizmat faol emas', { reason: 'SERVICE_INACTIVE' });
  return service;
}

function lineAuditView(line: {
  serviceCode: string;
  patientType: string;
  withMedicine: boolean;
  quantity: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
  grossTotal: Prisma.Decimal;
  discountType: string;
  discountValue: Prisma.Decimal;
  discountTotal: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  side: string | null;
  organ: string | null;
}) {
  return {
    serviceCode: line.serviceCode,
    patientType: line.patientType,
    withMedicine: line.withMedicine,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    grossTotal: line.grossTotal,
    discountType: line.discountType,
    discountValue: line.discountValue,
    discountTotal: line.discountTotal,
    lineTotal: line.lineTotal,
    side: line.side,
    organ: line.organ,
  };
}

function auditBase(ctx: VisitCtx) {
  return {
    clinicId: ctx.clinicId,
    userId: ctx.actor.id,
    ip: ctx.ip ?? null,
    userAgent: ctx.userAgent ?? null,
  };
}

// ───────────────────────────── Oʻqish ─────────────────────────────

export async function getVisit(clinicId: string, visitId: string): Promise<VisitDetail | null> {
  return prisma.visit.findFirst({ where: { id: visitId, clinicId }, include: visitInclude });
}

export interface VisitListResult {
  items: VisitListItemDTO[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listVisits(clinicId: string, q: ListVisitsQuery): Promise<VisitListResult> {
  const where: Prisma.VisitWhereInput = { clinicId };
  if (q.from || q.to) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (q.from) createdAt.gte = dayRangeTz(q.from).start;
    if (q.to) createdAt.lte = dayRangeTz(q.to).end;
    where.createdAt = createdAt;
  }
  if (q.doctorId) where.doctorId = q.doctorId;
  if (q.patientId) where.patientId = q.patientId;
  if (q.status) where.status = q.status;

  const [total, rows] = await Promise.all([
    prisma.visit.count({ where }),
    prisma.visit.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
      include: {
        patient: { select: { id: true, cardNumber: true, fullName: true, phone: true } },
        doctor: { select: { id: true, fullName: true, color: true } },
        _count: { select: { lines: true } },
      },
    }),
  ]);

  const items = rows.map(({ _count, ...row }) => {
    const dto: VisitListItemDTO = serialize({
      ...row,
      linesCount: _count.lines,
    }) as unknown as VisitListItemDTO;
    return dto;
  });
  return { items, total, page: q.page, pageSize: q.pageSize };
}

/**
 * Kalkulyator uchun xizmatlar (kategoriya tartibi → xizmat tartibi).
 * Nofaollar ham qaytadi (`isActive=false`) — mavjud qatorni tahrirlashda snapshot xizmati topilishi uchun;
 * qoʻshish oynasi faqat faollarini koʻrsatadi.
 */
export async function listTreatmentServices(clinicId: string): Promise<TreatmentService[]> {
  return prisma.service.findMany({
    where: { clinicId },
    orderBy: [{ category: { order: 'asc' } }, { order: 'asc' }, { name: 'asc' }],
    select: serviceSelect,
  });
}

// ───────────────────────────── Yaratish ─────────────────────────────

export async function createVisit(ctx: VisitCtx, input: CreateVisitInput): Promise<VisitDetail> {
  const { clinicId, actor } = ctx;
  const doctorId = actor.role === 'DOCTOR' ? actor.id : input.doctorId;
  if (!doctorId) {
    throw ApiError.validation(
      { fieldErrors: { doctorId: ['Shifokor tanlanmagan'] } },
      'Shifokor tanlanmagan',
    );
  }

  return prisma.$transaction(async (tx) => {
    const patient = await tx.patient.findFirst({
      where: { id: input.patientId, clinicId },
      select: { id: true },
    });
    if (!patient) throw ApiError.notFound('Bemor topilmadi');

    const doctor = await tx.user.findFirst({
      where: { id: doctorId, clinicId, role: 'DOCTOR', isActive: true },
      select: { id: true, room: true },
    });
    if (!doctor) throw ApiError.notFound('Shifokor topilmadi yoki faol emas');

    let queueId: string | undefined;
    if (input.queueId) {
      const queue = await tx.queue.findFirst({
        where: { id: input.queueId, clinicId },
        select: { id: true, status: true, doctorId: true, room: true, visit: { select: { id: true } } },
      });
      if (!queue) throw ApiError.notFound('Navbat taloni topilmadi');
      if (queue.visit)
        throw new ApiError(409, 'CONFLICT', 'Bu talon boshqa qabulga bogʻlangan', { reason: 'QUEUE_LINKED' });
      await tx.queue.update({
        where: { id: queue.id },
        data: {
          status: 'SERVING',
          servedAt: new Date(),
          doctorId: queue.doctorId ?? doctor.id,
          room: queue.room ?? doctor.room ?? undefined,
        },
      });
      queueId = queue.id;
    }

    let appointmentId: string | undefined;
    if (input.appointmentId) {
      const appt = await tx.appointment.findFirst({
        where: { id: input.appointmentId, clinicId },
        select: { id: true, status: true, visit: { select: { id: true } } },
      });
      if (!appt) throw ApiError.notFound('Yozilish topilmadi');
      if (appt.visit)
        throw new ApiError(409, 'CONFLICT', 'Bu yozilish boshqa qabulga bogʻlangan', {
          reason: 'APPOINTMENT_LINKED',
        });
      if (appt.status === 'CANCELLED')
        throw new ApiError(409, 'CONFLICT', 'Yozilish bekor qilingan', { reason: 'APPOINTMENT_CANCELLED' });
      if (appt.status !== 'DONE') {
        await tx.appointment.update({ where: { id: appt.id }, data: { status: 'ARRIVED' } });
      }
      appointmentId = appt.id;
    }

    const visit = await tx.visit.create({
      data: { clinicId, patientId: patient.id, doctorId: doctor.id, queueId, appointmentId },
      include: visitInclude,
    });

    await audit(
      {
        ...auditBase(ctx),
        action: 'CREATE',
        entity: 'Visit',
        entityId: visit.id,
        after: {
          patientId: patient.id,
          doctorId: doctor.id,
          queueId: queueId ?? null,
          appointmentId: appointmentId ?? null,
        },
      },
      tx,
    );

    return visit;
  });
}

// ───────────────────────────── Klinik maydonlar ─────────────────────────────

export async function updateVisit(
  ctx: VisitCtx,
  visitId: string,
  input: UpdateVisitInput,
): Promise<VisitDetail> {
  return prisma.$transaction(async (tx) => {
    await loadOpenVisit(tx, ctx.clinicId, visitId);

    const data: Prisma.VisitUpdateInput = {};
    const fields = [
      'complaint',
      'anamnesis',
      'examination',
      'diagnosis',
      'icd10',
      'plan',
      'recommendations',
    ] as const;
    for (const f of fields) {
      const v = input[f];
      if (v === undefined) continue;
      data[f] = v === null || v === '' ? null : v;
    }
    if (Object.keys(data).length > 0) {
      await tx.visit.update({ where: { id: visitId }, data });
    }
    return loadVisitDetail(tx, ctx.clinicId, visitId);
  });
}

// ───────────────────────────── Qatorlar ─────────────────────────────

export async function addLine(ctx: VisitCtx, visitId: string, input: AddLineInput): Promise<VisitDetail> {
  return prisma.$transaction(async (tx) => {
    const visit = await loadOpenVisit(tx, ctx.clinicId, visitId);
    const service = await loadService(tx, ctx.clinicId, input.serviceId, true);

    // CalcError (HALF_NOT_ALLOWED, INVALID_QUANTITY, INVALID_DISCOUNT …) shu yerda otiladi → 400
    const snapshot = computeLineSnapshot(service, {
      patientType: input.patientType,
      withMedicine: input.withMedicine,
      quantity: input.quantity,
      discountType: input.discountType,
      discountValue: input.discountValue,
    });

    const agg = await tx.treatmentLine.aggregate({ where: { visitId: visit.id }, _max: { order: true } });
    const order = (agg._max.order ?? 0) + 1;

    const line = await tx.treatmentLine.create({
      data: {
        visitId: visit.id,
        serviceId: service.id,
        ...snapshot,
        side: input.side ?? null,
        organ: input.organ ?? service.defaultOrgan ?? null,
        detail: input.detail ?? null,
        note: input.note ?? null,
        order,
      },
    });

    const totals = await recalcVisit(tx, visit.id);

    await audit(
      {
        ...auditBase(ctx),
        action: 'CREATE',
        entity: 'TreatmentLine',
        entityId: line.id,
        after: { visitId: visit.id, ...lineAuditView(line), visitTotalNet: totals.totalNet },
      },
      tx,
    );

    return loadVisitDetail(tx, ctx.clinicId, visitId);
  });
}

export async function updateLine(
  ctx: VisitCtx,
  visitId: string,
  lineId: string,
  input: UpdateLineInput,
): Promise<VisitDetail> {
  return prisma.$transaction(async (tx) => {
    const visit = await loadOpenVisit(tx, ctx.clinicId, visitId);
    const line = await tx.treatmentLine.findFirst({ where: { id: lineId, visitId: visit.id } });
    if (!line) throw ApiError.notFound('Qator topilmadi');

    const serviceChanged = input.serviceId !== undefined && input.serviceId !== line.serviceId;
    const service = await loadService(tx, ctx.clinicId, input.serviceId ?? line.serviceId, serviceChanged);

    const snapshot = computeLineSnapshot(service, {
      patientType: input.patientType ?? line.patientType,
      withMedicine: input.withMedicine ?? line.withMedicine,
      quantity: input.quantity ?? line.quantity.toString(),
      discountType: input.discountType ?? line.discountType,
      discountValue: input.discountValue ?? line.discountValue.toString(),
    });

    const updated = await tx.treatmentLine.update({
      where: { id: line.id },
      data: {
        serviceId: service.id,
        ...snapshot,
        side: input.side !== undefined ? input.side : line.side,
        organ:
          input.organ !== undefined
            ? input.organ
            : serviceChanged
              ? (service.defaultOrgan ?? null)
              : line.organ,
        detail: input.detail !== undefined ? input.detail : line.detail,
        note: input.note !== undefined ? input.note : line.note,
      },
    });

    const totals = await recalcVisit(tx, visit.id);

    await audit(
      {
        ...auditBase(ctx),
        action: 'UPDATE',
        entity: 'TreatmentLine',
        entityId: line.id,
        before: lineAuditView(line),
        after: { ...lineAuditView(updated), visitTotalNet: totals.totalNet },
      },
      tx,
    );

    return loadVisitDetail(tx, ctx.clinicId, visitId);
  });
}

export async function deleteLine(ctx: VisitCtx, visitId: string, lineId: string): Promise<VisitDetail> {
  return prisma.$transaction(async (tx) => {
    const visit = await loadOpenVisit(tx, ctx.clinicId, visitId);
    const line = await tx.treatmentLine.findFirst({ where: { id: lineId, visitId: visit.id } });
    if (!line) throw ApiError.notFound('Qator topilmadi');

    await tx.treatmentLine.delete({ where: { id: line.id } });
    const totals = await recalcVisit(tx, visit.id);

    await audit(
      {
        ...auditBase(ctx),
        action: 'DELETE',
        entity: 'TreatmentLine',
        entityId: line.id,
        before: lineAuditView(line),
        after: { visitTotalNet: totals.totalNet },
      },
      tx,
    );

    return loadVisitDetail(tx, ctx.clinicId, visitId);
  });
}

// ───────────────────────────── Umumiy chegirma ─────────────────────────────

export async function setGlobalDiscount(
  ctx: VisitCtx,
  visitId: string,
  input: GlobalDiscountInput,
): Promise<VisitDetail> {
  return prisma.$transaction(async (tx) => {
    const visit = await loadOpenVisit(tx, ctx.clinicId, visitId);
    const value = input.type === 'NONE' ? 0 : input.value;

    await tx.visit.update({
      where: { id: visit.id },
      data: { globalDiscountType: input.type, globalDiscountValue: new Prisma.Decimal(value) },
    });
    // INVALID_DISCOUNT (masalan 100 % dan koʻp) shu yerda otiladi → 400, tranzaksiya bekor boʻladi
    const totals = await recalcVisit(tx, visit.id);

    await audit(
      {
        ...auditBase(ctx),
        action: 'UPDATE',
        entity: 'Visit',
        entityId: visit.id,
        before: {
          globalDiscountType: visit.globalDiscountType,
          globalDiscountValue: visit.globalDiscountValue,
        },
        after: {
          globalDiscountType: input.type,
          globalDiscountValue: value,
          totalNet: totals.totalNet,
          discount: totals.discount,
        },
      },
      tx,
    );

    return loadVisitDetail(tx, ctx.clinicId, visitId);
  });
}

// ───────────────────────────── Yakunlash / bekor qilish ─────────────────────────────

export async function completeVisit(ctx: VisitCtx, visitId: string): Promise<VisitDetail> {
  return prisma.$transaction(async (tx) => {
    const visit = await loadOpenVisit(tx, ctx.clinicId, visitId);
    const linesCount = await tx.treatmentLine.count({ where: { visitId: visit.id } });
    if (linesCount === 0) {
      throw new ApiError(409, 'CONFLICT', 'Yakunlash uchun kamida bitta muolaja qoʻshing', {
        reason: 'NO_LINES',
      });
    }

    const now = new Date();
    const totals = await recalcVisit(tx, visit.id);
    await tx.visit.update({ where: { id: visit.id }, data: { status: 'COMPLETED', completedAt: now } });

    if (visit.queueId) {
      await tx.queue.updateMany({
        where: {
          id: visit.queueId,
          clinicId: ctx.clinicId,
          status: { in: ['WAITING', 'CALLED', 'SERVING'] },
        },
        data: { status: 'DONE', doneAt: now },
      });
    }
    if (visit.appointmentId) {
      await tx.appointment.updateMany({
        where: { id: visit.appointmentId, clinicId: ctx.clinicId, status: { notIn: ['CANCELLED'] } },
        data: { status: 'DONE' },
      });
    }

    await audit(
      {
        ...auditBase(ctx),
        action: 'VISIT_COMPLETE',
        entity: 'Visit',
        entityId: visit.id,
        after: {
          linesCount,
          totalNet: totals.totalNet,
          paidAmount: totals.paidAmount,
          balance: totals.balance,
          completedAt: now,
        },
      },
      tx,
    );

    return loadVisitDetail(tx, ctx.clinicId, visitId);
  });
}

export async function cancelVisit(ctx: VisitCtx, visitId: string): Promise<VisitDetail> {
  return prisma.$transaction(async (tx) => {
    const visit = await loadOpenVisit(tx, ctx.clinicId, visitId);
    const paid = await tx.payment.aggregate({ where: { visitId: visit.id }, _sum: { amount: true } });
    const paidSum = paid._sum.amount;
    if ((paidSum && !paidSum.isZero()) || !visit.paidAmount.isZero()) {
      throw new ApiError(409, 'CONFLICT', 'Toʻlov qilingan qabulni bekor qilib boʻlmaydi', {
        reason: 'HAS_PAYMENTS',
      });
    }

    const now = new Date();
    await tx.visit.update({ where: { id: visit.id }, data: { status: 'CANCELLED' } });

    if (visit.queueId) {
      await tx.queue.updateMany({
        where: {
          id: visit.queueId,
          clinicId: ctx.clinicId,
          status: { in: ['WAITING', 'CALLED', 'SERVING'] },
        },
        data: { status: 'DONE', doneAt: now },
      });
    }

    await audit(
      {
        ...auditBase(ctx),
        action: 'VISIT_CANCEL',
        entity: 'Visit',
        entityId: visit.id,
        before: { status: 'OPEN' },
        after: { status: 'CANCELLED', cancelledAt: now },
      },
      tx,
    );

    return loadVisitDetail(tx, ctx.clinicId, visitId);
  });
}
