import type { Prisma } from '@prisma/client';
import { prisma, type Tx } from '@/lib/prisma';

export type AuditAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'LOGIN'
  | 'PRICE_CHANGE'
  | 'PAYMENT'
  | 'REFUND'
  | 'SHIFT_OPEN'
  | 'SHIFT_CLOSE'
  | 'VISIT_COMPLETE'
  | 'VISIT_CANCEL'
  | 'QUEUE_CALL'
  | 'SETTINGS'
  | 'PASSWORD_RESET';

export interface AuditInput {
  clinicId: string | null;
  userId: string | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}

function toJson(v: unknown): Prisma.InputJsonValue | undefined {
  if (v === undefined || v === null) return undefined;
  return JSON.parse(
    // Replacer `function` boʻlishi shart: Decimal `toJSON()` string qaytaradi, xom qiymat `this[key]` da
    JSON.stringify(v, function (this: Record<string, unknown>, k: string, val: unknown) {
      const raw = this[k];
      if (raw && typeof raw === 'object' && 'toFixed' in raw && 'd' in raw) {
        return Number((raw as { toString(): string }).toString());
      }
      if (typeof val === 'bigint') return Number(val);
      return val;
    }),
  ) as Prisma.InputJsonValue;
}

/** Audit yozuvi: kim, nimani, qachon oʻzgartirdi. Tranzaksiya ichida ham ishlatiladi. */
export async function audit(input: AuditInput, tx: Tx | typeof prisma = prisma): Promise<void> {
  await tx.auditLog.create({
    data: {
      clinicId: input.clinicId,
      userId: input.userId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      before: toJson(input.before),
      after: toJson(input.after),
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}
